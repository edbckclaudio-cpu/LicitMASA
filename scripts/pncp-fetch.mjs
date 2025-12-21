import fs from 'node:fs'
import path from 'node:path'

function formatDateYYYYMMDD(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

function getField(o, keys, fallback) {
  for (const k of keys) {
    if (o && o[k] !== undefined && o[k] !== null) return o[k]
  }
  return fallback
}

async function fetchPage({ dataInicial, dataFinal, pagina = 1, tamanhoPagina = 50, codigoModalidadeContratacao }, attempt = 1) {
  const bases = [
    'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao',
    'https://pncp.gov.br/pncp-consulta/v1/contratacoes/publicacao',
  ]
  let url = new URL(bases[0])
  const applyParams = (u) => {
    u.searchParams.set('dataInicial', dataInicial)
    u.searchParams.set('dataFinal', dataFinal)
    u.searchParams.set('codigoModalidadeContratacao', String(codigoModalidadeContratacao ?? 8))
    u.searchParams.set('pagina', String(pagina))
    u.searchParams.set('tamanhoPagina', String(tamanhoPagina))
  }
  let res
  let lastTried = ''
  for (const base of bases) {
    const u = new URL(base)
    applyParams(u)
    res = await fetch(u.toString(), {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
      },
      cache: 'no-store',
    })
    lastTried = u.toString()
    if (res.ok) {
      url = new URL(u.toString())
      break
    }
  }
  if (!res.ok) {
    if (attempt < 3) {
      const backoff = 500 * attempt
      await new Promise((r) => setTimeout(r, backoff))
      return fetchPage({ dataInicial, dataFinal, pagina, tamanhoPagina }, attempt + 1)
    }
    let txt = ''
    try { txt = await res.text() } catch {}
    throw new Error(`PNCP ${res.status} ao buscar página ${pagina}: ${txt}\nURL: ${lastTried}`)
  }
  let json
  try {
    json = await res.json()
  } catch {
    const txt = await res.text().catch(() => '')
    throw new Error(`Resposta inválida da API PNCP (não-JSON): ${txt.slice(0, 200)}`)
  }
  if (json?.content && Array.isArray(json.content)) {
    return {
      items: json.content,
      totalPages: Number(json.totalPages ?? 1),
    }
  }
  const items = Array.isArray(json?.items)
    ? json.items
    : Array.isArray(json?.data)
    ? json.data
    : Array.isArray(json)
    ? json
    : []
  return {
    items,
    totalPages: Number(json?.totalPages ?? 1),
  }
}

function readSeenIds() {
  const file = path.join(process.cwd(), 'data', 'pncp_seen.json')
  try {
    const raw = fs.readFileSync(file, 'utf-8')
    const parsed = JSON.parse(raw)
    return { file, ids: Array.isArray(parsed?.ids) ? parsed.ids : [] }
  } catch {
    return { file, ids: [] }
  }
}

function writeSeenIds(file, ids) {
  const dir = path.dirname(file)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ ids }, null, 2), 'utf-8')
}

function extractSummary(item) {
  const id =
    getField(item, ['numeroControlePNCP','numeroSequencial','id'], undefined)
  const orgao =
    getField(item, ['orgao','orgaoPublico','nomeUnidadeAdministrativa','orgaoEntidade','razaoSocial'], undefined)
  const razao =
    typeof orgao === 'object' ? getField(orgao, ['razaoSocial','nome'], orgao) : orgao
  const objeto =
    getField(item, ['objeto','descricao','resumo','texto'], undefined)
  const valor =
    getField(item, ['valorEstimado','valorTotalEstimado','valor','valorContratacao'], 0)
  return {
    id: String(id ?? ''),
    orgao: String(razao ?? ''),
    objeto: String(objeto ?? ''),
    valor: Number(valor ?? 0),
  }
}

async function main() {
  const hoje = formatDateYYYYMMDD(new Date())
  const { file, ids: seen } = readSeenIds()
  console.log(`[PNCP] Buscando publicações de ${hoje}...`)
  const modalidades = [8, 21, 22, 4, 5]
  const all = []
  for (const mod of modalidades) {
    const first = await fetchPage({ dataInicial: hoje, dataFinal: hoje, pagina: 1, tamanhoPagina: 50, codigoModalidadeContratacao: mod })
    const totalPages = Number(first.totalPages || 1)
    all.push(...first.items)
    for (let p = 2; p <= totalPages; p++) {
      const page = await fetchPage({ dataInicial: hoje, dataFinal: hoje, pagina: p, tamanhoPagina: 50, codigoModalidadeContratacao: mod })
      all.push(...page.items)
    }
  }
  const summaries = all.map(extractSummary).filter((s) => s.id)
  const newOnes = summaries.filter((s) => !seen.includes(s.id))
  if (newOnes.length === 0) {
    console.log('[PNCP] Nenhuma nova publicação encontrada.')
  } else {
    console.log(`[PNCP] Novas publicações: ${newOnes.length}`)
    for (const s of newOnes.slice(0, 20)) {
      console.log(`- #${s.id} • ${s.orgao} • ${s.objeto.slice(0, 120)} • R$ ${s.valor}`)
    }
    const updated = [...seen, ...newOnes.map((n) => n.id)]
    writeSeenIds(file, Array.from(new Set(updated)))
    console.log(`[PNCP] IDs atualizados em ${path.relative(process.cwd(), file)}`)
  }
}

main().catch((err) => {
  console.error('[PNCP] Erro na busca:', err?.message || err)
  process.exitCode = 1
})
