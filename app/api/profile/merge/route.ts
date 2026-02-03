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
    const email = String(body.email || '').trim().toLowerCase()
    if (!userId || !email) return NextResponse.json({ ok: false, error: 'USER_ID_AND_EMAIL_REQUIRED' }, { status: 400 })

    const { data: byId } = await supa
      .from('profiles')
      .select('id, is_premium, plan, email')
      .eq('id', userId)
      .limit(1)
      .maybeSingle()

    const { data: byEmail } = await supa
      .from('profiles')
      .select('id, is_premium, plan, email')
      .eq('email', email)
      .limit(1)
      .maybeSingle()

    const isPremId = Boolean(byId?.is_premium) || String(byId?.plan || '').toLowerCase() === 'premium'
    const isPremEmail = Boolean(byEmail?.is_premium) || String(byEmail?.plan || '').toLowerCase() === 'premium'

    if (isPremEmail && !isPremId) {
      try {
        await supa
          .from('profiles')
          .update({ is_premium: true, plan: 'premium', email })
          .eq('id', userId)
      } catch {}
      if (byEmail?.id && byEmail.id !== userId) {
        try {
          await supa.from('profiles').delete().eq('id', byEmail.id)
        } catch {}
      }
    } else {
      if (byId && !byId.email && email) {
        try {
          await supa.from('profiles').update({ email }).eq('id', userId)
        } catch {}
      }
    }

    const { data: final } = await supa
      .from('profiles')
      .select('is_premium, plan, email')
      .eq('id', userId)
      .limit(1)
      .maybeSingle()
    const premium = Boolean(final?.is_premium) || String(final?.plan || '').toLowerCase() === 'premium'
    return NextResponse.json({ ok: true, isPremium: premium, email: final?.email ?? null })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
