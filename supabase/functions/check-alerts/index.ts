import { serve } from "https://deno.land/std@0.224.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

/**
 * Formata datas no padrao YYYYMMDD usado pela API de consulta do PNCP.
 *
 * @param d Data de referencia.
 * @returns Data serializada no formato YYYYMMDD.
 */
function fmt(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const dd = String(d.getDate()).padStart(2, "0")
  return `${y}${m}${dd}`
}

/**
 * Busca publicacoes recentes no endpoint aberto do PNCP.
 *
 * Esta e a fonte primaria do robo. A Edge Function consulta o PNCP
 * diretamente para reduzir latencia e nao depender do App Router.
 *
 * @param params Filtros consolidados por palavra-chave, UF e janela de datas.
 * @returns Lista simples de itens retornados pelo PNCP.
 */
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

/**
 * Le o primeiro campo preenchido dentre varias opcoes de nomes.
 *
 * O PNCP muda nomenclaturas entre endpoints e este helper reduz duplicacao
 * na hora de montar mensagens, links e descricoes.
 *
 * @param o Objeto de origem.
 * @param keys Lista de chaves tentadas em ordem.
 * @param fallback Valor padrao caso nenhuma chave exista.
 * @returns Primeiro valor encontrado ou o fallback informado.
 */
function pick(o: any, keys: string[], fallback?: any) {
  for (const k of keys) {
    if (o && o[k] !== undefined && o[k] !== null) return o[k]
  }
  return fallback
}

/**
 * Formata um valor monetario para exibicao em BRL.
 *
 * @param v Valor bruto retornado pelo PNCP.
 * @returns Texto monetario amigavel para notificacoes e e-mails.
 */
function currencyBRL(v: any) {
  const n = Number(v || 0)
  try {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(n)
  } catch {
    return `R$ ${n.toFixed(2)}`
  }
}

/**
 * Envia alerta por e-mail via Resend.
 *
 * Este canal e apenas fallback quando o push do OneSignal nao consegue
 * entregar a notificacao.
 *
 * @param to Destinatario.
 * @param subject Assunto do e-mail.
 * @param html Corpo HTML do alerta.
 * @returns Resultado simples com status de sucesso.
 */
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

/**
 * Remove aspas e sujeira comum de chaves vindas de variaveis de ambiente.
 *
 * @param raw Valor cru da chave.
 * @returns Chave saneada para uso em headers HTTP.
 */
function sanitizeKey(raw: string): string {
  let s = String(raw || "").trim()
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1)
  }
  return s
}
/**
 * Mascara segredos para logging seguro.
 *
 * @param raw Chave original.
 * @returns Valor parcialmente oculto.
 */
function maskKey(raw: string): string {
  const s = String(raw || "")
  if (!s) return ""
  const start = s.slice(0, 4)
  const end = s.slice(-4)
  return `${start}...${end}`
}
/**
 * Envia push para um usuario especifico no OneSignal.
 *
 * Fluxo:
 * - tenta resolver subscription_id salvo no profile do Supabase;
 * - se o subscription_id estiver valido, envia diretamente para ele;
 * - caso contrario, faz fallback para external_user_id.
 *
 * @param externalUserId ID externo do usuario ou e-mail usado no OneSignal.
 * @param subject Titulo da notificacao.
 * @param message Corpo da notificacao.
 * @param url URL de destino opcional.
 * @returns Diagnostico completo do envio.
 */
