import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const externalId = String(body.externalId || '').trim()
    const userId = String(body.userId || '').trim()
    const playerId = String(body.playerId || '').trim()
    const title = String(body.title || 'Teste de Alerta').trim()
    const message = String(body.body || 'Notificação de teste via OneSignal').trim()
    const appId = process.env.ONESIGNAL_APP_ID || ''
    const apiKey = process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY || ''
    const keyNameUsed = process.env.ONESIGNAL_REST_API_KEY ? 'ONESIGNAL_REST_API_KEY' : (process.env.ONESIGNAL_API_KEY ? 'ONESIGNAL_API_KEY' : 'NONE')
    if (!appId || !apiKey || (!externalId && !userId && !playerId)) {
      return NextResponse.json({ ok: false, error: 'MISSING_CONFIG_OR_USER' }, { status: 400 })
    }
    const target = externalId ? { external_user_id: externalId }
      : (userId ? { external_user_id: userId } : { subscription_id: playerId })
    try {
      console.log('[OneSignal Test] endpoint https://api.onesignal.com/notifications')
      console.log('[OneSignal Test] using key env:', keyNameUsed)
      console.log('[OneSignal Test] app_id:', appId ? '[present]' : '[missing]')
      console.log('[OneSignal Test] target', target)
    } catch {}
    const requestBody = {
      app_id: appId,
      ...(externalId ? { include_external_user_ids: [externalId] }
        : (userId ? { include_external_user_ids: [userId] } : { include_subscription_ids: [playerId] })),
      headings: { en: title },
      contents: { en: message },
    }
    const res = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })
    let json: any = null
    let text: string | null = null
    try { json = await res.clone().json() } catch { try { text = await res.text() } catch {} }
    try { console.log('[OneSignal Test] response status', res.status, 'ok=', res.ok) } catch {}
    try {
      if (!res.ok) {
        console.error('[OneSignal Test] request body (redacted)', { ...requestBody, app_id: '[present]' })
        console.error('[OneSignal Test] error payload', json || text || '[none]')
        if (res.status === 401 || res.status === 403) {
          console.error('[OneSignal Test] Access Denied: verifique ONESIGNAL_REST_API_KEY possui permissão de escrita e corresponde ao App ID')
        }
      } else {
        console.log('[OneSignal Test] success payload', json || text || '[none]')
      }
    } catch {}
    const notifId = json?.id || null
    try { if (notifId) console.log('[OneSignal Test] notification id:', notifId) } catch {}
    if (!res.ok) {
      return NextResponse.json({ ok: false, status: res.status, error: (json || text || null) }, { status: res.status || 500 })
    }
    return NextResponse.json({ ok: true, id: notifId }, { status: 200 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
