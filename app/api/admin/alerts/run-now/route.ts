import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const adminHeader = req.headers.get('x-admin-token') || ''
  const expected = process.env.ADMIN_TOKEN || 'DEV'
  if (adminHeader !== expected) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const supaUrl = process.env.SUPABASE_URL || ''
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || ''
    if (!supaUrl || !serviceKey) {
      return NextResponse.json({ ok: false, error: 'MISSING_SUPABASE_ENV' }, { status: 500 })
    }
    let projectRef = ''
    try {
      const u = new URL(supaUrl)
      projectRef = u.hostname.split('.')[0] || ''
    } catch {}
    if (!projectRef) {
      return NextResponse.json({ ok: false, error: 'INVALID_SUPABASE_URL' }, { status: 500 })
    }
    const { searchParams } = new URL(req.url)
    const userId = searchParams.get('userId') || ''
    const email = searchParams.get('email') || ''
    const qs = new URLSearchParams()
    if (userId) qs.set('userId', userId)
    if (email) qs.set('email', email)
    const fnUrl = `https://${projectRef}.functions.supabase.co/check-alerts${qs.toString() ? `?${qs.toString()}` : ''}`
    const res = await fetch(fnUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${serviceKey}`,
        'apikey': serviceKey,
        'accept': 'application/json',
      }
    })
    const text = await res.text()
    let json: any = null
    try { json = JSON.parse(text) } catch {}
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      body: json || text || null,
      function_url: fnUrl.replace(projectRef, projectRef.slice(0, 3) + '...' + projectRef.slice(-3)),
    }, { status: res.ok ? 200 : 500 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'TRIGGER_FAILED' }, { status: 500 })
  }
}

