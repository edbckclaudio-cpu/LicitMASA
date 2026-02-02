import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

export async function POST(req: Request) {
  try {
    const supa = adminClient()
    if (!supa) return NextResponse.json({ ok: false, error: 'SERVICE_KEY_MISSING' }, { status: 500 })
    const token = (req.headers.get('x-admin-token') || '').trim()
    const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
    if (!token || token !== expected) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    const body = await req.json().catch(() => ({} as any))
    const userId = String(body.userId || '').trim()
    if (!userId) return NextResponse.json({ ok: false, error: 'USER_ID_REQUIRED' }, { status: 400 })
    const { data, error } = await supa.from('profiles').select('is_premium, plan').eq('id', userId).maybeSingle()
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    const premium = Boolean(data?.is_premium) || String(data?.plan || '').toLowerCase() === 'premium'
    return NextResponse.json({ ok: true, isPremium: premium, plan: data?.plan || null })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
