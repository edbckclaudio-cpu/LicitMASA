import { createClient } from '@supabase/supabase-js'
import https from 'https'

// Allow passing --url and --key on CLI to avoid relying on env in sandbox
const argv = process.argv.slice(2).reduce((acc, a) => {
  const m = a.match(/^--([^=]+)=(.*)$/)
  if (m) acc[m[1]] = m[2]
  return acc
}, {})

const SUPABASE_URL = argv.url || process.env.SUPABASE_URL || 'https://ktytljteomtzyddpvvoj.supabase.co'
const SERVICE_ROLE_KEY = argv.key || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const USER_EMAIL = argv.email || process.env.USER_EMAIL || 'edbck.claudio@gmail.com'
const USER_ID = argv.uid || process.env.USER_ID || ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('[inspect-alerts] Missing SUPABASE_URL or SERVICE_ROLE_KEY in env')
  process.exit(1)
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function fetchPNCP({ termo, uf, dataInicial, dataFinal }) {
  return new Promise((resolve) => {
    const base = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao'
    const url = new URL(base)
    url.searchParams.set('dataInicial', dataInicial)
    url.searchParams.set('dataFinal', dataFinal)
    url.searchParams.set('pagina', '1')
    url.searchParams.set('tamanhoPagina', '50')
    if (uf) url.searchParams.set('uf', uf)
    if (termo) url.searchParams.set('termo', termo)
    const req = https.get(url.toString(), { headers: { 'user-agent': 'LicitMASA Inspector/1.0', accept: 'application/json' } }, (res) => {
      let body = ''
      res.on('data', (d) => (body += d))
      res.on('end', () => {
        try {
          const json = JSON.parse(body)
          if (Array.isArray(json)) return resolve(json)
          if (json?.content && Array.isArray(json.content)) return resolve(json.content)
          if (json?.items && Array.isArray(json.items)) return resolve(json.items)
          if (json?.data && Array.isArray(json.data)) return resolve(json.data)
          return resolve([])
        } catch {
          return resolve([])
        }
      })
    })
    req.on('error', () => resolve([]))
  })
}

function fmt(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${y}${m}${dd}`
}

;(async () => {
  try {
    let userId = USER_ID
    let email = USER_EMAIL
    if (!userId) {
      const { data: prof } = await supa.from('profiles').select('id,is_premium,email').eq('email', email).limit(1).maybeSingle()
      if (!prof) {
        console.log(JSON.stringify({ ok: false, error: 'USER_NOT_FOUND', email }, null, 2))
        process.exit(0)
      }
      userId = prof.id
      console.log('[inspect-alerts] Found user:', { id: userId, is_premium: prof.is_premium, email: prof.email })
      const isPremium = !!prof.is_premium
      if (!isPremium) console.log('[inspect-alerts] WARNING: user is not premium')
    }
    const { data: ua } = await supa.from('user_alerts').select('user_id,keywords,ufs,ativo,push_notificacao').eq('user_id', userId).maybeSingle()
    const { data: sa } = await supa.from('search_alerts').select('id,user_id,keyword,uf,active').eq('user_id', userId)
    const { data: pr } = await supa.from('profiles').select('is_premium').eq('id', userId).maybeSingle()
    const isPremium = !!(pr?.is_premium)
    console.log('[inspect-alerts] user_alerts:', ua || null)
    console.log('[inspect-alerts] search_alerts count:', Array.isArray(sa) ? sa.length : 0)
    if (Array.isArray(sa) && sa.length) console.log('[inspect-alerts] search_alerts sample:', sa.slice(0, 5))
    console.log('[inspect-alerts] is_premium:', isPremium)

    const now = new Date()
    const dataFinal = fmt(now)
    const dataInicial = fmt(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000))
    const sampleKw = argv.kw || process.env.TEST_KW || 'Alimentos'
    const sampleUf = argv.uf || process.env.TEST_UF || ''
    const items = await fetchPNCP({ termo: sampleKw, uf: sampleUf || undefined, dataInicial, dataFinal })
    console.log('[inspect-alerts] PNCP test:', { kw: sampleKw, uf: sampleUf || null, count: items.length })
    if (items.length) {
      const sample = items.slice(0, 3).map((it) => ({
        orgao: it.orgao || it.entidade || it.unidadeGestora || null,
        objeto: it.objeto || it.descricao || it.resumo || null,
        data: (it.dataPublicacao || it.data || '').slice ? (it.dataPublicacao || it.data || '').slice(0, 10) : null,
      }))
      console.log('[inspect-alerts] PNCP sample:', sample)
    }
    console.log(JSON.stringify({ ok: true }, null, 2))
  } catch (e) {
    console.error('[inspect-alerts] error:', e?.message || e)
    process.exit(1)
  }
})()
