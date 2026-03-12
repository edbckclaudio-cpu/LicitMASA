import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  try { console.log('[Diag/TestRoute] URL presente:', !!url, 'KEY presente:', !!key, 'KEY length:', key ? key.length : 0) } catch {}
  if (!url || !key) return null
  return createClient(url, key)
}

async function sendOneSignal(subscriptionId: string) {
  const appId = '43f9ce9c-8d86-4076-a8b6-30dac8429149'
  const apiKeyRaw = (process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY || '').trim()
  const apiKey = apiKeyRaw.replace(/^(?:Key|Basic)\\s+/i, '').trim()
  if (!appId || !apiKey) return { ok: false }
  const basePayload: any = {
    app_id: appId,
    include_subscription_ids: [String(subscriptionId)],
    headings: { pt: 'Teste de Alerta', en: 'Alert Test' },
    contents: { pt: 'Notificação de teste via OneSignal', en: 'Test notification via OneSignal' },
    priority: 10,
    android_visibility: 1,
    android_sound: 'default',
    vibrate: true,
    android_vibration_pattern: '200,100,200,100,200',
    chrome_web_icon: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br'}/icons/icone_L_192.png`,
    chrome_web_image: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br'}/icons/icone_L_512.png`,
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br/',
  }
  const channelId = (process.env.ONESIGNAL_ANDROID_CHANNEL_ID || '').trim()
  if (channelId) {
    basePayload.android_channel_id = channelId
  }
  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Basic ${apiKey}`,
    },
    body: JSON.stringify(basePayload),
  })
  let raw: string | null = null
  try { raw = await res.text() } catch {}
  let parsed: any = null
  try { parsed = raw ? JSON.parse(raw) : null } catch {}
  return { ok: res.ok, status: res.status, data: parsed ?? (raw ? { raw } : null) }
}

async function sendOneSignalByExternalId(externalId: string) {
  const appId = '43f9ce9c-8d86-4076-a8b6-30dac8429149'
  const apiKeyRaw = (process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY || '').trim()
  const apiKey = apiKeyRaw.replace(/^(?:Key|Basic)\s+/i, '').trim()
  if (!appId || !apiKey) return { ok: false }
  const basePayload: any = {
    app_id: appId,
    include_external_user_ids: [String(externalId)],
    headings: { pt: 'Teste de Alerta', en: 'Alert Test' },
    contents: { pt: 'Notificação de teste via OneSignal', en: 'Test notification via OneSignal' },
    priority: 10,
    android_visibility: 1,
    android_sound: 'default',
    vibrate: true,
    android_vibration_pattern: '200,100,200,100,200',
    chrome_web_icon: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br'}/icons/icone_L_192.png`,
    chrome_web_image: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br'}/icons/icone_L_512.png`,
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br/',
  }
  const channelId = (process.env.ONESIGNAL_ANDROID_CHANNEL_ID || '').trim()
  if (channelId) {
    basePayload.android_channel_id = channelId
  }
  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Authorization': `Basic ${apiKey}`,
    },
    body: JSON.stringify(basePayload),
  })
  let raw: string | null = null
  try { raw = await res.text() } catch {}
  let parsed: any = null
  try { parsed = raw ? JSON.parse(raw) : null } catch {}
  return { ok: res.ok, status: res.status, data: parsed ?? (raw ? { raw } : null) }
}

async function resolveTokenByEmailOrUserId(email?: string, userId?: string): Promise<string | null> {
  const supa = admin()
  if (!supa) return null
  let uid = (userId || '').trim()
  if (!uid && email) {
    const { data } = await supa
      .from('profiles')
      .select('id,email,subscription_id')
      .eq('email', String(email).trim().toLowerCase())
      .limit(1)
      .maybeSingle()
    uid = String(data?.id || '')
  }
  if (!uid) return null
  const { data: prof } = await supa
    .from('profiles')
    .select('subscription_id')
    .eq('id', uid)
    .limit(1)
    .maybeSingle()
  const subId = String((prof as any)?.subscription_id || '')
  return subId || null
}

