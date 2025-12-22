export function formatDateYYYYMMDD(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

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

export async function fetchContratacoes(params: Params) {
  const base = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao'
  const url = new URL(base)
  const q = url.searchParams
  if (params.dataInicial) q.set('dataInicial', params.dataInicial)
  if (params.dataFinal) q.set('dataFinal', params.dataFinal)
  if (params.uf) q.set('uf', params.uf)
  if (params.termo) q.set('termo', params.termo)
  if (params.codigoModalidadeContratacao !== undefined) {
    q.set('codigoModalidadeContratacao', String(params.codigoModalidadeContratacao))
  } else {
    q.set('codigoModalidadeContratacao', '8')
  }
  if (params.codigoMunicipioIbge !== undefined) {
    q.set('codigoMunicipioIbge', String(params.codigoMunicipioIbge))
  }
  if (params.cnpj) {
    q.set('cnpj', params.cnpj)
  }
  if (params.codigoUnidadeAdministrativa !== undefined) {
    q.set('codigoUnidadeAdministrativa', String(params.codigoUnidadeAdministrativa))
  }
  q.set('pagina', String(params.pagina ?? 1))
  q.set('tamanhoPagina', String(params.tamanhoPagina ?? 10))
  q.set('v', String(Date.now()))
  try { console.error("DEBUG: ESTOU A CHAMAR A URL: ", url.toString()) } catch {}
  const res = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0',
      'x-requested-with': 'XMLHttpRequest',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '')
    console.error("ERRO DETALHADO DO PNCP:", errorBody)
    throw new Error(`Erro ${res.status}: ${errorBody}`)
  }
  const json = await res.json().catch(() => null as any)
  try { console.log('pncp_raw_json', json) } catch {}
  if (Array.isArray(json)) return json
  if (Array.isArray(json?.content)) return json.content
  if (Array.isArray(json?.items)) return json.items
  if (Array.isArray(json?.data)) return json.data
  return []
}

export type Page<T> = {
  items: T[]
  totalPages: number
  totalElements: number
  number: number
  size: number
}

export async function fetchContratacoesPage<T = any>(params: Params): Promise<Page<T>> {
  const base = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao'
  const url = new URL(base)
  const q = url.searchParams
  if (params.dataInicial) q.set('dataInicial', params.dataInicial)
  if (params.dataFinal) q.set('dataFinal', params.dataFinal)
  if (params.uf) q.set('uf', params.uf)
  if (params.termo) q.set('termo', params.termo)
  if (params.codigoModalidadeContratacao !== undefined) {
    q.set('codigoModalidadeContratacao', String(params.codigoModalidadeContratacao))
  } else {
    q.set('codigoModalidadeContratacao', '8')
  }
  if (params.codigoMunicipioIbge !== undefined) {
    q.set('codigoMunicipioIbge', String(params.codigoMunicipioIbge))
  }
  if (params.cnpj) {
    q.set('cnpj', params.cnpj)
  }
  if (params.codigoUnidadeAdministrativa !== undefined) {
    q.set('codigoUnidadeAdministrativa', String(params.codigoUnidadeAdministrativa))
  }
  q.set('pagina', String(params.pagina ?? 1))
  q.set('tamanhoPagina', String(params.tamanhoPagina ?? 10))
  q.set('v', String(Date.now()))
  try { console.error("DEBUG: ESTOU A CHAMAR A URL: ", url.toString()) } catch {}
  const res = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0',
      'x-requested-with': 'XMLHttpRequest',
    },
    cache: 'no-store',
  })
  if (!res.ok) {
    const errorBody = await res.text().catch(() => '')
    console.error("ERRO DETALHADO DO PNCP:", errorBody)
    throw new Error(`Erro ${res.status}: ${errorBody}`)
  }
  const json = await res.json().catch(() => null as any)
  try { console.log('pncp_raw_json', json) } catch {}
  if (Array.isArray(json?.content)) {
    return {
      items: json.content,
      totalPages: Number(json.totalPages ?? 1),
      totalElements: Number(json.totalElements ?? json.content.length ?? 0),
      number: Number(json.number ?? params.pagina ?? 1),
      size: Number(json.size ?? params.tamanhoPagina ?? json.content.length ?? 10),
    }
  }
  if (Array.isArray(json)) {
    return {
      items: json,
      totalPages: 1,
      totalElements: json.length,
      number: Number(params.pagina ?? 1),
      size: Number(params.tamanhoPagina ?? json.length ?? 10),
    }
  }
  const items = (json?.items && Array.isArray(json.items)) ? json.items
    : (json?.data && Array.isArray(json.data)) ? json.data
    : []
  return {
    items,
    totalPages: Number(json?.totalPages ?? 1),
    totalElements: Number(json?.totalElements ?? items.length ?? 0),
    number: Number(json?.number ?? params.pagina ?? 1),
    size: Number(json?.size ?? params.tamanhoPagina ?? items.length ?? 10),
  }
}

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
    const mdMatch = html.match(/modo\s*de\s*disputa[^<:]*[:>]\s*([^<\n]+)/i) || html.match(/\"modoDisputa\"\s*:\s*\"([^\"]+)\"/i)
    const modoDisputa = mdMatch ? (mdMatch[1] || '').trim() : undefined
    const deMatch =
      html.match(/data\s*(de\s*)?(encerramento|fim)[^0-9]*([\d]{4}-[\d]{2}-[\d]{2}T[\d]{2}:[\d]{2}:[\d]{2})/i)
      || html.match(/data\s*(de\s*)?(encerramento|fim)[^0-9]*([\d]{2}\/[\d]{2}\/[\d]{4})/i)
      || html.match(/\"dataEncerramento\"\s*:\s*\"([^\"]+)\"/i)
      || html.match(/\"dataFim\"\s*:\s*\"([^\"]+)\"/i)
    const dataEncerramento =
      deMatch ? ((deMatch[3] || deMatch[1] || deMatch[2]) as string) : undefined
    const abDataMatch =
      html.match(/data\s*(de\s*)?abertura[^0-9]*([\d]{4}-[\d]{2}-[\d]{2})/i)
      || html.match(/data\s*(de\s*)?abertura[^0-9]*([\d]{2}\/[\d]{2}\/[\d]{4})/i)
      || html.match(/\"dataAbertura\"\s*:\s*\"([^\"]+)\"/i)
    const dataAbertura = abDataMatch ? (abDataMatch[3] || abDataMatch[2] || abDataMatch[1]) as string : undefined
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
