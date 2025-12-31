import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

async function sendFCM(token: string, title?: string, body?: string, priority?: number, ttl?: number) {
  const key = process.env.FIREBASE_SERVER_KEY || ''
  if (!token || !key) return { ok: false }
  const res = await fetch('https://fcm.googleapis.com/fcm/send', {
    method: 'POST',
    headers: {
      'Authorization': `key=${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      to: token,
      priority: (priority && priority >= 10) ? 'high' : 'normal',
      time_to_live: typeof ttl === 'number' ? ttl : undefined,
      notification: {
        title: title || 'Nova Licitação Encontrada! 🏛️',
        body: body || 'Encontramos uma oportunidade baseada no seu perfil Premium.',
      },
    }),
  })
  return { ok: res.ok }
}

async function resolveTokenByEmailOrUserId(email?: string, userId?: string): Promise<string | null> {
  const supa = admin()
  if (!supa) return null
  let uid = (userId || '').trim()
  if (!uid && email) {
    const { data } = await supa
      .from('profiles')
      .select('id,email')
      .eq('email', String(email).trim().toLowerCase())
      .limit(1)
      .maybeSingle()
    uid = String(data?.id || '')
  }
  if (!uid) return null
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
    const title = String(body.title || '')
    const message = String(body.body || '')
    const priority = typeof body.priority === 'number' ? body.priority : undefined
    const ttl = typeof body.ttl === 'number' ? body.ttl : undefined
    if (tokenDirect) {
      const r = await sendFCM(tokenDirect, title || undefined, message || undefined, priority, ttl)
      return NextResponse.json({ ok: r.ok })
    }
    const email = String(body.email || '')
    const userId = String(body.userId || '')
    const adminToken = (req.headers.get('x-admin-token') || '').trim()
    const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
    if (!adminToken || adminToken !== expected) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    const resolved = await resolveTokenByEmailOrUserId(email, userId)
    if (!resolved) return NextResponse.json({ ok: false, error: 'TOKEN_NOT_FOUND' }, { status: 404 })
    const r = await sendFCM(resolved, title || undefined, message || undefined, priority, ttl)
    return NextResponse.json({ ok: r.ok })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}

export async function GET(req: Request) {
  try {
    const u = new URL(req.url)
    const tokenDirect = String(u.searchParams.get('token') || '')
    const title = String(u.searchParams.get('title') || '')
    const message = String(u.searchParams.get('body') || '')
    const priority = Number(u.searchParams.get('priority') || '')
    const ttl = Number(u.searchParams.get('ttl') || '')
    const pr = isFinite(priority) ? priority : undefined
    const tv = isFinite(ttl) ? ttl : undefined
    if (tokenDirect) {
      const r = await sendFCM(tokenDirect, title || undefined, message || undefined, pr, tv)
      return NextResponse.json({ ok: r.ok })
    }
    const email = String(u.searchParams.get('email') || '')
    const userId = String(u.searchParams.get('userId') || '')
    const adminToken = (req.headers.get('x-admin-token') || '').trim()
    const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
    if (!adminToken || adminToken !== expected) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    const resolved = await resolveTokenByEmailOrUserId(email, userId)
    if (!resolved) return NextResponse.json({ ok: false, error: 'TOKEN_NOT_FOUND' }, { status: 404 })
    const r = await sendFCM(resolved, title || undefined, message || undefined, pr, tv)
    return NextResponse.json({ ok: r.ok })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
