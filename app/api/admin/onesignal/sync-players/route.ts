import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

async function listPlayers(pageSize: number, page: number) {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '43f9ce9c-8d86-4076-a8b6-30dac8429149'
  const apiKeyRaw = (process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY || '').trim()
  const apiKey = apiKeyRaw.replace(/^(?:Key|Basic)\s+/i, '').trim()
  if (!appId || !apiKey) return { ok: false, players: [], error: 'ONESIGNAL_CONFIG_MISSING' }
  const url = `https://api.onesignal.com/players?app_id=${encodeURIComponent(appId)}&limit=${pageSize}&offset=${page * pageSize}`
  const res = await fetch(url, { method: 'GET', headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': `Basic ${apiKey}` } })
  const json: any = await res.json().catch(() => null)
  const players: any[] = Array.isArray(json?.players) ? json.players : []
  return { ok: res.ok, players, error: res.ok ? null : (json?.errors || 'ONESIGNAL_PLAYERS_ERROR') }
}

export async function GET(req: Request) {
  try {
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
    const auth = createClient(supaUrl, serviceKey, { db: { schema: 'auth' } } as any)

    const pageSize = Math.min(Math.max(Number(url.searchParams.get('pageSize') || '50'), 1), 200)
    const maxPages = Math.min(Math.max(Number(url.searchParams.get('maxPages') || '4'), 1), 20)
    const dryRun = ((url.searchParams.get('dry') || url.searchParams.get('dryRun') || '').toLowerCase() === '1')

    let updated = 0
    let inserted = 0
    let skipped = 0
    const sample: Array<{ email?: string; playerId?: string; action: 'update' | 'insert' | 'skip'; reason?: string }> = []

    for (let page = 0; page < maxPages; page++) {
      const lp = await listPlayers(pageSize, page)
      if (!lp.ok) {
        return NextResponse.json({ ok: false, error: lp.error || 'ONESIGNAL_LIST_ERROR', page }, { status: 500 })
      }
      if (!lp.players.length) break
      for (const p of lp.players) {
        const pid = String(p?.id || '')
        const email = String(p?.external_user_id || '')
        const invalid = Boolean(p?.invalid_identifier || p?.invalidated)
        const enabled = typeof p?.enabled === 'boolean' ? p.enabled : true
        if (!pid || !email || !/@/.test(email) || invalid || !enabled) {
          skipped++
          if (sample.length < 10) sample.push({ email, playerId: pid, action: 'skip', reason: 'invalid_or_no_email' })
          continue
        }
        try {
          const sel = await supa.from('profiles').select('id,subscription_id').eq('email', email.toLowerCase()).limit(1).maybeSingle()
          const has = sel?.data?.id ? String(sel.data.id) : ''
          if (has) {
            if (!dryRun) {
              await supa.from('profiles').update({ subscription_id: pid }).eq('id', has)
            }
            updated++
            if (sample.length < 10) sample.push({ email, playerId: pid, action: 'update' })
          } else {
            let authId = ''
            try {
              const au = await auth.from('users').select('id,email').eq('email', email.toLowerCase()).limit(1).maybeSingle()
              authId = String(au?.data?.id || '')
            } catch {}
            if (authId) {
              if (!dryRun) {
                await supa.from('profiles').upsert({ id: authId, email: email.toLowerCase(), subscription_id: pid }, { onConflict: 'id' })
              }
              inserted++
              if (sample.length < 10) sample.push({ email, playerId: pid, action: 'insert' })
            } else {
              // Sem auth.user correspondente — não inserimos novo profile sem id
              skipped++
              if (sample.length < 10) sample.push({ email, playerId: pid, action: 'skip', reason: 'no_profile_and_no_auth_user' })
            }
          }
        } catch (e: any) {
          skipped++
          if (sample.length < 10) sample.push({ email, playerId: pid, action: 'skip', reason: e?.message || 'update_error' })
        }
      }
      if (lp.players.length < pageSize) break
    }

    return NextResponse.json({ ok: true, updated, inserted, skipped, pageSize, maxPages, dryRun, sample })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
