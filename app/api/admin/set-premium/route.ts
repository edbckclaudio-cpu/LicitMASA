import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}
function adminAuthSchemaClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key, { db: { schema: 'auth' } } as any)
}

export async function POST(req: Request) {
  try {
    const supa = adminClient()
    if (!supa) {
      return NextResponse.json({ ok: false, error: 'SERVICE_KEY_MISSING' }, { status: 500 })
    }
    const token = (req.headers.get('x-admin-token') || '').trim()
    const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
    if (!token || token !== expected) {
      return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    }
    const body = await req.json().catch(() => ({} as any))
    const email = String(body.email || '').trim().toLowerCase()
    if (!email) {
      return NextResponse.json({ ok: false, error: 'EMAIL_REQUIRED' }, { status: 400 })
    }
    // Find user by email via Admin API
    let userId: string | null = null
    // Try direct DB query on auth schema
    try {
      const authDb = adminAuthSchemaClient()
      if (authDb) {
        const { data } = await authDb.from('users').select('id,email').eq('email', email).limit(1).maybeSingle()
        if (data?.id) userId = String(data.id)
      }
    } catch {}
    // Fallback to Admin API pagination
    if (!userId) {
      try {
        let page = 1
        const perPage = 200
        while (page < 100 && !userId) {
          const { data, error } = await supa.auth.admin.listUsers({ page, perPage })
          if (error) break
          const found = (data?.users || []).find((u: any) => String(u?.email || '').toLowerCase() === email)
          if (found?.id) {
            userId = String(found.id)
            break
          }
          if (!data || (data.users || []).length < perPage) break
          page++
        }
      } catch {}
    }
    if (!userId) {
      const password = String(body.password || '123456')
      const { data: created, error: createErr } = await supa.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      })
      if (createErr) {
        return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 404 })
      }
      userId = String(created?.user?.id || '')
      if (!userId) {
        return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 404 })
      }
    }
    const { error: upErr } = await supa
      .from('profiles')
      .upsert({ id: userId, is_premium: true, plan: 'premium' }, { onConflict: 'id' })
    if (upErr) {
      return NextResponse.json({ ok: false, error: upErr.message }, { status: 500 })
    }
    return NextResponse.json({ ok: true, userId })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
