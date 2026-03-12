import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function userClient(accessToken: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  if (!url || !anon || !accessToken) return null
  const supa = createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  } as any)
  return supa
}
function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_API_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

export async function POST(req: Request) {
  try {
    const auth = req.headers.get('authorization') || req.headers.get('Authorization') || ''
    const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : ''
    if (!token) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    const body = await req.json().catch(() => ({} as any))
    const subscriptionId = String(body?.subscriptionId || body?.onesignalId || '').trim()
    if (!subscriptionId) return NextResponse.json({ ok: false, error: 'SUBSCRIPTION_ID_REQUIRED' }, { status: 400 })
    const uc = userClient(token)
    if (!uc) return NextResponse.json({ ok: false, error: 'INVALID_CLIENT' }, { status: 401 })
    const { data: userRes, error: userErr } = await uc.auth.getUser(token as any)
    if (userErr || !userRes?.user?.id) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    const uid = String(userRes.user.id)
    const admin = adminClient()
    if (!admin) return NextResponse.json({ ok: false, error: 'SERVICE_KEY_MISSING' }, { status: 500 })
    try {
      await admin.from('profiles').upsert({ id: uid }, { onConflict: 'id' })
    } catch {}
    const { error: updErr } = await admin.from('profiles').update({ subscription_id: subscriptionId }).eq('id', uid)
    if (updErr) return NextResponse.json({ ok: false, error: updErr.message || 'UPDATE_FAILED' }, { status: 400 })
    const { data: prof } = await admin.from('profiles').select('id,email,subscription_id').eq('id', uid).limit(1).maybeSingle()
    return NextResponse.json({ ok: true, profile: prof || null })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
