import { NextResponse } from 'next/server'

const PNCP_TIMEOUT_MS = 12000

/**
 * Formata uma data no padrao YYYYMMDD aceito pela busca publica do PNCP.
 *
 * @param date Data a ser serializada.
 * @returns String no formato YYYYMMDD.
 */
function formatDateYYYYMMDD(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

/**
 * Consulta a API oficial do PNCP para uma modalidade especifica.
 *
 * O proxy do LicitMASA varre varias modalidades em paralelo porque o endpoint
 * do PNCP nem sempre entrega todos os resultados relevantes em uma unica busca.
 *
 * @param params Parametros recebidos da requisicao HTTP.
 * @param code Codigo da modalidade a ser forçada na consulta.
 * @returns Payload normalizado com itens, paginacao e status HTTP.
 */
async function fetchRemote(params: URLSearchParams, code?: number) {
  const base = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao'
  const url = new URL(base)
  for (const [k, v] of params.entries()) url.searchParams.set(k, v)
  if (code !== undefined) url.searchParams.set('codigoModalidadeContratacao', String(code))
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), PNCP_TIMEOUT_MS)
  try {
    const res = await fetch(url.toString(), {
      headers: {
        accept: 'application/json',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) LicitMASA/1.0 Chrome/121.0 Safari/537.36',
        'x-requested-with': 'XMLHttpRequest',
      },
      cache: 'no-store',
      signal: controller.signal,
    })
    try { console.log('[PNCP Proxy] GET', url.toString(), '->', res.status) } catch {}
    if (!res.ok) return { items: [], totalPages: 1, totalElements: 0, number: Number(params.get('pagina') ?? 1), size: Number(params.get('tamanhoPagina') ?? 10), status: res.status }
    const j = await res.json().catch(() => null as any)
    if (Array.isArray(j?.content)) {
      return {
        items: j.content,
        totalPages: Number(j.totalPages ?? 1),
        totalElements: Number(j.totalElements ?? j.content.length ?? 0),
        number: Number(j.number ?? Number(params.get('pagina') ?? 1)),
        size: Number(j.size ?? Number(params.get('tamanhoPagina') ?? j.content.length ?? 10)),
        status: res.status,
      }
    }
    const items = (j?.items && Array.isArray(j.items)) ? j.items
      : (j?.data && Array.isArray(j.data)) ? j.data
      : Array.isArray(j) ? j : []
    return {
      items,
      totalPages: Number(j?.totalPages ?? 1),
      totalElements: Number(j?.totalElements ?? items.length ?? 0),
      number: Number(j?.number ?? Number(params.get('pagina') ?? 1)),
      size: Number(j?.size ?? Number(params.get('tamanhoPagina') ?? items.length ?? 10)),
      status: res.status,
    }
  } catch (err: any) {
    const aborted = err?.name === 'AbortError'
    try { console.warn('[PNCP Proxy] GET failed', url.toString(), aborted ? 'TIMEOUT' : (err?.message || err)) } catch {}
    return {
      items: [],
      totalPages: 1,
      totalElements: 0,
      number: Number(params.get('pagina') ?? 1),
      size: Number(params.get('tamanhoPagina') ?? 10),
      status: aborted ? 504 : 500,
    }
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * Proxy interno de contratacoes publicadas no PNCP.
 *
 * Responsabilidades:
 * - definir janela padrao de datas quando o cliente nao informa filtro;
 * - consultar varias modalidades em paralelo;
 * - aplicar filtro textual consolidado em objeto e orgao;
 * - devolver um formato unico para o app e para os jobs internos.
 *
 * @param req Requisicao HTTP recebida pelo App Router.
 * @returns JSON padronizado com itens e metadados de paginacao.
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    if (!searchParams.get('dataInicial')) {
      const d = new Date()
      searchParams.set('dataInicial', formatDateYYYYMMDD(new Date(d.getTime() - 2 * 24 * 60 * 60 * 1000)))
    }
    if (!searchParams.get('dataFinal')) {
      searchParams.set('dataFinal', formatDateYYYYMMDD(new Date()))
    }
    const pagina = Number(searchParams.get('pagina') ?? 1)
    const tamanhoPagina = Number(searchParams.get('tamanhoPagina') ?? 10)
    const codeParam = searchParams.get('codigoModalidadeContratacao')
    const codes = codeParam ? [Number(codeParam)]
      : [8, 22, 21, 4, 5]
    const settled = await Promise.allSettled(codes.map((c) => fetchRemote(searchParams, c)))
    const pages = settled.map((result) => {
      if (result.status === 'fulfilled') return result.value
      return {
        items: [],
        totalPages: 1,
        totalElements: 0,
        number: pagina,
        size: tamanhoPagina,
        status: 500,
      }
    })
    const allItems = pages.flatMap((p) => (p as any)?.items ?? [])
    const termo = String(searchParams.get('termo') || '').trim().toLowerCase()
    const filteredItems = termo
      ? allItems.filter((it: any) => {
          function asText(v: any): string {
            if (v === undefined || v === null) return ''
            if (typeof v === 'string') return v
            if (typeof v === 'number') return String(v)
            return ''
          }
          const objeto =
            asText(it.objetoCompra) ||
            asText(it.objeto) ||
            asText(it.objetoLicitacao) ||
            asText(it.descricao) ||
            asText(it.resumo) ||
            asText(it.texto)
          const orgao =
            asText((it.orgaoEntidade && it.orgaoEntidade.razaoSocial) || '') ||
            asText(it.orgao) ||
            asText(it.orgaoPublico) ||
            asText(it.nomeUnidadeAdministrativa) ||
            asText(it.uasgNome) ||
            asText(it.entidade)
          const hay = (objeto + ' ' + orgao).toLowerCase()
          return hay.includes(termo)
        })
      : allItems
    const totalElements = allItems.length
    const totalPages = Math.max(1, Math.ceil((filteredItems.length || totalElements) / tamanhoPagina))
    const start = (pagina - 1) * tamanhoPagina
    const paginated = filteredItems.slice(start, start + tamanhoPagina)
    return NextResponse.json({
      items: paginated,
      totalPages,
      totalElements: filteredItems.length || totalElements,
      number: pagina,
      size: tamanhoPagina,
      statusCodes: pages.map((p) => (p as any)?.status ?? 0),
    })
  } catch {
    return NextResponse.json({
      items: [],
      totalPages: 1,
      totalElements: 0,
      number: 1,
      size: 10,
    }, { status: 200 })
  }
}
