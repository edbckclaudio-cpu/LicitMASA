import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const token = (url.searchParams.get('admin') || req.headers.get('x-admin-token') || '').trim()
  const expected = (process.env.ADMIN_TOKEN || 'DEV').trim()
  if (!token || token !== expected) return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_API_KEY ||
    process.env.SERVICE_ROLE_KEY ||
    ''
  if (!supaUrl || !serviceKey) return NextResponse.json({ ok: false, error: 'MISSING_SUPABASE_ENV' }, { status: 500 })
  const supa = createClient(supaUrl, serviceKey)
  try {
    const countRes = await supa
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .not('subscription_id', 'is', null)
      .neq('subscription_id', '')
    const listRes = await supa
      .from('profiles')
      .select('id,email,subscription_id,updated_at')
      .order('updated_at', { ascending: false })
      .limit(20)
    const items = (Array.isArray(listRes?.data) ? listRes.data : []).filter((u: any) => {
      try { return Boolean(String(u?.subscription_id ?? '').trim()) } catch { return false }
    })
    return NextResponse.json({
      ok: true,
      any_with_token: typeof (countRes as any)?.count === 'number' ? (countRes as any).count : null,
      sample: items.map((u: any) => ({ id: u?.id, email: u?.email, sub: String(u?.subscription_id).slice(0, 8) + '…' })),
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'QUERY_ERROR' }, { status: 500 })
  }
}
