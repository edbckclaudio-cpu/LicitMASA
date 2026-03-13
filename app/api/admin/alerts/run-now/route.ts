import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

async function handleRun(req: Request) {
  const url = new URL(req.url)
  const adminHeader = req.headers.get('x-admin-token') || ''
  const adminQuery = url.searchParams.get('admin') || ''
  const expected = process.env.ADMIN_TOKEN || 'DEV'
  if (adminHeader !== expected && adminQuery !== expected) {
    return NextResponse.json({ ok: false, error: 'UNAUTHORIZED' }, { status: 401 })
  }
  try {
    const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ''
    const serviceKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_API_KEY ||
      process.env.SERVICE_ROLE_KEY ||
      ''
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
    const userId = url.searchParams.get('userId') || ''
    const email = url.searchParams.get('email') || ''
    const preview = url.searchParams.get('preview') || ''
    const clear = url.searchParams.get('clear') || ''
    let cleared: number | null = null
    if (clear === '1' && (email || userId)) {
      const supa = createClient(supaUrl, serviceKey)
      let uid = userId
      if (!uid && email) {
        const q = await supa.from('profiles').select('id').eq('email', String(email).trim().toLowerCase()).limit(1).maybeSingle()
        uid = String(q?.data?.id || '')
      }
      if (uid) {
        const pre = await supa.from('sent_alerts').select('pncp_id', { count: 'exact', head: false }).eq('user_id', uid)
        await supa.from('sent_alerts').delete().eq('user_id', uid)
        cleared = typeof pre.count === 'number' ? pre.count : null
      }
    }
    const qs = new URLSearchParams()
    if (userId) qs.set('userId', userId)
    if (email) qs.set('email', email)
    if (preview === '1') qs.set('preview', '1')
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
    let fallback: any = null
    try {
      if (email || userId) {
        const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br').replace(/\/+$/, '')
        const urlTest = new URL(`${baseUrl}/api/notifications/test`)
        if (email) urlTest.searchParams.set('email', email)
        if (userId) urlTest.searchParams.set('userId', userId)
        const r2 = await fetch(urlTest.toString(), {
          method: 'GET',
          headers: { 'x-admin-token': expected }
        })
        const t2 = await r2.text()
        let j2: any = null
        try { j2 = JSON.parse(t2) } catch {}
        fallback = { ok: r2.ok, status: r2.status, body: j2 || t2 || null }
      }
    } catch {}
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      body: json || text || null,
      fallback_push: fallback,
      cleared,
      function_url: fnUrl.replace(projectRef, projectRef.slice(0, 3) + '...' + projectRef.slice(-3)),
    }, { status: res.ok ? 200 : 500 })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'TRIGGER_FAILED' }, { status: 500 })
  }
}

export async function POST(req: Request) {
  return handleRun(req)
}
export async function GET(req: Request) {
  return handleRun(req)
}
