import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

async function sendOneSignal(subscriptionId: string) {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '43f9ce9c-8d86-4076-a8b6-30dac8429149'
  const apiKeyRaw = (process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY || '').trim()
  const apiKey = apiKeyRaw.replace(/^(?:Key|Basic)\\s+/i, '').trim()
  if (!appId || !apiKey) return { ok: false }
  const basePayload: any = {
    app_id: appId,
    include_subscription_ids: [String(subscriptionId)],
    headings: { en: 'LicitMASA: Teste Real' },
    contents: { en: 'Sua notificação chegou corretamente agora!' },
    priority: 10,
    android_channel_id: 'push_notifications',
    android_visibility: 1,
  }
  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Key ${apiKey}`,
    },
    body: JSON.stringify(basePayload),
  })
  return { ok: res.ok, status: res.status }
}

async function resolveTokenByEmailOrUserId(email?: string, userId?: string): Promise<string | null> {
  const supa = admin()
  if (!supa) return null
  let uid = (userId || '').trim()
  if (!uid && email) {
    const { data } = await supa
      .from('profiles')
      .select('id,email,onesignal_id')
      .eq('email', String(email).trim().toLowerCase())
      .limit(1)
      .maybeSingle()
    uid = String(data?.id || '')
  }
  if (!uid) return null
  const { data: prof } = await supa
    .from('profiles')
    .select('onesignal_id')
    .eq('id', uid)
    .limit(1)
    .maybeSingle()
  const onesignalId = String((prof as any)?.onesignal_id || '')
  if (onesignalId) return onesignalId
  const { data: ua } = await supa
    .from('user_alerts')
    .select('fcm_token')
    .eq('user_id', uid)
    .limit(1)
    .maybeSingle()
  const token = String((ua as any)?.fcm_token || '')
  return token || null
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const tokenDirect = String(body.token || '')
    const email = String(body.email || '')
    const userId = String(body.userId || '')
    const adminToken = (req.headers.get('x-admin-token') || '').trim()
    const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
    if (!adminToken || adminToken !== expected) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    if (tokenDirect) {
      const r = await sendOneSignal(tokenDirect)
      return NextResponse.json({ ok: r.ok }, { status: r.status })
    }
    const resolved = await resolveTokenByEmailOrUserId(email, userId)
    if (!resolved) return NextResponse.json({ ok: false, error: 'SUBSCRIPTION_NOT_FOUND' }, { status: 404 })
    const r = await sendOneSignal(resolved)
    return NextResponse.json({ ok: r.ok }, { status: r.status })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url)
    const tokenDirect = String(u.searchParams.get('token') || '')
    const email = String(u.searchParams.get('email') || '')
    const userId = String(u.searchParams.get('userId') || '')
    const adminToken = (req.headers.get('x-admin-token') || '').trim()
    const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
    if (!adminToken || adminToken !== expected) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    if (tokenDirect) {
      const r = await sendOneSignal(tokenDirect)
      return NextResponse.json({ ok: r.ok }, { status: r.status })
    }
    const resolved = await resolveTokenByEmailOrUserId(email, userId)
    if (!resolved) return NextResponse.json({ ok: false, error: 'SUBSCRIPTION_NOT_FOUND' }, { status: 404 })
    const r = await sendOneSignal(resolved)
    return NextResponse.json({ ok: r.ok }, { status: r.status })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
