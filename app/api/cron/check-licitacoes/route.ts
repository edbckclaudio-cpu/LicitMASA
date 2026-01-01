import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchContratacoesPage, formatDateYYYYMMDD } from '@/lib/pncp'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

async function sendOneSignalBySubscriptionId(subscriptionId: string, count: number) {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '43f9ce9c-8d86-4076-a8b6-30dac8429149'
  const apiKeyRaw = (process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY || '').trim()
  const apiKey = apiKeyRaw.replace(/^(?:Key|Basic)\s+/i, '').trim()
  if (!appId || !apiKey || !subscriptionId) return { ok: false, status: 400 }
  const title = 'LicitMASA Alertas'
  const message = count > 1
    ? `Encontramos ${count} licitações hoje para suas preferências`
    : `Encontramos 1 licitação hoje para suas preferências`
  const payload: any = {
    app_id: appId,
    include_subscription_ids: [String(subscriptionId)],
    headings: { en: title, pt: title },
    contents: { en: message, pt: message },
    priority: 10,
    android_visibility: 1,
    android_sound: 'default',
    vibrate: true,
    android_vibration_pattern: '200,100,200,100,200',
    chrome_web_icon: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br'}/icons/icone_L_192.png`,
    chrome_web_image: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br'}/icons/icone_L_512.png`,
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br/',
  }
  const channelId = (process.env.ONESIGNAL_ANDROID_CHANNEL_ID || '').trim()
  if (channelId) payload.android_channel_id = channelId
  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Basic ${apiKey}` },
    body: JSON.stringify(payload),
  })
  const raw = await res.text().catch(() => null)
  let data: any = null
  try { data = raw ? JSON.parse(raw) : null } catch {}
  return { ok: res.ok, status: res.status, data: data ?? (raw ? { raw } : null) }
}

async function sendOneSignalByExternalId(externalId: string, count: number) {
  const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '43f9ce9c-8d86-4076-a8b6-30dac8429149'
  const apiKeyRaw = (process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY || '').trim()
  const apiKey = apiKeyRaw.replace(/^(?:Key|Basic)\s+/i, '').trim()
  if (!appId || !apiKey || !externalId) return { ok: false, status: 400 }
  const title = 'LicitMASA Alertas'
  const message = count > 1
    ? `Encontramos ${count} licitações hoje para suas preferências`
    : `Encontramos 1 licitação hoje para suas preferências`
  const payload: any = {
    app_id: appId,
    include_external_user_ids: [String(externalId)],
    headings: { en: title, pt: title },
    contents: { en: message, pt: message },
    priority: 10,
    android_visibility: 1,
    android_sound: 'default',
    vibrate: true,
    android_vibration_pattern: '200,100,200,100,200',
    chrome_web_icon: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br'}/icons/icone_L_192.png`,
    chrome_web_image: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br'}/icons/icone_L_512.png`,
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br/',
  }
  const channelId = (process.env.ONESIGNAL_ANDROID_CHANNEL_ID || '').trim()
  if (channelId) payload.android_channel_id = channelId
  const res = await fetch('https://api.onesignal.com/notifications', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Basic ${apiKey}` },
    body: JSON.stringify(payload),
  })
  const raw = await res.text().catch(() => null)
  let data: any = null
  try { data = raw ? JSON.parse(raw) : null } catch {}
  return { ok: res.ok, status: res.status, data: data ?? (raw ? { raw } : null) }
}

export async function GET() {
  try {
    const supa = adminClient()
    if (!supa) {
      return NextResponse.json({ ok: false, error: 'SERVICE_KEY_MISSING' }, { status: 500 })
    }
    const { data: alerts, error } = await supa
      .from('user_alerts')
      .select('id,user_id,keywords,ufs,valor_minimo,ativo')
      .eq('ativo', true)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    const userIds = (alerts || []).map((a: any) => String(a.user_id || '')).filter(Boolean)
    const { data: profs } = await supa
      .from('profiles')
      .select('id,email,is_premium,plan')
      .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000'])
    const allow = String(process.env.NEXT_PUBLIC_PREMIUM_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)
    const premiumByUser: Record<string, boolean> = {}
    for (const p of profs || []) {
      const email = String((p as any).email || '').toLowerCase()
      const premium = Boolean((p as any).is_premium) || String((p as any).plan || '').toLowerCase() === 'premium' || allow.includes(email)
      premiumByUser[String((p as any).id)] = premium
    }
    const now = new Date()
    const dataFinal = formatDateYYYYMMDD(now)
    const dataInicial = formatDateYYYYMMDD(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000))
    let processed = 0
    const out: Array<{ alert_id: string, user_id: string, found: number, push?: { ok: boolean, status: number } }> = []
    for (const alert of alerts || []) {
      const premium = premiumByUser[String((alert as any).user_id)] === true
      if (!premium) continue
      processed++
      const kws: string[] = Array.isArray((alert as any).keywords) ? (alert as any).keywords : []
      const ufs: string[] = Array.isArray((alert as any).ufs) ? (alert as any).ufs : []
      const minValue = Number((alert as any).valor_minimo || 0)
      let totalFound = 0
      const combos = (kws.length ? kws : [undefined]).flatMap((k) => (ufs.length ? ufs : [undefined]).map((u) => ({ k, u })))
      for (const combo of combos) {
        const page = await fetchContratacoesPage({
          dataInicial,
          dataFinal,
          termo: combo.k || undefined,
          uf: combo.u || undefined,
          pagina: 1,
          tamanhoPagina: 50,
        } as any)
        const items = Array.isArray((page as any).items) ? (page as any).items : Array.isArray((page as any).data) ? (page as any).data : []
        const filtered = items.filter((it: any) => {
          const v = Number(
            ([ 'valorEstimado','valorTotalEstimado','valor','valorContratacao' ] as const)
              .map((k) => (it?.[k] ?? 0))[0]
          ) || 0
          return v >= minValue
        })
        totalFound += filtered.length
      }
      let pushRes: { ok: boolean, status: number } | undefined = undefined
      if (totalFound > 0) {
        const userId = String((alert as any).user_id || '')
        let subscriptionId: string | null = null
        let externalId: string | null = null
        try {
          const { data: prof } = await supa.from('profiles').select('id,onesignal_id').eq('id', userId).limit(1).maybeSingle()
          const pid = String((prof as any)?.onesignal_id || '')
          if (pid) subscriptionId = pid
          externalId = userId
        } catch {}
        let sent: { ok: boolean, status: number } = { ok: false, status: 0 }
        if (subscriptionId) {
          const r = await sendOneSignalBySubscriptionId(subscriptionId, totalFound)
          sent = { ok: !!r.ok, status: Number(r.status || 0) }
        } else if (externalId) {
          const r = await sendOneSignalByExternalId(externalId, totalFound)
          sent = { ok: !!r.ok, status: Number(r.status || 0) }
        }
        pushRes = sent
      }
      out.push({ alert_id: String((alert as any).id), user_id: String((alert as any).user_id), found: totalFound, push: pushRes })
    }
    return NextResponse.json({ ok: true, processed, results: out })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
