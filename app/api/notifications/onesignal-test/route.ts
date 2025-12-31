import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const externalId = String(body.externalId || '').trim()
    const userId = String(body.userId || '').trim()
    const playerId = String(body.playerId || '').trim()
    const title = String(body.title || 'Teste de Alerta').trim()
    const message = String(body.body || 'Notificação de teste via OneSignal').trim()
    const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '43f9ce9c-8d86-4076-a8b6-30dac8429149'
    const apiKeyRaw = (process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY || '').trim()
    const apiKey = apiKeyRaw.replace(/^(?:Key|Basic)\s+/i, '').trim()
    const keyNameUsed = process.env.ONESIGNAL_REST_API_KEY ? 'ONESIGNAL_REST_API_KEY' : (process.env.ONESIGNAL_API_KEY ? 'ONESIGNAL_API_KEY' : 'NONE')
    if (!appId || !apiKey || (!externalId && !userId && !playerId)) {
      return NextResponse.json({ ok: false, error: 'MISSING_CONFIG_OR_USER' }, { status: 400 })
    }
    const target = externalId ? { external_user_id: externalId }
      : (userId ? { external_user_id: userId } : { subscription_id: playerId })
    try {
      console.log('[OneSignal Test] endpoint https://api.onesignal.com/notifications')
      console.log('[OneSignal Test] using key env:', keyNameUsed, 'sanitized=', apiKey.length > 0)
      console.log('[OneSignal Test] app_id:', appId ? '[present]' : '[missing]')
      console.log('[OneSignal Test] target', target)
    } catch {}
    const usingAliases = !!(externalId || userId)
    const basePayload = {
      app_id: appId,
      contents: { en: message },
      headings: { en: title },
      priority: 10,
      android_visibility: 1,
      android_accent_color: 'FF0000',
      android_sound: 'default',
      vibrate: true,
      android_vibration_pattern: '200,100,200,100,200',
    } as any
    {
      const channelId = (process.env.ONESIGNAL_ANDROID_CHANNEL_ID || '').trim()
      if (channelId) (basePayload as any).android_channel_id = channelId
    }
    const requestBody = usingAliases
      ? {
          ...basePayload,
          include_external_user_ids: [externalId || userId],
        }
      : {
          ...basePayload,
          include_subscription_ids: [playerId],
        }
    const res = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Basic ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
    })
    try {
      const raw = await res.text()
      try { console.log('[OneSignal Test] status', res.status, 'ok=', res.ok) } catch {}
      try { console.log('[OneSignal Test] raw response', raw) } catch {}
      let parsed: any = null
      try { parsed = JSON.parse(raw) } catch {}
      return NextResponse.json(parsed ?? { raw }, { status: res.status || 500 })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
    }
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
