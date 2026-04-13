/**
 * Converte um objeto Date para o formato YYYYMMDD exigido pela API do PNCP.
 *
 * @param date Data de referencia.
 * @returns Data serializada no formato YYYYMMDD.
 */
export function formatDateYYYYMMDD(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/**
 * Parametros aceitos pelo proxy interno de contratacoes do PNCP.
 *
 * A maior parte dos filtros e reutilizada tanto na UI quanto nos cron jobs,
 * entao esta tipagem funciona como contrato comum entre cliente e servidor.
 */
type Params = {
  termo?: string
  uf?: string
  codigoModalidadeContratacao?: number
  codigoMunicipioIbge?: number
  cnpj?: string
  codigoUnidadeAdministrativa?: number
  dataInicial?: string
  dataFinal?: string
  pagina?: number
  tamanhoPagina?: number
}

/**
 * Busca uma lista simples de contratacoes via proxy interno do Next.js.
 *
 * Esta funcao existe para manter a UI desacoplada dos detalhes do endpoint
 * oficial do PNCP e centralizar o tratamento de variacoes de payload.
 *
 * @param params Filtros de pesquisa aplicados pelo usuario.
 * @returns Lista plana de itens retornados pelo proxy.
 */
export async function fetchContratacoes(params: Params) {
  const api = new URL('/api/pncp/contratacoes', typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin)
  const q = api.searchParams
  if (params.dataInicial) q.set('dataInicial', params.dataInicial)
  if (params.dataFinal) q.set('dataFinal', params.dataFinal)
  if (params.uf) q.set('uf', params.uf)
  if (params.termo) q.set('termo', params.termo)
  if (params.codigoModalidadeContratacao !== undefined) q.set('codigoModalidadeContratacao', String(params.codigoModalidadeContratacao))
  if (params.codigoMunicipioIbge !== undefined) q.set('codigoMunicipioIbge', String(params.codigoMunicipioIbge))
  if (params.cnpj) q.set('cnpj', params.cnpj)
  if (params.codigoUnidadeAdministrativa !== undefined) q.set('codigoUnidadeAdministrativa', String(params.codigoUnidadeAdministrativa))
  q.set('pagina', String(params.pagina ?? 1))
  q.set('tamanhoPagina', String(params.tamanhoPagina ?? 10))
  const res = await fetch(api.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) return []
  const json = await res.json().catch(() => null as any)
  const items = Array.isArray(json?.items) ? json.items
    : Array.isArray(json?.content) ? json.content
    : Array.isArray(json?.data) ? json.data
    : Array.isArray(json) ? json : []
  return items
}

/**
 * Estrutura paginada padronizada usada pelo app para telas e jobs internos.
 */
export type Page<T> = {
  items: T[]
  totalPages: number
  totalElements: number
  number: number
  size: number
}

/**
 * Busca contratacoes preservando metadados de paginacao.
 *
 * O proxy interno consolida diferentes respostas do PNCP e sempre devolve
 * um contrato previsivel para a interface e para as rotinas automatizadas.
 *
 * @param params Filtros e configuracoes de paginacao.
 * @returns Resultado paginado normalizado.
 */
export async function fetchContratacoesPage<T = any>(params: Params): Promise<Page<T>> {
  const api = new URL('/api/pncp/contratacoes', typeof window === 'undefined' ? 'http://localhost:3000' : window.location.origin)
  const q = api.searchParams
  if (params.dataInicial) q.set('dataInicial', params.dataInicial)
  if (params.dataFinal) q.set('dataFinal', params.dataFinal)
  if (params.uf) q.set('uf', params.uf)
  if (params.termo) q.set('termo', params.termo)
  if (params.codigoModalidadeContratacao !== undefined) q.set('codigoModalidadeContratacao', String(params.codigoModalidadeContratacao))
  if (params.codigoMunicipioIbge !== undefined) q.set('codigoMunicipioIbge', String(params.codigoMunicipioIbge))
  if (params.cnpj) q.set('cnpj', params.cnpj)
  if (params.codigoUnidadeAdministrativa !== undefined) q.set('codigoUnidadeAdministrativa', String(params.codigoUnidadeAdministrativa))
  q.set('pagina', String(params.pagina ?? 1))
  q.set('tamanhoPagina', String(params.tamanhoPagina ?? 10))
  const res = await fetch(api.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' })
  if (!res.ok) {
    return { items: [], totalPages: 1, totalElements: 0, number: Number(params.pagina ?? 1), size: Number(params.tamanhoPagina ?? 10) }
  }
  const json = await res.json().catch(() => null as any)
  return {
    items: Array.isArray(json?.items) ? json.items : [],
    totalPages: Number(json?.totalPages ?? 1),
    totalElements: Number(json?.totalElements ?? 0),
    number: Number(json?.number ?? params.pagina ?? 1),
    size: Number(json?.size ?? params.tamanhoPagina ?? 10),
  }
}

/**
 * Monta a URL canonica de um edital no portal do PNCP a partir de um item.
 *
 * Quando a API nao devolve diretamente o link do edital, reconstruimos a rota
 * usando CNPJ, ano e sequencial da compra para manter navegacao consistente.
 *
 * @param item Item bruto retornado pela API ou pelo proxy.
 * @returns URL publica do edital no PNCP.
 */
export function buildEditalUrlFromItem(item: any): string {
  function getFieldLocal(o: any, keys: string[], fallback?: any) {
    for (const k of keys) {
      if (o && o[k] !== undefined && o[k] !== null) return o[k]
    }
    return fallback
  }
  const orgaoEnt = getFieldLocal(item, ['orgaoEntidade'], {})
  const cnpjDet = String(getFieldLocal(orgaoEnt, ['cnpj'], '')).replace(/\D/g, '')
  let anoDet = getFieldLocal(item, ['anoCompra'], '')
  let seqDet = getFieldLocal(item, ['sequencialCompra'], '')
  if (!anoDet || !seqDet) {
    const idStr = String(getFieldLocal(item, ['numeroControlePNCP','id'], ''))
    const slashIdx = idStr.lastIndexOf('/')
    if (!anoDet && slashIdx !== -1) {
      const a = idStr.slice(slashIdx + 1)
      if (/^\d{4}$/.test(a)) anoDet = a
    }
    const before = slashIdx !== -1 ? idStr.slice(0, slashIdx) : idStr
    const dashIdx = before.lastIndexOf('-')
    if (!seqDet && dashIdx !== -1) {
      const seq = before.slice(dashIdx + 1).replace(/^0+/, '')
      if (/^\d+$/.test(seq)) seqDet = seq
    }
  }
  const fallback = String(getFieldLocal(item, ['linkEdital','url','link'], 'https://pncp.gov.br/'))
  return cnpjDet && anoDet && seqDet
    ? `https://pncp.gov.br/app/editais/${cnpjDet}/${anoDet}/${seqDet}`
    : fallback
}

/**
 * Extrai metadados operacionais da pagina publica do edital.
 *
 * O "raio-x" e usado para enriquecer a leitura do usuario quando a API do
 * PNCP nao entrega todos os campos de disputa, abertura ou encerramento.
 *
 * @param item Item retornado pelo PNCP.
 * @returns Campos extraidos por scraping leve da pagina HTML do edital.
 */
export async function fetchRaioxInfo(item: any): Promise<{
  modoDisputa?: string,
  dataEncerramento?: string,
  dataAbertura?: string,
  horaAbertura?: string,
  plataforma?: string,
  disputaAbertaFechada?: string,
}> {
  const url = buildEditalUrlFromItem(item)
  try {
    const res = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'user-agent': 'Mozilla/5.0',
      },
      cache: 'no-store',
    })
    const html = await res.text()
    function brDateToISO(d: string, t?: string): string {
      const trimmed = (d || '').trim()
      if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/.test(trimmed)) {
        // Already ISO-like
        if (trimmed.includes('T')) return trimmed
        return t ? `${trimmed}T${t}:00-03:00` : `${trimmed}T00:00:00-03:00`
      }
      const m = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (!m) return trimmed
      const [_, dd, mm, yyyy] = m
      const hhmm = (t || '00:00').trim()
      return `${yyyy}-${mm}-${dd}T${hhmm}:00-03:00`
    }
    const mdMatch = html.match(/modo\s*de\s*disputa[^<:]*[:>]\s*([^<\n]+)/i) || html.match(/\"modoDisputa\"\s*:\s*\"([^\"]+)\"/i)
    const modoDisputa = mdMatch ? (mdMatch[1] || '').trim() : undefined
    const fimRecebMatch = html.match(/data\s*fim\s*de\s*recebimento\s*de\s*propostas[^0-9]*([\d]{2}\/[\d]{2}\/[\d]{4})\s*([\d]{2}:[\d]{2})?/i)
    const deMatch =
      html.match(/data\s*(de\s*)?(encerramento|fim)[^0-9]*([\d]{4}-[\d]{2}-[\d]{2}T[\d]{2}:[\d]{2}:[\d]{2})/i)
      || html.match(/data\s*(de\s*)?(encerramento|fim)[^0-9]*([\d]{2}\/[\d]{2}\/[\d]{4})/i)
      || html.match(/\"dataEncerramento\"\s*:\s*\"([^\"]+)\"/i)
      || html.match(/\"dataFim\"\s*:\s*\"([^\"]+)\"/i)
    let dataEncerramento: string | undefined = undefined
    if (fimRecebMatch) {
      dataEncerramento = brDateToISO(fimRecebMatch[1], fimRecebMatch[2])
    } else if (deMatch) {
      const s = (deMatch[3] || deMatch[1] || deMatch[2]) as string
      dataEncerramento = brDateToISO(s)
    }
    const abDataMatch =
      html.match(/data\s*(de\s*)?abertura[^0-9]*([\d]{4}-[\d]{2}-[\d]{2})/i)
      || html.match(/data\s*(de\s*)?abertura[^0-9]*([\d]{2}\/[\d]{2}\/[\d]{4})/i)
      || html.match(/\"dataAbertura\"\s*:\s*\"([^\"]+)\"/i)
    const dataAbertura = abDataMatch ? brDateToISO((abDataMatch[3] || abDataMatch[2] || abDataMatch[1]) as string) : undefined
    const horaMatch =
      html.match(/hora\s*(de\s*)?abertura[^0-9]*([\d]{2}:[\d]{2})/i)
      || html.match(/\"horaAbertura\"\s*:\s*\"([^\"]+)\"/i)
    const horaAbertura = horaMatch ? (horaMatch[2] || horaMatch[1]) as string : undefined
    const plataforma =
      /compras\.gov\.br/i.test(html) ? 'Compras.gov.br'
      : /pncp\.gov\.br/i.test(html) ? 'PNCP'
      : undefined
    const disputaAbertaFechada =
      /disputa\s*(aberta|aberto)/i.test(html) ? 'Aberta'
      : /disputa\s*(fechada|fechado)/i.test(html) ? 'Fechada'
      : undefined
    return { modoDisputa, dataEncerramento, dataAbertura, horaAbertura, plataforma, disputaAbertaFechada }
  } catch {
    return {}
  }
}
