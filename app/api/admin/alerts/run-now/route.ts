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
    const allFlag = (url.searchParams.get('all') || '').toLowerCase()
    const limitParam = Number(url.searchParams.get('limit') || '50')
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50
    let cleared: number | null = null
    let clearedTotal: number | null = null
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
    let fallbackBulk: any = null
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
      // Fallback em lote quando all=1
      if (allFlag && allFlag !== '0' && allFlag !== 'false') {
        const supa = createClient(supaUrl, serviceKey)
        const { data: users } = await supa
          .from('profiles')
          .select('id,email,subscription_id,updated_at')
          .or('is_premium.eq.true,plan.eq.premium')
          .order('updated_at', { ascending: false })
          .limit(limit)
        let okCount = 0
        let failCount = 0
        let samples: Array<{ email?: string; userId?: string; ok: boolean; status?: number; error?: string }> = []
        let clearedSum = 0
        for (const u of Array.isArray(users) ? users : []) {
          const uid = String((u as any)?.id || '')
          const em = String((u as any)?.email || '')
          if (clear === '1' && uid) {
            try {
              const pre = await supa.from('sent_alerts').select('pncp_id', { count: 'exact', head: false }).eq('user_id', uid)
              await supa.from('sent_alerts').delete().eq('user_id', uid)
              clearedSum += typeof (pre as any)?.count === 'number' ? (pre as any).count : 0
            } catch {}
          }
          try {
            const baseUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br').replace(/\/+$/, '')
            const urlTest = new URL(`${baseUrl}/api/notifications/test`)
            if (em) urlTest.searchParams.set('email', em)
            else if (uid) urlTest.searchParams.set('userId', uid)
            const r2 = await fetch(urlTest.toString(), {
              method: 'GET',
              headers: { 'x-admin-token': expected }
            })
            let t2 = ''
            try { t2 = await r2.text() } catch {}
            okCount += r2.ok ? 1 : 0
            failCount += r2.ok ? 0 : 1
            if (samples.length < 10) {
              let errMsg = ''
              if (!r2.ok) {
                try { const j = JSON.parse(t2); errMsg = JSON.stringify(j) } catch { errMsg = t2 }
              }
              samples.push({ email: em || undefined, userId: uid || undefined, ok: r2.ok, status: r2.status, error: errMsg || undefined })
            }
          } catch (e: any) {
            failCount += 1
            if (samples.length < 10) samples.push({ email: em || undefined, userId: uid || undefined, ok: false, error: e?.message || 'FALLBACK_ERROR' })
          }
        }
        fallbackBulk = { ok_count: okCount, fail_count: failCount, limit, sample: samples }
        clearedTotal = clearedSum
      }
    } catch {}
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      body: json || text || null,
      fallback_push: fallback,
      fallback_bulk: fallbackBulk,
      cleared,
      cleared_total: clearedTotal,
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
