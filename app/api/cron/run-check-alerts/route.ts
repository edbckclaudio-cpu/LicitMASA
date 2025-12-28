import { NextResponse } from 'next/server'

function getFunctionsUrl(): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  if (!base) return null
  try {
    const u = new URL(base)
    const host = u.hostname
    const ref = host.split('.')[0]
    if (!ref) return null
    return `https://${ref}.functions.supabase.co/check-alerts`
  } catch {
    return null
  }
}

export async function GET() {
  try {
    const fn = getFunctionsUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
    if (!fn || !key) {
      return NextResponse.json({ ok: false, error: 'CONFIG_MISSING' }, { status: 500 })
    }
    const res = await fetch(fn, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    return NextResponse.json({ ok: res.ok, status: res.status, data })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