async function sendPush(externalUserId: string, subject: string, message: string, url?: string) {
  const appId = sanitizeKey(Deno.env.get("ONESIGNAL_APP_ID") || "")
  const restKey = sanitizeKey(Deno.env.get("ONESIGNAL_REST_API_KEY") || "")
  const apiKeyAlt = sanitizeKey(Deno.env.get("ONESIGNAL_API_KEY") || "")
  const apiKey = restKey || apiKeyAlt
  const supaUrl = Deno.env.get("SUPABASE_URL") || ""
  const supaKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || ""
  if (!appId || !apiKey || !externalUserId) return { ok: false }
  function oneSignalHeaders(key: string): Record<string,string> {
    return {
      "Authorization": `Basic ${key}`,
      "Content-Type": "application/json",
      "accept": "application/json",
    }
  }
  try { console.log("ONESIGNAL_REST_API_KEY(masked):", maskKey(restKey)) } catch {}
  try { if (apiKeyAlt) console.log("ONESIGNAL_API_KEY(masked):", maskKey(apiKeyAlt)) } catch {}
  async function validateSubscriptionId(id: string): Promise<boolean> {
    try {
      const res = await fetch(`https://api.onesignal.com/apps/${appId}/subscriptions/${encodeURIComponent(id)}`, {
        method: "GET",
        headers: oneSignalHeaders(apiKey)
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
      const useEmail = /@/.test(externalUserId)
      let prof: any = null
      if (useEmail) {
        const byEmail = await supa.from("profiles").select("id,subscription_id,email").eq("email", externalUserId).limit(1).maybeSingle()
        prof = byEmail?.data || null
      } else {
        const byId = await supa.from("profiles").select("id,subscription_id,email").eq("id", externalUserId).limit(1).maybeSingle()
        prof = byId?.data || null
      }
      const subId = String((prof as any)?.subscription_id || "")
      if (subId && await validateSubscriptionId(subId)) {
        body = { ...requestBase, include_subscription_ids: [subId] }
      } else {
        body = { ...requestBase, include_external_user_ids: [externalUserId] }
      }
    } catch {}
  }
  let keyUsed = apiKey
  let res = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: oneSignalHeaders(apiKey),
    body: JSON.stringify(body),
  })
  if ((res.status === 401 || res.status === 403) && restKey && apiKeyAlt && restKey !== apiKeyAlt) {
    try { console.log("OneSignal auth failed with REST key, retrying with API key") } catch {}
    keyUsed = apiKeyAlt
    res = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: oneSignalHeaders(apiKeyAlt),
      body: JSON.stringify(body),
    })
  }
  let txt = ""
  try { txt = await res.text() } catch {}
  let js: any = null
  try { js = JSON.parse(txt) } catch {}
  try { console.log("OneSignal send status:", res.status) } catch {}
  try { console.log("OneSignal send body:", txt) } catch {}
  if (js) { try { console.log("OneSignal send json:", JSON.stringify(js)) } catch {} }
  return { ok: res.ok, status: res.status, body: txt, json: js, masked_key_used: maskKey(keyUsed) }
}

/**
 * Envia uma notificacao em lote para varias subscriptions do OneSignal.
 *
 * Este e o caminho preferencial do robo, porque reduz custo, chamadas HTTP e
 * tempo total do ciclo diario quando varios usuarios compartilham o mesmo filtro.
 *
 * @param subject Titulo da notificacao.
 * @param message Corpo da notificacao.
 * @param subs Lista unica de subscription_ids.
 * @returns Status HTTP e payload bruto do OneSignal.
 */
async function sendBatch(subject: string, message: string, subs: string[]) {
  const appId = sanitizeKey(Deno.env.get("ONESIGNAL_APP_ID") || "")
  const restKey = sanitizeKey(Deno.env.get("ONESIGNAL_REST_API_KEY") || "")
  const apiKeyAlt = sanitizeKey(Deno.env.get("ONESIGNAL_API_KEY") || "")
  const apiKey = restKey || apiKeyAlt
  if (!appId || !apiKey || !subs.length) return { ok: false, status: 400, json: null }
  function headersFor(key: string) {
    return { "Authorization": `Basic ${key}`, "Content-Type": "application/json", "accept": "application/json" }
  }
  const body = {
    app_id: appId,
    headings: { en: subject },
    contents: { en: message },
    url: "https://www.licitmasa.com.br/",
    include_subscription_ids: subs
  }
  let res = await fetch("https://api.onesignal.com/notifications", { method: "POST", headers: headersFor(apiKey), body: JSON.stringify(body) })
  if ((res.status === 401 || res.status === 403) && restKey && apiKeyAlt && restKey !== apiKeyAlt) {
    res = await fetch("https://api.onesignal.com/notifications", { method: "POST", headers: headersFor(apiKeyAlt), body: JSON.stringify(body) })
  }
  let txt = ""
  try { txt = await res.text() } catch {}
  let js: any = null
  try { js = JSON.parse(txt) } catch {}
  return { ok: res.ok, status: res.status, body: txt, json: js }
}

