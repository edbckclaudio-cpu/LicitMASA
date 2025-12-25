import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

export async function POST(req: Request) {
  try {
    const supa = admin()
    if (!supa) return NextResponse.json({ ok: false, error: 'ADMIN_NOT_CONFIGURED' }, { status: 500 })
    const token = (req.headers.get('x-admin-token') || '').trim()
    const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
    if (!token || token !== expected) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    const body = await req.json().catch(() => ({} as any))
    const email = String(body.email || 'kushida1@hotmail.com')
    const password = String(body.password || '123456')
    const { data, error } = await supa.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) {
      const invited = await supa.auth.admin.inviteUserByEmail(email).catch(() => ({ data: null as any }))
      const userIdInv = invited?.data?.user?.id
      if (!userIdInv) return NextResponse.json({ ok: false, error: error.message }, { status: 400 })
      await supa.from('profiles').upsert({ id: userIdInv, is_premium: true, plan: 'premium' }, { onConflict: 'id' })
      return NextResponse.json({ ok: true, userId: userIdInv, invited: true })
    }
    const userId = data.user?.id
    if (!userId) return NextResponse.json({ ok: false, error: 'NO_USER_ID' }, { status: 400 })
    await supa.from('profiles').upsert({ id: userId, is_premium: true, plan: 'premium' }, { onConflict: 'id' })
    return NextResponse.json({ ok: true, userId })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
