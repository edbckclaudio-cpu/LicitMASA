'use server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

async function getOAuth2Client() {
  const clientId = (process.env.GOOGLE_CLIENT_ID || '').trim()
  const clientSecret = (process.env.GOOGLE_CLIENT_SECRET || '').trim()
  const refreshToken = (process.env.GOOGLE_REFRESH_TOKEN || '').trim()
  if (!clientId || !clientSecret || !refreshToken) return null
  const auth = new google.auth.OAuth2(clientId, clientSecret)
  auth.setCredentials({ refresh_token: refreshToken })
  return auth
}

async function getPlayAuth() {
  const saJson = (process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim()
  const saPath = (process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim()
  const saEmail = (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL || '').trim()
  const saKeyRaw = (process.env.GOOGLE_SERVICE_ACCOUNT_KEY || process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_KEY || '').trim()
  const saKey = saKeyRaw.replace(/\\n/g, '\n')
  const scope = ['https://www.googleapis.com/auth/androidpublisher']
  if (saJson) {
    try {
      const creds = JSON.parse(saJson)
      const email = String(creds.client_email || '').trim()
      const key = String(creds.private_key || '').trim()
      if (email && key) {
        const jwt = new google.auth.JWT(email, undefined, key, scope)
        ;(jwt as any).source = 'service_account_json'
        ;(jwt as any).email = email
        return jwt
      }
    } catch {}
  }
  if (saPath) {
    try {
      const ga = new google.auth.GoogleAuth({ keyFile: saPath, scopes: scope })
      const client = await ga.getClient()
      ;(client as any).source = 'service_account_keyfile'
      return client
    } catch {}
  }
  if (saEmail && saKey) {
    try {
      const jwt = new google.auth.JWT(saEmail, undefined, saKey, scope)
      ;(jwt as any).source = 'service_account_env'
      ;(jwt as any).email = saEmail
      return jwt
    } catch {}
  }
  const oauth = await getOAuth2Client()
  if (oauth) {
    ;(oauth as any).source = 'oauth2'
    return oauth
  }
  return null
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const packageName = (process.env.GOOGLE_PLAY_PACKAGE_NAME || process.env.ANDROID_PACKAGE_ID || 'br.com.licitmasa').trim()
    const productId = String(body.productId || process.env.NEXT_PUBLIC_PLAY_PRODUCT_ID || '').trim()
    const purchaseToken = String(body.purchaseToken || body.token || body.purchase_token || '').trim()
    const userId = String(body.userId || '').trim()
    if (!productId || !purchaseToken || !userId) return NextResponse.json({ ok: false, error: 'MISSING_FIELDS' }, { status: 400 })

    const auth = await getPlayAuth()
    if (!auth) return NextResponse.json({ ok: false, error: 'PLAY_AUTH_MISSING' }, { status: 500 })
    const authSource = String((auth as any)?.source || 'unknown')
    const authEmail = String((auth as any)?.email || '')
    try {
      const client: any = (auth as any).getAccessToken ? auth : await (async () => {
        try {
          const ga = new google.auth.GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] })
          return await ga.getClient()
        } catch { return auth }
      })()
      const tokenInfo = await client.getAccessToken().catch((e: any) => { throw e })
      if (!tokenInfo || !tokenInfo.token) {
        throw new Error('INVALID_CLIENT_ACCESS_TOKEN')
      }
    } catch (e: any) {
      const msg = String(e?.message || '').trim()
      return NextResponse.json({ ok: false, error: 'INVALID_CLIENT', details: msg, authSource, authEmail }, { status: 401 })
    }
    const play = google.androidpublisher({ version: 'v3', auth: auth as any })
    let v2: any = {}
    try {
      const resV2 = await play.purchases.subscriptionsv2.get({
        packageName,
        token: purchaseToken,
      } as any)
      v2 = resV2.data || {}
    } catch (e: any) {
      const msg = String(e?.message || '').trim()
      const msgLc = msg.toLowerCase()
      const code = Number((e as any)?.code || 0)
      const err = (e as any)?.errors || (e as any)?.response?.data || null
      const projectMatch = msg.match(/project\s+(\d{6,})/i)
      const projectId = projectMatch ? projectMatch[1] : undefined
      const apiDisabled = msgLc.includes('androidpublisher.googleapis.com') && (msgLc.includes('has not been used') || msgLc.includes('disabled'))
      if (apiDisabled) {
        try {
          const oauth = await getOAuth2Client()
          if (oauth && oauth !== auth) {
            const play2 = google.androidpublisher({ version: 'v3', auth: oauth as any })
            const resV2b = await play2.purchases.subscriptionsv2.get({
              packageName,
              token: purchaseToken,
            } as any)
            v2 = resV2b.data || {}
          } else {
            return NextResponse.json({
              ok: false,
              error: 'ANDROIDPUBLISHER_NOT_ENABLED',
              message: msg,
              projectId,
              hint: 'Habilite a API Google Play Android Developer (androidpublisher) no projeto GCP usado pelas credenciais',
              authSource,
              authEmail,
            }, { status: 400 })
          }
        } catch (e2: any) {
          const msg2 = String(e2?.message || '').trim()
          return NextResponse.json({
            ok: false,
            error: 'ANDROIDPUBLISHER_NOT_ENABLED',
            message: msg2 || msg,
            projectId,
            details: (e2 as any)?.errors || (e2 as any)?.response?.data || null,
            authSource,
            authEmail,
          }, { status: 400 })
        }
      } else {
        const insufficient = code === 403 || msgLc.includes('insufficient') || msgLc.includes('permission')
        if (insufficient) {
          return NextResponse.json({
            ok: false,
            error: 'PERMISSION_DENIED',
            message: msg || 'INSUFFICIENT_PERMISSIONS',
            packageName,
            productId,
            authSource,
            authEmail,
            hint: 'Conceda acesso no Play Console: Settings > API access. Vincule o projeto GCP e dê permissões ao Service Account ou usuário OAuth. Recomenda-se papel Admin ou incluir Order management e View financial data.',
          }, { status: 403 })
        }
        return NextResponse.json({ ok: false, error: msg || 'PLAY_API_ERROR', code, details: err, packageName, productId, authSource, authEmail }, { status: code && code >= 400 && code < 600 ? code : 500 })
      }
    }
    const state = String(v2?.subscriptionState || '')
    const items: any[] = Array.isArray(v2?.lineItems) ? v2.lineItems : []
    const expIso = String(items?.[0]?.expiryTime || '')
    const expMs = (() => { try { return expIso ? new Date(expIso).getTime() : 0 } catch { return 0 } })()
    const acknowledgedV2 = String(v2?.acknowledgementState || '').toUpperCase().includes('ACKNOWLEDGED')
    const autoRenewEnabled = !!items?.[0]?.autoRenewingPlan?.autoRenewEnabled
    const activeByState = state.toUpperCase().includes('ACTIVE')
    const activeWindow = expMs > Date.now()
    const okPurchase = activeByState || activeWindow || acknowledgedV2 || autoRenewEnabled
    if (!okPurchase) return NextResponse.json({ ok: false, status: 400, data: v2 }, { status: 400 })
    try {
      if (!acknowledgedV2) {
        await play.purchases.subscriptions.acknowledge({
          packageName,
          subscriptionId: productId,
          token: purchaseToken,
        }, { headers: { 'Content-Type': 'application/json' } } as any)
      }
    } catch {}

    const supa = adminClient()
    if (!supa) return NextResponse.json({ ok: false, error: 'SERVICE_KEY_MISSING' }, { status: 500 })
    await supa.from('profiles').upsert({ id: userId, is_premium: true, plan: 'premium' }, { onConflict: 'id' })
    return NextResponse.json({ ok: true, data: v2 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
