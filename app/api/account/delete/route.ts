'use server'
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
    const userId = String(body.userId || '')
    if (!userId) return NextResponse.json({ ok: false, error: 'USER_ID_REQUIRED' }, { status: 400 })
    try {
      await supa.from('user_favorites').delete().eq('user_id', userId)
    } catch {}
    try {
      await supa.from('search_alerts').delete().eq('user_id', userId)
    } catch {}
    try {
      await supa.from('user_alerts').delete().eq('user_id', userId)
    } catch {}
    try {
      await supa.from('user_certificates').delete().eq('user_id', userId)
    } catch {}
    try {
      await supa.from('profiles').delete().eq('id', userId)
    } catch {}
    try {
      const { error } = await supa.auth.admin.deleteUser(userId)
      if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || 'DELETE_USER_FAILED' }, { status: 500 })
    }
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}

