import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

function fmt(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${dd}`
}

async function fetchPNCP(params: { termo?: string; uf?: string; dataInicial: string; dataFinal: string }) {
  const base = "https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao"
  const url = new URL(base)
  url.searchParams.set("dataInicial", params.dataInicial)
  url.searchParams.set("dataFinal", params.dataFinal)
  if (params.uf) url.searchParams.set("uf", params.uf)
  if (params.termo) url.searchParams.set("termo", params.termo)
  url.searchParams.set("pagina", "1")
  url.searchParams.set("tamanhoPagina", "50")
  const res = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) LicitMASA/1.0",
      "x-requested-with": "XMLHttpRequest",
    }
  })
  if (!res.ok) return []
  const json = await res.json()
  if (Array.isArray(json)) return json
  if (json?.content && Array.isArray(json.content)) return json.content
  if (json?.items && Array.isArray(json.items)) return json.items
  if (json?.data && Array.isArray(json.data)) return json.data
  return []
}

function pick(o: any, keys: string[], fallback?: any) {
  for (const k of keys) {
    if (o && o[k] !== undefined && o[k] !== null) return o[k]
  }
  return fallback
}

function currencyBRL(v: any) {
  const n = Number(v || 0)
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
  } catch {
    return `R$ ${n.toFixed(2)}`
  }
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY")
  if (!key) return { ok: false }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "licitmasa_suporte@proton.me",
      to,
      subject,
      html,
    }),
  })
  return { ok: res.ok }
}

async function sendPush(externalUserId: string, subject: string, message: string, url?: string) {
  const appId = Deno.env.get("ONESIGNAL_APP_ID")
  const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY") || Deno.env.get("ONESIGNAL_API_KEY") || ""
  const supaUrl = Deno.env.get("SUPABASE_URL") || ""
  const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || ""
  if (!appId || !apiKey || !externalUserId) return { ok: false }
  async function validateSubscriptionId(id: string): Promise<boolean> {
    try {
      const res = await fetch(`https://api.onesignal.com/apps/${appId}/subscriptions/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: { "Authorization": `Basic ${apiKey}` }
      })
      return res.ok
    } catch {
      return false
    }
  }
  const requestBase: any = {
    app_id: appId,
    headings: { en: subject },
    contents: { en: message },
    url: url || "https://pncp.gov.br/",
  }
  let body: any = { ...requestBase, include_external_user_ids: [externalUserId] }
  if (supaUrl && supaKey) {
    try {
      const supa = createClient(supaUrl, supaKey)
      const { data: prof } = await supa.from("profiles").select("onesignal_id").eq("id", externalUserId).limit(1).maybeSingle()
      const subId = String((prof as any)?.onesignal_id || "")
      if (!subId) {
        const { data: ua } = await supa.from("user_alerts").select("fcm_token").eq("user_id", externalUserId).limit(1).maybeSingle()
        const tok = String((ua as any)?.fcm_token || "")
        if (tok && await validateSubscriptionId(tok)) {
          body = { ...requestBase, include_subscription_ids: [tok] }
        } else {
          body = { ...requestBase, include_external_user_ids: [externalUserId] }
        }
      } else {
        if (await validateSubscriptionId(subId)) {
          body = { ...requestBase, include_subscription_ids: [subId] }
        } else {
          const { data: ua } = await supa.from("user_alerts").select("fcm_token").eq("user_id", externalUserId).limit(1).maybeSingle()
          const tok = String((ua as any)?.fcm_token || "")
          if (tok && await validateSubscriptionId(tok)) {
            body = { ...requestBase, include_subscription_ids: [tok] }
          } else {
            body = { ...requestBase, include_external_user_ids: [externalUserId] }
          }
        }
      }
    } catch {}
  }
  const res = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Authorization": `Basic ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  })
  return { ok: res.ok }
}

