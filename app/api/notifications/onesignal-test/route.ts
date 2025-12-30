import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const userId = String(body.userId || '').trim()
    const playerId = String(body.playerId || '').trim()
    const title = String(body.title || 'Teste de Alerta').trim()
    const message = String(body.body || 'Notificação de teste via OneSignal').trim()
    const appId = process.env.ONESIGNAL_APP_ID || ''
  const apiKey = process.env.ONESIGNAL_API_KEY || ''
  if (!appId || !apiKey || (!userId && !playerId)) {
    return NextResponse.json({ ok: false, error: 'MISSING_CONFIG_OR_USER' }, { status: 400 })
  }
  try { console.log('[OneSignal Test] target', playerId ? { subscription_id: playerId } : { external_user_id: userId }) } catch {}
  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${apiKey}`,
      'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        ...(playerId ? { include_subscription_ids: [playerId] } : { include_external_user_ids: [userId] }),
        headings: { en: title },
        contents: { en: message },
      }),
    })
    let json: any = null
    try { json = await res.clone().json() } catch {}
    try { console.log('[OneSignal Test] response', json || (await res.text())) } catch {}
    const notifId = json?.id || null
    try { if (notifId) console.log('[OneSignal Test] notification id:', notifId) } catch {}
    return NextResponse.json({ ok: res.ok, id: notifId }, { status: res.ok ? 200 : 500 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
