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
    async function sendOneSignalDirect(subId: string | null, externalId: string | null) {
      const appId = process.env.ONESIGNAL_APP_ID || process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '43f9ce9c-8d86-4076-a8b6-30dac8429149'
      const apiKeyRaw = (process.env.ONESIGNAL_REST_API_KEY || process.env.ONESIGNAL_API_KEY || '').trim()
      const apiKey = apiKeyRaw.replace(/^(?:Key|Basic)\s+/i, '').trim()
      if (!appId || !apiKey || (!subId && !externalId)) return { ok: false, status: 400, data: { error: 'MISSING_DATA' } }
      const base: any = {
        app_id: appId,
        headings: { pt: 'Teste de Alerta', en: 'Alert Test' },
        contents: { pt: 'Notificação de teste via OneSignal', en: 'Test notification via OneSignal' },
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
      if (channelId) (base as any).android_channel_id = channelId
      const payload = subId ? { ...base, include_subscription_ids: [String(subId)] } : { ...base, include_external_user_ids: [String(externalId)] }
      const r = await fetch('https://api.onesignal.com/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', 'Authorization': `Basic ${apiKey}` },
        body: JSON.stringify(payload),
      })
      let raw: string | null = null
      try { raw = await r.text() } catch {}
      let j: any = null
      try { j = raw ? JSON.parse(raw) : null } catch {}
      return { ok: r.ok, status: r.status, data: j ?? (raw ? { raw } : null) }
    }
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
    const anyFlag = (url.searchParams.get('any') || '').toLowerCase()
    const limitParam = Number(url.searchParams.get('limit') || '50')
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 200) : 50
    const skipFn = ((url.searchParams.get('skipFn') || '').toLowerCase() === '1')
    const notifyAdmin = ((url.searchParams.get('notifyAdmin') || '').toLowerCase() === '1')
    const adminTargetsRaw = String(url.searchParams.get('adminTargets') || process.env.ADMIN_NOTIFY_EMAILS || '').trim()
    const adminTargets = adminTargetsRaw.split(',').map((s) => s.trim()).filter(Boolean)
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
    let resOk = true
    let resStatus = 200
    let json: any = null
    let text: string | null = null
    if (!skipFn) {
      const res = await fetch(fnUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${serviceKey}`,
          'apikey': serviceKey,
          'accept': 'application/json',
        }
      })
      resOk = res.ok
      resStatus = res.status
      text = await res.text()
      try { json = JSON.parse(text) } catch {}
    }
    let fallback: any = null
    let fallbackBulk: any = null
    try {
      if (email || userId) {
        let subId: string | null = null
        let ext: string | null = null
        try {
          const supa = createClient(supaUrl, serviceKey)
          let uid = userId
          if (!uid && email) {
            const q = await supa.from('profiles').select('id,subscription_id').eq('email', String(email).trim().toLowerCase()).limit(1).maybeSingle()
            uid = String(q?.data?.id || '')
            subId = String((q?.data as any)?.subscription_id || '') || null
          }
          if (uid && !subId) {
            const p = await supa.from('profiles').select('subscription_id').eq('id', uid).limit(1).maybeSingle()
            subId = String((p?.data as any)?.subscription_id || '') || null
          }
          ext = String(email || userId || '') || null
        } catch {}
        const sendRes = await sendOneSignalDirect(subId, ext)
        fallback = { ok: sendRes.ok, status: sendRes.status, body: sendRes.data }
      }
      // Fallback em lote quando all=1 (premium) ou any=1 (qualquer perfil com subscription_id)
      if ((allFlag && allFlag !== '0' && allFlag !== 'false') || (anyFlag && anyFlag !== '0' && anyFlag !== 'false')) {
        const supa = createClient(supaUrl, serviceKey)
        let users: any[] = []
        if (anyFlag && anyFlag !== '0' && anyFlag !== 'false') {
          const q = await supa
            .from('profiles')
            .select('id,email,subscription_id,updated_at')
            .not('subscription_id', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(limit)
          users = Array.isArray(q?.data) ? q.data : []
        } else {
          const q = await supa
            .from('profiles')
            .select('id,email,subscription_id,updated_at')
            .or('is_premium.eq.true,plan.eq.premium')
            .not('subscription_id', 'is', null)
            .order('updated_at', { ascending: false })
            .limit(limit)
          users = Array.isArray(q?.data) ? q.data : []
        }
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
            const sub = String((u as any)?.subscription_id || '') || null
            const ext = em || uid || null
            const r2 = await sendOneSignalDirect(sub, ext)
            okCount += r2.ok ? 1 : 0
            failCount += r2.ok ? 0 : 1
            if (samples.length < 10) {
              let errMsg = ''
              if (!r2.ok) {
                try { errMsg = JSON.stringify(r2.data || {}) } catch { errMsg = '' }
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
    // Notificar administradores se solicitado e houver entregas
    try {
      const notifiedCount = Number((json && (json as any).notified) || 0)
      if (notifyAdmin && notifiedCount > 0 && adminTargets.length) {
        for (const t of adminTargets) {
          try {
            await sendOneSignalDirect(null, t)
          } catch {}
        }
      }
    } catch {}
    return NextResponse.json({
      ok: resOk,
      status: resStatus,
      body: json || text || null,
      fallback_push: fallback,
      fallback_bulk: fallbackBulk,
      cleared,
      cleared_total: clearedTotal,
      function_url: fnUrl.replace(projectRef, projectRef.slice(0, 3) + '...' + projectRef.slice(-3)),
    }, { status: resOk ? 200 : 500 })
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