function daysUntil(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const ms = d.getTime() - base.getTime()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

serve(async (req: Request) => {
  const url = Deno.env.get("SUPABASE_URL") || ""
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || ""
  const supabase = createClient(url, key)
  const now = new Date()
  const reqUrl = new URL(req.url)
  const testMode = reqUrl.searchParams.get("test") === "1"
  if (testMode) {
    try {
      const appId = Deno.env.get("ONESIGNAL_APP_ID") || ""
      const apiKey = Deno.env.get("ONESIGNAL_REST_API_KEY") || Deno.env.get("ONESIGNAL_API_KEY") || ""
      const override = reqUrl.searchParams.get("sub") || ""
      const testId = override || "8e7fd9b6-3ca2-4d4d-9a0b-9ba41be05d9d"
      const body = {
        app_id: appId,
        headings: { en: "Teste de Conexão LicitMASA" },
        contents: { en: "Teste de push direto via OneSignal" },
        include_subscription_ids: [testId],
        url: "https://pncp.gov.br/"
      }
      const res = await fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: { "Authorization": `Basic ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      const txt = await res.text()
      let parsed: any = null
      try { parsed = JSON.parse(txt) } catch {}
      try { console.log("OneSignal test status:", res.status) } catch {}
      try { console.log("OneSignal test body:", txt) } catch {}
      if (parsed) { try { console.log("OneSignal test json:", JSON.stringify(parsed)) } catch {} }
      const topError = (!res.ok) ? (parsed?.errors || parsed || txt || "ONESIGNAL_ERROR") : (parsed?.errors ? parsed.errors : null)
      return new Response(JSON.stringify({
        ok: "TESTE_FINAL_AGORA",
        status: res.status,
        error: topError ?? null,
        onesignal_json: parsed || null,
        onesignal_debug: parsed || txt,
        body: parsed || txt
      }), { headers: { "Content-Type": "application/json" } })
    } catch (e) {
      return new Response(JSON.stringify({ ok: "TESTE_FINAL_AGORA", error: e?.message || "TEST_FAILED" }), { status: 500 })
    }
  }
  const dataFinal = fmt(now)
  const dataInicial = fmt(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000))
  // 1) Fonte principal: search_alerts (por item), apenas premium
  const { data: alerts, error } = await supabase
    .from("search_alerts")
    .select("id,user_id,keyword,uf,active,profiles!inner(email,is_premium)")
    .eq("active", true)
    .eq("profiles.is_premium", true)
  if (error) return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })
  let allAlerts: Array<{ id?: string; user_id: string; keyword: string; uf?: string | null }> = []
  if (Array.isArray(alerts) && alerts.length > 0) {
    allAlerts = alerts.map((a: any) => ({ id: String(a.id), user_id: String(a.user_id), keyword: String(a.keyword || ""), uf: a.uf || null }))
  } else {
    // 2) Fallback: user_alerts (palavras/ufs) para compatibilidade, apenas premium
    try {
      const { data: prefs } = await supabase
        .from("user_alerts")
        .select("user_id, keywords, ufs, ativo, push_notificacao")
        .eq("ativo", true)
        .eq("push_notificacao", true)
      const userIds = Array.from(new Set((prefs || []).map((p: any) => String(p.user_id))))
      if (userIds.length > 0) {
        const { data: prem } = await supabase.from("profiles").select("id,is_premium").in("id", userIds)
        const premiumSet = new Set((prem || []).filter((p: any) => p.is_premium).map((p: any) => String(p.id)))
        for (const p of prefs || []) {
          const uid = String(p.user_id)
          if (!premiumSet.has(uid)) continue
          const kws: string[] = Array.isArray(p.keywords) ? p.keywords.filter((x: any) => typeof x === "string" && x.trim()) : []
          const ufs: string[] = Array.isArray(p.ufs) ? p.ufs.filter((x: any) => typeof x === "string" && x.trim()) : []
          if (kws.length === 0) continue
          if (ufs.length === 0) {
            for (const k of kws) allAlerts.push({ user_id: uid, keyword: String(k), uf: null })
          } else {
            for (const k of kws) for (const uf of ufs) allAlerts.push({ user_id: uid, keyword: String(k), uf: String(uf) })
          }
        }
      }
    } catch {}
  }
  let processed = 0
  let notified = 0
  for (const alert of allAlerts || []) {
    processed++
    const items = await fetchPNCP({ termo: alert.keyword, uf: alert.uf || undefined, dataInicial, dataFinal })
    const ids = items.map((it: any) => String(it.numeroControlePNCP || it.linkEdital || it.id || `${it.orgao}-${it.objeto}-${it.dataPublicacao}`))
    if (ids.length === 0) continue
    const { data: already } = await supabase
      .from("sent_alerts")
      .select("pncp_id")
      .eq("user_id", alert.user_id)
      .in("pncp_id", ids)
    const sentSet = new Set((already || []).map((r: any) => r.pncp_id))
    const newItems: any[] = []
    const newIds: string[] = []
    for (let idx = 0; idx < items.length; idx++) {
      const id = ids[idx]
      if (!sentSet.has(id)) {
        newItems.push(items[idx])
        newIds.push(id)
      }
    }
    if (newItems.length === 0) continue
    // Busca e-mail opcionalmente (somente para fallback de canal por e-mail)
    let to = ""
    try {
      const { data: prof } = await supabase.from("profiles").select("email").eq("id", alert.user_id).limit(1).maybeSingle()
      to = String((prof as any)?.email || "")
    } catch {}
    if (to) {
      const subject = `Novas publicações: ${alert.keyword}${alert.uf ? ` • ${alert.uf}` : ""}`
      const listHtml = newItems.slice(0, 10).map((it: any) => {
        const modalidade = String(pick(it, ["modalidade","modalidadeContratacao","modalidadeCompra","descricaoModalidade"], "Modalidade"))
        const orgao = String(pick(it, ["orgao","orgaoPublico","nomeUnidadeAdministrativa","uasgNome","entidade"], "Órgão"))
        const objeto = String(pick(it, ["objeto","descricao","resumo","texto"], "Objeto"))
        const valor = currencyBRL(pick(it, ["valorEstimado","valorTotalEstimado","valor","valorContratacao"], 0))
        const dataPub = String(pick(it, ["dataPublicacao","dataInclusao","data"], "")).slice(0, 10)
        const edital = String(pick(it, ["linkEdital","url","link"], ""))
        const link = edital || `https://pncp.gov.br/`
        return `
          <li style="margin-bottom:12px">
            <div style="font-weight:600;color:#0f1e45">${modalidade} • ${orgao}</div>
            <div style="color:#333">${objeto}</div>
            <div style="font-size:12px;color:#666">Valor: ${valor} • Publicação: ${dataPub}</div>
            <div><a href="${link}" target="_blank" style="color:#0b5bd7;text-decoration:none">Ver edital</a></div>
          </li>
        `
      }).join("")
      const html = `
        <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Ubuntu,Cantarell,Noto Sans,Helvetica,Arial,sans-serif;max-width:640px;margin:0 auto;padding:16px">
          <h2 style="margin:0 0 8px;color:#0f1e45">Alertas PNCP</h2>
          <p style="margin:0 0 12px;color:#333">Encontramos ${newItems.length} novas publicações nos últimos 3 dias para "<strong>${alert.keyword}</strong>" ${alert.uf ? `em <strong>${alert.uf}</strong>` : ""}.</p>
          <ul style="padding-left:16px;list-style:disc">${listHtml}</ul>
          <p style="margin-top:16px;color:#666;font-size:12px">Você está recebendo este alerta porque ativou monitoramento no LicitAção.</p>
        </div>
      `
      let channel: "email" | "push" | "none" = "none"
      let err: string | null = null
      const pr = await sendPush(String(alert.user_id), subject, `Encontradas ${newItems.length} publicações para "${alert.keyword}"`, undefined)
      if (pr.ok) {
        channel = "push"
        notified++
        const rows = newIds.map((pncp_id) => ({ user_id: alert.user_id, pncp_id }))
        if (rows.length > 0) {
          await supabase.from("sent_alerts").insert(rows)
        }
      } else {
        const er = await sendEmail(to, subject, html)
        if (er.ok) {
          channel = "email"
          notified++
          const rows = newIds.map((pncp_id) => ({ user_id: alert.user_id, pncp_id }))
          if (rows.length > 0) {
            await supabase.from("sent_alerts").insert(rows)
          }
        } else {
          err = "no_channel_or_failed"
        }
      }
      await supabase.from("alert_runs").insert({
        alert_id: alert.id,
        user_id: alert.user_id,
        keyword: alert.keyword,
        uf: alert.uf || null,
        found_count: newItems.length,
        notified_count: channel === "none" ? 0 : newIds.length,
        channel,
        error: err,
      })
    }
  }
  const startISO = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10)
  const endISO = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate() + 5)).toISOString().slice(0, 10)
  const { data: expiring } = await supabase
    .from("user_certificates")
    .select("id,user_id,certificate_name,expiry_date,notified")
    .eq("notified", false)
    .gte("expiry_date", startISO)
    .lte("expiry_date", endISO)
  for (const cert of expiring || []) {
    const dl = daysUntil(String(cert.expiry_date))
    if (dl < 0) continue
    const subject = `Vencimento: ${String(cert.certificate_name)}`
    const message = `Atenção: sua ${String(cert.certificate_name)} vence em ${dl} dia(s).`
    const pr = await sendPush(String(cert.user_id), subject, message)
    if (pr.ok) {
      notified++
      await supabase.from("user_certificates").update({ notified: true }).eq("id", cert.id)
    }
  }
  return new Response(JSON.stringify({ ok: "TESTE_FINAL_AGORA", processed, notified }), { headers: { "Content-Type": "application/json" } })
})
