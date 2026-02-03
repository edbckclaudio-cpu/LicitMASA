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
    if (!supa) return NextResponse.json({ ok: false, error: 'ERRO: CHAVE DE ADMIN AUSENTE' }, { status: 500 })
    const body = await req.json().catch(() => ({} as any))
    const userId = String(body.userId || '').trim()
    if (!userId) return NextResponse.json({ ok: false, error: 'USER_ID_REQUIRED' }, { status: 400 })
    const { error } = await supa
      .from('profiles')
      .upsert({ id: userId, is_premium: true, plan: 'debug_test' }, { onConflict: 'id' })
    if (error) return NextResponse.json({ ok: false, error: error.message, details: error }, { status: 400 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
