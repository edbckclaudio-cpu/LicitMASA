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
    const input = String(body.input || '').trim()
    if (!userId) return NextResponse.json({ ok: false, error: 'USER_ID_REQUIRED' }, { status: 400 })
    if (!input) return NextResponse.json({ ok: false, error: 'INPUT_REQUIRED' }, { status: 400 })

    let emailToSet: string | null = null
    try {
      const lc = input.toLowerCase()
      if (lc.includes('@') && lc.includes('.')) {
        emailToSet = input
      }
    } catch {}

    try {
      if (emailToSet) {
        await supa.from('profiles').upsert(
          { id: userId, is_premium: true, plan: 'premium', email: emailToSet },
          { onConflict: 'id' }
        )
      } else {
        await supa.from('profiles').upsert(
          { id: userId, is_premium: true, plan: 'premium' },
          { onConflict: 'id' }
        )
      }
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || 'UPSERT_FAILED' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, userId, email: emailToSet })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
