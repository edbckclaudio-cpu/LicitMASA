'use server'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET(req: Request) {
  try {
    const supa = adminClient()
    if (!supa) return NextResponse.json({ ok: false, error: 'SERVICE_KEY_MISSING' }, { status: 500 })
    const { searchParams } = new URL(req.url)
    const admin = (searchParams.get('admin') || '').trim()
    const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
    if (!admin || admin !== expected) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
    const userId = String(searchParams.get('userId') || '').trim()
    const email = String(searchParams.get('email') || '').trim().toLowerCase()
    if (!userId || !email) return NextResponse.json({ ok: false, error: 'USER_ID_AND_EMAIL_REQUIRED' }, { status: 400 })
    try {
      await supa.from('profiles').upsert({ id: userId, email }, { onConflict: 'id' })
    } catch (e: any) {
      return NextResponse.json({ ok: false, error: e?.message || 'UPSERT_FAILED' }, { status: 500 })
    }
    const { data } = await supa.from('profiles').select('id,email').eq('id', userId).limit(1).maybeSingle()
    return NextResponse.json({ ok: true, data: data || null })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
