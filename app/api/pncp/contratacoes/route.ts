import { NextResponse } from 'next/server'

function formatDateYYYYMMDD(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

async function fetchRemote(params: URLSearchParams, code?: number) {
  const base = 'https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao'
  const url = new URL(base)
  for (const [k, v] of params.entries()) url.searchParams.set(k, v)
  if (code !== undefined) url.searchParams.set('codigoModalidadeContratacao', String(code))
  const res = await fetch(url.toString(), {
    headers: {
      accept: 'application/json',
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) LicitMASA/1.0 Chrome/121.0 Safari/537.36',
      'x-requested-with': 'XMLHttpRequest',
    },
    cache: 'no-store',
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
}

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
    const pages = await Promise.all(codes.map((c) => fetchRemote(searchParams, c)))
    const allItems = pages.flatMap((p) => (p as any)?.items ?? [])
    const totalElements = allItems.length
    const totalPages = Math.max(1, Math.ceil(totalElements / tamanhoPagina))
    const start = (pagina - 1) * tamanhoPagina
    const paginated = allItems.slice(start, start + tamanhoPagina)
    return NextResponse.json({
      items: paginated,
      totalPages,
      totalElements,
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
