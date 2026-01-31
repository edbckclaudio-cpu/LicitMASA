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

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const packageName = (process.env.GOOGLE_PLAY_PACKAGE_NAME || process.env.ANDROID_PACKAGE_ID || 'br.com.licitmasa').trim()
    const productId = String(body.productId || process.env.NEXT_PUBLIC_PLAY_PRODUCT_ID || '').trim()
    const purchaseToken = String(body.purchaseToken || '').trim()
    const userId = String(body.userId || '').trim()
    if (!productId || !purchaseToken || !userId) return NextResponse.json({ ok: false, error: 'MISSING_FIELDS' }, { status: 400 })

    const auth = await getOAuth2Client()
    if (!auth) return NextResponse.json({ ok: false, error: 'PLAY_AUTH_MISSING' }, { status: 500 })
    const play = google.androidpublisher({ version: 'v3', auth })
    let v2: any = {}
    try {
      const resV2 = await play.purchases.subscriptionsv2.get({
        packageName,
        token: purchaseToken,
      } as any)
      v2 = resV2.data || {}
    } catch (e: any) {
      const msg = String(e?.message || '').trim()
      const code = Number((e as any)?.code || 0)
      const err = (e as any)?.errors || (e as any)?.response?.data || null
      return NextResponse.json({ ok: false, error: msg || 'PLAY_API_ERROR', code, details: err, packageName, productId }, { status: code && code >= 400 && code < 600 ? code : 500 })
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