/**
 * Calcula quantos dias faltam para uma data.
 *
 * @param dateStr Data ISO ou compativel com Date.
 * @returns Quantidade de dias restantes, arredondada para cima.
 */
function daysUntil(dateStr: string) {
  const d = new Date(dateStr)
  const today = new Date()
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const ms = d.getTime() - base.getTime()
  return Math.ceil(ms / (24 * 60 * 60 * 1000))
}

/**
 * Edge Function principal do robo de alertas do LicitMASA.
 *
 * Entradas principais:
 * - modo normal: busca publicacoes do PNCP e dispara alertas;
 * - preview=1: amplia a janela de observacao para diagnostico;
 * - inspect=1 / runs=1 / test=1: rotas auxiliares de suporte operacional.
 *
 * Regras que futuros Builders devem preservar:
 * - somente usuarios premium entram no fluxo principal de busca;
 * - sent_alerts impede notificacao duplicada por usuario + publicacao;
 * - alert_runs registra auditoria de cada execucao;
 * - push em lote e preferido antes do fallback individual/e-mail.
 *
 * @param req Requisicao HTTP recebida pela Edge Function.
 * @returns JSON com resultado operacional e diagnosticos.
 */
serve(async (req: Request) => {
  const url = Deno.env.get("SUPABASE_URL") || ""
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SERVICE_ROLE_KEY") || ""
  const supabase = createClient(url, key)
  const now = new Date()
  const reqUrl = new URL(req.url)
  if (reqUrl.searchParams.get("inspect") === "1") {
    const admin = String(reqUrl.searchParams.get("admin") || "")
    const expected = String(Deno.env.get("ADMIN_TOKEN") || "DEV")
    if (admin !== expected) {
      return new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), { status: 401 })
    }
    const email = String(reqUrl.searchParams.get("email") || "").trim().toLowerCase()
    const q = String(reqUrl.searchParams.get("q") || "").trim().toLowerCase()
    let cfg: any = {}
    try {
      const u = new URL(url)
      const host = u.hostname
      const ref = host.split(".")[0]
      cfg = { url_host: host, project_ref: ref || null }
    } catch { cfg = { url_host: null, project_ref: null } }
    let uid: string | null = null
    let profile: any = null
    if (email) {
      const { data } = await supabase.from("profiles").select("id,email,subscription_id").eq("email", email).limit(1).maybeSingle()
      if (data?.id) { uid = String(data.id); profile = data }
    }
    if (!uid && q) {
      const { data } = await supabase.from("profiles").select("id,email,subscription_id").ilike("email", `%${q}%`).limit(1)
      if (data && data[0]?.id) { uid = String(data[0].id); profile = data[0] }
    }
    if (!uid && email) {
      const { data } = await supabase.from("profiles").select("id,email,subscription_id").ilike("email", `%${email}%`).limit(1)
      if (data && data[0]?.id) { uid = String(data[0].id); profile = data[0] }
    }
    if (!uid && email) {
      const local = email.split("@")[0]
      if (local) {
        const { data } = await supabase.from("profiles").select("id,email,subscription_id").ilike("email", `%${local}%`).limit(1)
        if (data && data[0]?.id) { uid = String(data[0].id); profile = data[0] }
      }
    }
    if (!uid && email) {
      try {
        const authClient = createClient(url, key, { db: { schema: "auth" } } as any)
        const { data: authUser } = await authClient.from("users").select("id,email").eq("email", email).limit(1).maybeSingle()
        if (authUser?.id) {
          uid = String(authUser.id)
          try {
            await supabase.from("profiles").upsert({ id: uid, email }, { onConflict: "id" })
            const { data: prof2 } = await supabase.from("profiles").select("id,email,subscription_id").eq("id", uid).limit(1).maybeSingle()
            profile = prof2 || null
          } catch {}
        }
      } catch {}
    }
    if (!uid) {
      let near: any[] = []
      let probeErr: string | null = null
      try {
        const local = String(email).split("@")[0]
        if (local) {
          const probe = await supabase.from("profiles").select("id,email").ilike("email", `%${local}%`).limit(5)
          near = Array.isArray(probe.data) ? probe.data : []
          if (probe.error) probeErr = String(probe.error.message || "SELECT_ERROR")
        }
      } catch {}
      if (!uid && near.length > 0 && near[0]?.id) {
        uid = String(near[0].id)
        try {
          const { data: prof2 } = await supabase.from("profiles").select("id,email,subscription_id").eq("id", uid).limit(1).maybeSingle()
          profile = prof2 || null
        } catch {}
      }
      if (!uid) {
        return new Response(JSON.stringify({ ok: false, error: "USER_NOT_FOUND", diag: { email, near, config: cfg, probe_error: probeErr } }), { status: 404 })
      }
    }
    if (!profile) {
      const { data } = await supabase.from("profiles").select("id,email,subscription_id").eq("id", uid).limit(1).maybeSingle()
      profile = data || null
    }
    let { data: sAlerts, error: sErr } = await supabase.from("search_alerts").select("id,keyword,uf,active,created_at").eq("user_id", uid).order("created_at", { ascending: false })
    let diagInsertErr: string | null = null
    try {
      const doNormalize = String(reqUrl.searchParams.get("normalize") || "") === "1"
      if (doNormalize && Array.isArray(sAlerts) && sAlerts.length) {
        const byLower: Record<string, string> = {}
        for (const r of sAlerts) {
          const k = String((r as any)?.keyword || "")
          byLower[k.trim().toLowerCase()] = String((r as any)?.id)
        }
        for (const r of sAlerts) {
          const id = String((r as any)?.id || "")
          const k = String((r as any)?.keyword || "").trim()
          if (!id || !k) continue
          if (/%[0-9A-Fa-f]{2}/.test(k)) {
            try {
              const dec = decodeURIComponent(k)
              if (dec && dec !== k) {
                const exists = !!byLower[dec.trim().toLowerCase()]
                if (exists) {
                  await supabase.from("search_alerts").delete().eq("id", id)
                } else {
                  await supabase.from("search_alerts").update({ keyword: dec }).eq("id", id)
                }
              }
            } catch {}
          }
        }
        const reload = await supabase.from("search_alerts").select("id,keyword,uf,active,created_at").eq("user_id", uid).order("created_at", { ascending: false })
        if (Array.isArray(reload.data)) sAlerts = reload.data
      }
    } catch {}
    try {} catch {}
    try {
      let kwParam = String(reqUrl.searchParams.get("kw") || "").trim()
      try { if (/%[0-9A-Fa-f]{2}/.test(kwParam)) kwParam = decodeURIComponent(kwParam) } catch {}
      if (kwParam) {
        const parts = kwParam.split(/[,\s]+/).map((s) => s.trim()).filter(Boolean)
        if (parts.length > 0) {
          const have = new Set<string>(Array.isArray(sAlerts) ? sAlerts.map((r: any) => String(r.keyword || "").trim().toLowerCase()).filter(Boolean) : [])
          const add = parts.filter((k) => !have.has(k.toLowerCase()))
          if (add.length > 0) {
            const rows = add.map((k) => ({ user_id: uid, keyword: k, active: true }))
            try { 
              const r2 = await supabase.from("search_alerts").insert(rows as any)
              if (r2.error) diagInsertErr = String(r2.error.message || "INSERT_ERROR")
            } catch (e2: any) { diagInsertErr = String(e2?.message || "INSERT_THROWN") }
            const reload = await supabase.from("search_alerts").select("id,keyword,uf,active,created_at").eq("user_id", uid).order("created_at", { ascending: false })
            if (Array.isArray(reload.data)) sAlerts = reload.data
          }
        }
      }
    } catch {}
    return new Response(JSON.stringify({
      ok: true,
      userId: uid,
      profile: profile || null,
      search_alerts: sAlerts || [],
      fallback_used: Boolean(!sAlerts || (Array.isArray(sAlerts) && sAlerts.length === 0)),
      select_error: sErr ? String(sErr.message || "SELECT_ERROR") : null,
      insert_error: diagInsertErr
    }), { headers: { "Content-Type": "application/json" } })
  }
  if (reqUrl.searchParams.get("runs") === "1") {
    const admin = String(reqUrl.searchParams.get("admin") || "")
    const expected = String(Deno.env.get("ADMIN_TOKEN") || "DEV")
    if (admin !== expected) {
      return new Response(JSON.stringify({ ok: false, error: "UNAUTHORIZED" }), { status: 401 })
    }
    let uid = String(reqUrl.searchParams.get("userId") || "")
    const email = String(reqUrl.searchParams.get("email") || "")
    const q = String(reqUrl.searchParams.get("q") || "")
    if (!uid) {
      if (email) {
        const { data: prof } = await supabase.from("profiles").select("id,email,updated_at").eq("email", email).order("updated_at", { ascending: false }).limit(1).maybeSingle()
        uid = String((prof as any)?.id || "")
      } else if (q) {
        const { data: profs } = await supabase.from("profiles").select("id,email,updated_at").ilike("email", `%${q}%`).order("updated_at", { ascending: false }).limit(5)
        uid = String((profs && profs[0] && (profs[0] as any).id) || "")
      }
    }
    const all = String(reqUrl.searchParams.get("all") || "") === "1"
    let data: any[] | null = null
    let error: any = null
    if (all && !uid) {
      const q = await supabase
        .from("alert_runs")
        .select("created_at,keyword,uf,found_count,notified_count,channel,error,user_id")
        .order("created_at", { ascending: false })
        .limit(20)
      data = q.data || []
      error = q.error || null
    } else {
      if (!uid) {
        return new Response(JSON.stringify({ ok: false, error: "USER_NOT_FOUND" }), { status: 404 })
      }
      const q = await supabase
        .from("alert_runs")
        .select("created_at,keyword,uf,found_count,notified_count,channel,error")
        .eq("user_id", uid)
        .order("created_at", { ascending: false })
        .limit(20)
      data = q.data || []
      error = q.error || null
    }
    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })
    }
    return new Response(JSON.stringify({ ok: true, userId: uid || null, rows: data || [] }), { headers: { "Content-Type": "application/json" } })
  }
  const isPreview = reqUrl.searchParams.get("preview") === "1"
  const backDays = isPreview ? 7 : 3
  const testMode = reqUrl.searchParams.get("test") === "1"
  const dataFinal = fmt(now)
  const dataInicial = fmt(new Date(now.getTime() - backDays * 24 * 60 * 60 * 1000))
  if (testMode) {
    try {
      const rawAppId = Deno.env.get("ONESIGNAL_APP_ID") || ""
      const rawKeyRest = Deno.env.get("ONESIGNAL_REST_API_KEY") || ""
      const rawKeyApi = Deno.env.get("ONESIGNAL_API_KEY") || ""
      const appId = sanitizeKey(rawAppId)
      const keyRest = sanitizeKey(rawKeyRest)
      const keyApi = sanitizeKey(rawKeyApi)
      const apiKey = keyRest || keyApi
      const override = reqUrl.searchParams.get("sub") || ""
      const testId = override || "8e7fd9b6-3ca2-4d4d-9a0b-9ba41be05d9d"
      function oneSignalHeaders(k: string): Record<string,string> {
        return {
          "Authorization": `Basic ${k}`,
          "Content-Type": "application/json",
          "accept": "application/json",
        }
      }
      try { if (keyRest) console.log("ONESIGNAL_REST_API_KEY(masked):", maskKey(keyRest)) } catch {}
      try { if (keyApi) console.log("ONESIGNAL_API_KEY(masked):", maskKey(keyApi)) } catch {}
      try { console.log("ONESIGNAL_APP_ID(masked):", maskKey(appId)) } catch {}
      const body = {
        app_id: appId,
        headings: { en: "Teste de Conexão LicitMASA" },
        contents: { en: "Teste de push direto via OneSignal" },
        include_subscription_ids: [testId],
        url: "https://pncp.gov.br/"
      }
      let keyUsed = apiKey
      let res = await fetch("https://api.onesignal.com/notifications", {
        method: "POST",
        headers: oneSignalHeaders(apiKey),
        body: JSON.stringify(body),
      })
      if ((res.status === 401 || res.status === 403) && keyRest && keyApi && keyRest !== keyApi) {
        try { console.log("OneSignal test: auth failed with REST key, retrying with API key") } catch {}
        keyUsed = keyApi
        res = await fetch("https://api.onesignal.com/notifications", {
          method: "POST",
          headers: oneSignalHeaders(keyApi),
          body: JSON.stringify(body),
        })
      }
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
         masked_key: maskKey(apiKey),
         masked_key_used: maskKey(keyUsed),
         masked_app_id: maskKey(appId),
         sanitized_key: (rawKeyRest || rawKeyApi) !== apiKey,
         sanitized_app_id: rawAppId !== appId,
        onesignal_json: parsed || null,
        onesignal_debug: parsed || txt,
        body: parsed || txt
      }), { headers: { "Content-Type": "application/json" } })
    } catch (e) {
      return new Response(JSON.stringify({ ok: "TESTE_FINAL_AGORA", error: e?.message || "TEST_FAILED" }), { status: 500 })
    }
  }
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
    try {} catch {}
  }
  let processed = 0
  let notified = 0
  let lastOneSignal: any = null
  try {
    console.log(`[check-alerts] total de alertas agregados (allAlerts):`, Array.isArray(allAlerts) ? allAlerts.length : 0)
  } catch {}
  const diag: any = { busca_consolidada: null, disparo_lote: null }
  function textFromItem(it: any): string {
    const fields = ["objeto","descricao","resumo","texto","orgao","orgaoPublico","nomeUnidadeAdministrativa","uasgNome","entidade"]
    const arr: string[] = []
    for (const f of fields) {
      const v = (it && (it[f] || (it?.[f] && String(it[f])))) ? String(it[f]) : ""
      if (v) arr.push(v)
    }
    return arr.join(" ").toLowerCase()
  }
  const ufs = Array.from(new Set((allAlerts || []).map(a => (a.uf || "").toString().toUpperCase())))
  const itemsByUf: Record<string, any[]> = {}
  for (const uf of ufs.length ? ufs : [""]) {
    const list = await fetchPNCP({ termo: undefined as any, uf: uf || undefined, dataInicial, dataFinal })
    itemsByUf[uf || ""] = Array.isArray(list) ? list : []
  }
  diag.busca_consolidada = { ufs: ufs.length || 1, itens: Object.values(itemsByUf).reduce((acc, a) => acc + a.length, 0) }
  const groups = new Map<string, { keyword: string, uf: string, alerts: Array<{ id?: string, user_id: string }> }>()
  for (const a of allAlerts || []) {
    const key = `${String(a.keyword || "").toLowerCase()}::${String(a.uf || "").toUpperCase()}`
    const g = groups.get(key) || { keyword: String(a.keyword || ""), uf: String(a.uf || ""), alerts: [] }
    g.alerts.push({ id: a.id, user_id: a.user_id })
    groups.set(key, g)
  }
  const groupResults: any[] = []
  for (const [gk, g] of groups.entries()) {
    const pool = itemsByUf[(g.uf || "").toUpperCase()] || itemsByUf[""] || []
    const kw = g.keyword.toLowerCase()
    const matched = pool.filter((it) => textFromItem(it).includes(kw))
    const ids = matched.map((it: any) => String(it.numeroControlePNCP || it.linkEdital || it.id || `${it.orgao}-${it.objeto}-${it.dataPublicacao}`))
    if (!ids.length) {
      for (const a of g.alerts) {
        await supabase.from("alert_runs").insert({ alert_id: a.id, user_id: a.user_id, keyword: g.keyword, uf: g.uf || null, found_count: 0, notified_count: 0, channel: "none", error: null })
      }
      groupResults.push({ key: gk, found: 0, sent: 0, status: "skip" })
      continue
    }
    const userIds = g.alerts.map(a => a.user_id)
    const { data: profs } = await supabase.from("profiles").select("id,email,subscription_id").in("id", userIds)
    const profById: Record<string, any> = {}
    for (const p of (profs || [])) profById[String(p.id)] = p
    const toSend: Array<{ userId: string, sub: string, newIds: string[] }> = []
    for (const a of g.alerts) {
      const { data: already } = await supabase.from("sent_alerts").select("pncp_id").eq("user_id", a.user_id).in("pncp_id", ids)
      const sentSet = new Set((already || []).map((r: any) => r.pncp_id))
      const newIds = ids.filter(id => !sentSet.has(id))
      if (!newIds.length) continue
      const p = profById[a.user_id]
      const sub = String(p?.subscription_id || "")
      if (sub) toSend.push({ userId: a.user_id, sub, newIds })
    }
    if (!toSend.length) {
      for (const a of g.alerts) {
        await supabase.from("alert_runs").insert({ alert_id: a.id, user_id: a.user_id, keyword: g.keyword, uf: g.uf || null, found_count: 0, notified_count: 0, channel: "none", error: null })
      }
      groupResults.push({ key: gk, found: matched.length, sent: 0, status: "no_recipients" })
      continue
    }
    const subs = Array.from(new Set(toSend.map(t => t.sub)))
    const subject = `Novas publicações: ${g.keyword}${g.uf ? ` • ${g.uf}` : ""}`
    const message = `Publicações recentes em ${backDays} dia(s) para "${g.keyword}"`
    const pr = await sendBatch(subject, message, subs)
    let channel: "push" | "none" = pr.ok ? "push" : "none"
    if (pr.ok) {
      notified += toSend.length
      for (const t of toSend) {
        const rows = t.newIds.map((pncp_id) => ({ user_id: t.userId, pncp_id }))
        if (rows.length) await supabase.from("sent_alerts").insert(rows)
      }
      for (const a of g.alerts) {
        await supabase.from("alert_runs").insert({ alert_id: a.id, user_id: a.user_id, keyword: g.keyword, uf: g.uf || null, found_count: matched.length, notified_count: matched.length, channel, error: null })
      }
    } else {
      for (const a of g.alerts) {
        await supabase.from("alert_runs").insert({ alert_id: a.id, user_id: a.user_id, keyword: g.keyword, uf: g.uf || null, found_count: matched.length, notified_count: 0, channel: "none", error: String(pr.status) })
      }
    }
    groupResults.push({ key: gk, found: matched.length, recipients: subs.length, status: pr.ok ? "ok" : "fail", http: pr.status })
  }
  processed = allAlerts.length
  diag.disparo_lote = { groups: groupResults.length, results: groupResults.slice(0, 10) }
  try {
    const filterUserId = String(reqUrl.searchParams.get("userId") || "").trim()
    const filterEmail = String(reqUrl.searchParams.get("email") || "").trim().toLowerCase()
    let targetUserId = filterUserId
    if (!targetUserId && filterEmail) {
      try {
        const { data: prof } = await supabase.from("profiles").select("id,email").eq("email", filterEmail).limit(1).maybeSingle()
        targetUserId = String((prof as any)?.id || "")
      } catch {}
    }
    if (targetUserId) {
      allAlerts = (allAlerts || []).filter(a => String(a.user_id) === targetUserId)
      try { console.log(`[check-alerts] filtrando por usuário ${targetUserId}; total após filtro: ${allAlerts.length}`) } catch {}
    }
  } catch {}
  for (const alert of allAlerts || []) {
    try {
      console.log(`[check-alerts] Iniciando busca para o usuário ${alert.user_id} com a palavra "${alert.keyword}"${alert.uf ? ` e UF "${alert.uf}"` : ''}`)
    } catch {}
    processed++
    const items = await fetchPNCP({ termo: alert.keyword, uf: alert.uf || undefined, dataInicial, dataFinal })
    const ids = items.map((it: any) => String(it.numeroControlePNCP || it.linkEdital || it.id || `${it.orgao}-${it.objeto}-${it.dataPublicacao}`))
    if (ids.length === 0) {
      try {
        if (alert.id) {
          await supabase.from("alert_runs").insert({
            alert_id: alert.id,
            user_id: alert.user_id,
            keyword: alert.keyword,
            uf: alert.uf || null,
            found_count: 0,
            notified_count: 0,
            channel: "none",
            error: null,
          })
        }
      } catch {}
      continue
    }
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
    if (newItems.length === 0) {
      try {
        if (alert.id) {
          await supabase.from("alert_runs").insert({
            alert_id: alert.id,
            user_id: alert.user_id,
            keyword: alert.keyword,
            uf: alert.uf || null,
            found_count: 0,
            notified_count: 0,
            channel: "none",
            error: null,
          })
        }
      } catch {}
      continue
    }
    // Busca e-mail opcionalmente (fallback de canal por e-mail)
    let to = ""
    try {
      const { data: prof } = await supabase.from("profiles").select("email").eq("id", alert.user_id).limit(1).maybeSingle()
      to = String((prof as any)?.email || "")
    } catch {}
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
          <p style="margin:0 0 12px;color:#333">Encontramos ${newItems.length} novas publicações nos últimos ${backDays} dias para "<strong>${alert.keyword}</strong>" ${alert.uf ? `em <strong>${alert.uf}</strong>` : ""}.</p>
          <ul style="padding-left:16px;list-style:disc">${listHtml}</ul>
          <p style="margin-top:16px;color:#666;font-size:12px">Você está recebendo este alerta porque ativou monitoramento no LicitAção.</p>
        </div>
      `
    let channel: "email" | "push" | "none" = "none"
    let err: string | null = null
    const pr = await sendPush((to || String(alert.user_id)), subject, `Encontradas ${newItems.length} publicações para "${alert.keyword}"`, undefined)
    lastOneSignal = pr
    if (pr.ok) {
      channel = "push"
      notified++
      const rows = newIds.map((pncp_id) => ({ user_id: alert.user_id, pncp_id }))
      if (rows.length > 0) {
        await supabase.from("sent_alerts").insert(rows)
      }
    } else if (to) {
      const er = await sendEmail(to, subject, html)
      if (er.ok) {
        channel = "email"
        notified++
        const rows = newIds.map((pncp_id) => ({ user_id: alert.user_id, pncp_id }))
        if (rows.length > 0) {
          await supabase.from("sent_alerts").insert(rows)
        }
      } else {
        try {
          if (lastOneSignal?.json?.errors || lastOneSignal?.json?.warnings) {
            err = JSON.stringify(lastOneSignal.json.errors || lastOneSignal.json.warnings)
          } else if (lastOneSignal?.body) {
            err = String(lastOneSignal.body)
          } else {
            err = `send_push_failed_status_${String(lastOneSignal?.status || 'unknown')}`
          }
        } catch {
          err = "no_channel_or_failed"
        }
      }
    } else {
      try {
        if (lastOneSignal?.json?.errors || lastOneSignal?.json?.warnings) {
          err = JSON.stringify(lastOneSignal.json.errors || lastOneSignal.json.warnings)
        } else if (lastOneSignal?.body) {
          err = String(lastOneSignal.body)
        } else {
          err = `send_push_failed_status_${String(lastOneSignal?.status || 'unknown')}`
        }
      } catch {
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
    lastOneSignal = pr
    if (pr.ok) {
      notified++
      await supabase.from("user_certificates").update({ notified: true }).eq("id", cert.id)
    }
  }
  return new Response(JSON.stringify({ ok: "TESTE_FINAL_AGORA", processed, notified, diagnostics: diag, onesignal: lastOneSignal ? { status: lastOneSignal.status, json: lastOneSignal.json || null, body: lastOneSignal.body || null } : null }), { headers: { "Content-Type": "application/json" } })
})
