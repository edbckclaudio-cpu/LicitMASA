import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const token = String(body.token || '')
    const key = process.env.FIREBASE_SERVER_KEY || ''
    if (!token || !key) return NextResponse.json({ ok: false }, { status: 400 })
    const res = await fetch('https://fcm.googleapis.com/fcm/send', {
      method: 'POST',
      headers: {
        'Authorization': `key=${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: token,
        notification: {
          title: 'Nova Licitação Encontrada! 🏛️',
          body: 'Encontramos uma oportunidade baseada no seu perfil Premium.',
        },
      }),
    })
    return NextResponse.json({ ok: res.ok })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
