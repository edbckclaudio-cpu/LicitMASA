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
    const res = await play.purchases.products.get({
      packageName,
      productId,
      token: purchaseToken,
    })
    const data: any = res.data || {}
    const okPurchase = (data.purchaseState === 0)
    if (!okPurchase) return NextResponse.json({ ok: false, status: 400, data }, { status: 400 })

    const supa = adminClient()
    if (!supa) return NextResponse.json({ ok: false, error: 'SERVICE_KEY_MISSING' }, { status: 500 })
    await supa.from('profiles').upsert({ id: userId, is_premium: true, plan: 'premium' }, { onConflict: 'id' })
    return NextResponse.json({ ok: true, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
