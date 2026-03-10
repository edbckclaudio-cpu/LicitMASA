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

export async function GET(req: Request) {
  try {
    const fn = getFunctionsUrl()
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY || ''
    if (!fn || !key) {
      return NextResponse.json({ ok: false, error: 'CONFIG_MISSING' }, { status: 500 })
    }
    try {
      const preview = String(key).slice(0, 4)
      const inUrl = new URL(req.url)
      const target = inUrl.search ? `${fn}${inUrl.search}` : fn
      console.log('[cron/run-check-alerts] calling:', target)
      console.log('[cron/run-check-alerts] key prefix:', preview)
    } catch {}
    const inUrl = new URL(req.url)
    const target = inUrl.search ? `${fn}${inUrl.search}` : fn
    const res = await fetch(target, {
      method: 'GET',
      headers: { Authorization: `Bearer ${key}` },
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({} as any))
    let onesignal: any = null
    let onesignal_debug: any = null
    const rawKey = process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY || ''
    const rawAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || process.env.ONESIGNAL_APP_ID || ''
    const sk = String(rawKey).trim()
    const sa = String(rawAppId).trim()
    const ssk = sk.replace(/^['"]|['"]$/g, '')
    const ssa = sa.replace(/^['"]|['"]$/g, '')
    let masked_key = ssk ? `${ssk.slice(0, 4)}...${ssk.slice(-4)}` : ''
    let masked_app_id = ssa ? `${ssa.slice(0, 4)}...${ssa.slice(-4)}` : ''
    try {
      const fnMaskedKey =
        (data as any)?.data?.masked_key_used ||
        (data as any)?.data?.masked_key ||
        (data as any)?.masked_key ||
        ''
      const fnMaskedApp =
        (data as any)?.data?.masked_app_id ||
        (data as any)?.masked_app_id ||
        ''
      if (fnMaskedKey) masked_key = String(fnMaskedKey)
      if (fnMaskedApp) masked_app_id = String(fnMaskedApp)
    } catch {}
    try {
      if (data && typeof data === 'object') {
        if (data.body || data.json) {
          onesignal = { body: data.body || null, json: data.json || null, status: data.status || null }
        } else if (data.onesignal) {
          onesignal = data.onesignal
        } else if (data.data && (data.data.body || data.data.json || data.data.onesignal)) {
          onesignal = data.data.onesignal || { body: data.data.body || null, json: data.data.json || null, status: data.data.status || null }
        }
        if ((data as any).onesignal_debug) {
          onesignal_debug = (data as any).onesignal_debug
        } else if ((data as any).data && (data as any).data.onesignal_debug) {
          onesignal_debug = (data as any).data.onesignal_debug
        }
      }
    } catch {}
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      function_ok: (data as any)?.ok ?? null,
      onesignal,
      onesignal_debug: onesignal_debug || null,
      masked_key,
      masked_app_id,
      sanitized_key: sk !== ssk,
      sanitized_app_id: sa !== ssa,
      data
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
