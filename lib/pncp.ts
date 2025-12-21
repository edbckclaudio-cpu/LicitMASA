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
