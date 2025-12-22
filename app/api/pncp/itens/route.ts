import { NextResponse } from 'next/server'

function parseId(id: string) {
  const s = String(id || '')
  const slashIdx = s.lastIndexOf('/')
  const ano = slashIdx !== -1 ? s.slice(slashIdx + 1).replace(/[^0-9]/g, '') : ''
  const before = slashIdx !== -1 ? s.slice(0, slashIdx) : s
  const parts = before.split('-')
  const cnpj = (parts[0] || '').replace(/\D/g, '')
  const seqRaw = parts[2] || ''
  const sequencial = String(seqRaw).replace(/\D/g, '').replace(/^0+/, '')
  return { cnpj, ano, sequencial }
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id') || ''
    const cnpjParam = searchParams.get('cnpj') || ''
    const anoParam = searchParams.get('ano') || ''
    const seqParam = searchParams.get('sequencial') || searchParams.get('seq') || ''
    if (id) {
      const codes = [8, 22, 21, 4, 5]
      for (const code of codes) {
        try {
          const api = new URL('https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao')
          api.searchParams.set('numeroControlePNCP', id)
          api.searchParams.set('codigoModalidadeContratacao', String(code))
          api.searchParams.set('dataInicial', '20200101')
          api.searchParams.set('dataFinal', '20261231')
          api.searchParams.set('tamanhoPagina', '1')
          api.searchParams.set('pagina', '1')
          const r = await fetch(api.toString(), { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LicitMASA/1.0' }, cache: 'no-store' })
          try { console.log('[PNCP Proxy:itens] GET', api.toString(), '->', r.status) } catch {}
          if (!r.ok) continue
          const j = await r.json().catch(() => null as any)
          const item = Array.isArray(j?.content) ? j.content[0]
            : Array.isArray(j?.items) ? j.items[0]
            : Array.isArray(j?.data) ? j.data[0]
            : Array.isArray(j) ? j[0]
            : j
          const itens = Array.isArray(item?.itens) ? item.itens : []
          if (itens.length) return NextResponse.json({ itens })
        } catch {}
      }
      return NextResponse.json({ itens: [] }, { status: 200 })
    } else {
      const parsed = parseId(`${cnpjParam}-${seqParam}/${anoParam}`)
      const { cnpj, ano, sequencial } = parsed
      if (!cnpj || !ano || !sequencial) {
        return NextResponse.json({ itens: [] }, { status: 200 })
      }
      const url = `https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao/${cnpj}/${ano}/${sequencial}/itens`
      const res = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LicitMASA/1.0' }, cache: 'no-store' })
      try { console.log('[PNCP Proxy:itens] GET', url, '->', res.status) } catch {}
      if (!res.ok) {
        return NextResponse.json({ itens: [] }, { status: 200 })
      }
      const j = await res.json().catch(() => null as any)
      const itens = Array.isArray(j) ? j : (Array.isArray(j?.content) ? j.content : [])
      return NextResponse.json({ itens })
    }
  } catch {
    return NextResponse.json({ itens: [] }, { status: 200 })
  }
}
