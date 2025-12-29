import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any))
    const userId = String(body.userId || '').trim()
    const title = String(body.title || 'Teste de Alerta').trim()
    const message = String(body.body || 'Notificação de teste via OneSignal').trim()
    const appId = process.env.ONESIGNAL_APP_ID || ''
    const apiKey = process.env.ONESIGNAL_API_KEY || ''
    if (!appId || !apiKey || !userId) {
      return NextResponse.json({ ok: false, error: 'MISSING_CONFIG_OR_USER' }, { status: 400 })
    }
    const res = await fetch('https://api.onesignal.com/notifications', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        include_external_user_ids: [userId],
        headings: { en: title },
        contents: { en: message },
      }),
    })
    return NextResponse.json({ ok: res.ok }, { status: res.ok ? 200 : 500 })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
