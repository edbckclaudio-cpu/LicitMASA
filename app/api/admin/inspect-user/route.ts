import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_API_KEY || process.env.SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}
function adminAuthSchemaClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_API_KEY || process.env.SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key, { db: { schema: 'auth' } } as any)
}

export async function GET(req: Request) {
  try {
    const supa = adminClient()
    if (!supa) return NextResponse.json({ ok: false, error: 'SERVICE_KEY_MISSING' }, { status: 500 })
    const url = new URL(req.url)
    const token = (req.headers.get('x-admin-token') || url.searchParams.get('admin') || '').trim()
    const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
    if (!token || token !== expected) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    const email = String(url.searchParams.get('email') || '').trim().toLowerCase()
    const q = String(url.searchParams.get('q') || '').trim().toLowerCase()
    if (!email && !q) return NextResponse.json({ ok: false, error: 'EMAIL_OR_QUERY_REQUIRED' }, { status: 400 })
    let userId: string | null = null
    let profile: any = null
    if (email) {
    const { data } = await supa.from('profiles').select('id,email,subscription_id,onesignal_id').eq('email', email).limit(1).maybeSingle()
      if (data?.id) {
        userId = String(data.id)
        profile = data
      }
    }
    if (!userId && q) {
    const { data } = await supa.from('profiles').select('id,email,subscription_id,onesignal_id').ilike('email', `%${q}%`).limit(1)
      if (data && data[0]?.id) {
        userId = String(data[0].id)
        profile = data[0]
      }
    }
    if (!userId && email) {
      try {
        const r = await supa.auth.admin.listUsers({ page: 1, perPage: 1000 } as any)
        const u = Array.isArray(r?.data?.users) ? r.data.users.find((x: any) => String(x?.email || '').toLowerCase() === email) : null
      if (u?.id) {
        userId = String(u.id)
        try { await supa.from('profiles').upsert({ id: userId, email }, { onConflict: 'id' }) } catch {}
        try {
          const { data } = await supa.from('profiles').select('id,email,subscription_id,onesignal_id').eq('id', userId).limit(1).maybeSingle()
          profile = data || null
        } catch {}
      }
      } catch {}
    }
    if (!userId) return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 404 })
    if (!profile) {
    const { data } = await supa.from('profiles').select('id,email,subscription_id,onesignal_id').eq('id', userId).limit(1).maybeSingle()
      profile = data || null
    }
    const { data: sAlerts, error: sErr } = await supa.from('search_alerts').select('id,keyword,uf,active,created_at').eq('user_id', userId).order('created_at', { ascending: false })
    const { data: uAlerts } = await supa.from('user_alerts').select('keywords,ufs,fcm_token,ativo,push_notificacao,updated_at').eq('user_id', userId).limit(1).maybeSingle()
    return NextResponse.json({
      ok: true,
      userId,
      profile: profile || null,
      search_alerts: sAlerts || [],
      user_alerts: uAlerts || null,
      fallback_used: Boolean(!sAlerts || (Array.isArray(sAlerts) && sAlerts.length === 0)),
      select_error: sErr ? String(sErr.message || 'SELECT_ERROR') : null
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const supa = adminClient()
    if (!supa) return NextResponse.json({ ok: false, error: 'SERVICE_KEY_MISSING' }, { status: 500 })
    const url = new URL(req.url)
    const token = (req.headers.get('x-admin-token') || url.searchParams.get('admin') || '').trim()
    const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
    if (!token || token !== expected) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    const body = await req.json().catch(() => ({}))
    const emailRaw = String(body?.email || '').trim().toLowerCase()
    if (!emailRaw) return NextResponse.json({ ok: false, error: 'EMAIL_REQUIRED' }, { status: 400 })
    let uid: string | null = null
    try {
      const r = await supa.auth.admin.listUsers({ page: 1, perPage: 1000 } as any)
      const u = Array.isArray(r?.data?.users) ? r.data.users.find((x: any) => String(x?.email || '').toLowerCase() === emailRaw) : null
      if (u?.id) uid = String(u.id)
    } catch {}
    if (!uid) return NextResponse.json({ ok: false, error: 'USER_NOT_FOUND' }, { status: 404 })
    await supa.from('profiles').upsert({ id: uid, email: emailRaw }, { onConflict: 'id' })
    const { data: prof } = await supa.from('profiles').select('id,email,subscription_id,onesignal_id,updated_at').eq('id', uid).maybeSingle()
    return NextResponse.json({ ok: true, userId: uid, profile: prof || null })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