async function resolveLatestSubscribedToken(): Promise<string | null> {
  const supa = admin()
  if (!supa) return null
  try {
    const { data: p } = await supa
      .from('profiles')
      .select('subscription_id, updated_at')
      .not('subscription_id', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(1)
    const id = String((p && p[0] && (p[0] as any).subscription_id) || '')
    if (id) return id
  } catch {}
  return null
}

async function fetchLatestSubscribedPlayerIdFromOneSignal(): Promise<string | null> {
  const appId = '43f9ce9c-8d86-4076-a8b6-30dac8429149'
  const apiKeyRaw = (process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY || '').trim()
  const apiKey = apiKeyRaw.replace(/^(?:Key|Basic)\s+/i, '').trim()
  if (!appId || !apiKey) return null
  try {
    const url = `https://api.onesignal.com/players?app_id=${encodeURIComponent(appId)}&limit=50&offset=0`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey}`,
      }
    })
    const json: any = await res.json().catch(() => null)
    const players: any[] = Array.isArray(json?.players) ? json.players : []
    for (const p of players) {
      const pid = String(p?.id || '')
      const invalid = Boolean(p?.invalid_identifier || p?.invalidated)
      const enabled = typeof p?.enabled === 'boolean' ? p.enabled : true
      if (pid && !invalid && enabled) {
        return pid
      }
    }
  } catch {}
  return null
}

async function listPlayersFromOneSignal(): Promise<{ ok: boolean; total?: number; count?: number; players?: any[] }>{
  const appId = '43f9ce9c-8d86-4076-a8b6-30dac8429149'
  const apiKeyRaw = (process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY || '').trim()
  const apiKey = apiKeyRaw.replace(/^(?:Key|Basic)\s+/i, '').trim()
  if (!appId || !apiKey) return { ok: false }
  try {
    const url = `https://api.onesignal.com/players?app_id=${encodeURIComponent(appId)}&limit=50&offset=0`
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey}`,
      }
    })
    const json: any = await res.json().catch(() => null)
    const players: any[] = Array.isArray(json?.players) ? json.players : []
    const mapped = players.map((p: any) => ({
      id: String(p?.id || ''),
      device_type: p?.device_type ?? null,
      language: p?.language ?? null,
      external_user_id: p?.external_user_id ?? null,
      session_count: p?.session_count ?? null,
      last_active: p?.last_active ?? null,
      invalid_identifier: Boolean(p?.invalid_identifier || p?.invalidated),
      enabled: typeof p?.enabled === 'boolean' ? p.enabled : true,
    }))
    return { ok: res.ok, total: json?.total_count ?? null, count: mapped.length, players: mapped }
  } catch {
    return { ok: false }
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const tokenDirect = String(body.token || '')
    const subscriptionId = String(body.subscriptionId || body.playerId || '')
    const externalId = String(body.externalId || '')
    const email = String(body.email || '')
    const userId = String(body.userId || '')
    const adminToken = (req.headers.get('x-admin-token') || '').trim()
    const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
    if (!adminToken || adminToken !== expected) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    if (tokenDirect) {
      const r = await sendOneSignal(tokenDirect)
      return NextResponse.json({ ok: r.ok, data: r.data }, { status: r.status })
    }
    if (subscriptionId) {
      const r = await sendOneSignal(subscriptionId)
      return NextResponse.json({ ok: r.ok, data: r.data }, { status: r.status })
    }
    if (externalId) {
      const r = await sendOneSignalByExternalId(externalId)
      return NextResponse.json({ ok: r.ok, data: r.data }, { status: r.status })
    }
    let resolved = await resolveTokenByEmailOrUserId(email, userId)
    if (!resolved) {
      resolved = await resolveLatestSubscribedToken()
    }
    if (!resolved) {
      resolved = await fetchLatestSubscribedPlayerIdFromOneSignal()
    }
    if (!resolved) return NextResponse.json({ ok: false, error: 'SUBSCRIPTION_NOT_FOUND' }, { status: 404 })
    const r = await sendOneSignal(resolved)
    return NextResponse.json({ ok: r.ok, data: r.data }, { status: r.status })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url)
    const listFlag = String(u.searchParams.get('list') || u.searchParams.get('players') || '')
    const tokenDirect = String(u.searchParams.get('token') || '')
    const subscriptionId = String(u.searchParams.get('subscriptionId') || u.searchParams.get('playerId') || '')
    const externalId = String(u.searchParams.get('externalId') || '')
    const email = String(u.searchParams.get('email') || '')
    const userId = String(u.searchParams.get('userId') || '')
    const adminToken = (req.headers.get('x-admin-token') || '').trim()
    const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
    if (!adminToken || adminToken !== expected) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    if (listFlag && listFlag !== '0' && listFlag.toLowerCase() !== 'false') {
      const list = await listPlayersFromOneSignal()
      return NextResponse.json(list, { status: list.ok ? 200 : 500 })
    }
    if (tokenDirect) {
      const r = await sendOneSignal(tokenDirect)
      return NextResponse.json({ ok: r.ok, data: r.data }, { status: r.status })
    }
    if (subscriptionId) {
      const r = await sendOneSignal(subscriptionId)
      return NextResponse.json({ ok: r.ok, data: r.data }, { status: r.status })
    }
    if (externalId) {
      const r = await sendOneSignalByExternalId(externalId)
      return NextResponse.json({ ok: r.ok, data: r.data }, { status: r.status })
    }
    let resolved = await resolveTokenByEmailOrUserId(email, userId)
    if (!resolved) {
      resolved = await resolveLatestSubscribedToken()
    }
    if (!resolved) {
      resolved = await fetchLatestSubscribedPlayerIdFromOneSignal()
    }
    if (!resolved) return NextResponse.json({ ok: false, error: 'SUBSCRIPTION_NOT_FOUND' }, { status: 404 })
    const r = await sendOneSignal(resolved)
    return NextResponse.json({ ok: r.ok, data: r.data }, { status: r.status })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
