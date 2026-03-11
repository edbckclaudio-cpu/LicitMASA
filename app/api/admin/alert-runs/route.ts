import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(req: Request) {
  try {
    const supa = adminClient()
    if (!supa) return NextResponse.json({ ok: false, error: 'SERVICE_KEY_MISSING' }, { status: 500 })
    const token = (req.headers.get('x-admin-token') || '').trim()
    const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
    if (!token || token !== expected) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    const u = new URL(req.url)
    const userId = String(u.searchParams.get('userId') || '').trim()
    const email = String(u.searchParams.get('email') || '').trim()
    const q = String(u.searchParams.get('q') || '').trim()
    let uid = userId
    if (!uid) {
      if (email) {
        const { data: prof } = await supa.from('profiles').select('id,email,updated_at').eq('email', email).order('updated_at', { ascending: false }).limit(1).maybeSingle()
        uid = String((prof as any)?.id || '')
      } else if (q) {
        const { data: profs } = await supa.from('profiles').select('id,email,updated_at').ilike('email', `%${q}%`).order('updated_at', { ascending: false }).limit(5)
        uid = String((profs && profs[0] && (profs[0] as any).id) || '')
      }
    }
    if (!uid) return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 404 })
    const { data, error } = await supa
      .from('alert_runs')
      .select('created_at,keyword,uf,found_count,notified_count,channel,error')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, userId: uid, rows: data || [] })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}

