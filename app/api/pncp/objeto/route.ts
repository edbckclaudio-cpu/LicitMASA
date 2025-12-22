import { NextResponse } from 'next/server'

function sanitize(s: string) {
  return s.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim()
}

function extractObject(html: string): string {
  const h = html.replace(/\n/g, ' ')
  const lower = h.toLowerCase()
  let idx = lower.indexOf('objeto:')
  if (idx === -1) {
    const p = lower.indexOf('objeto')
    if (p !== -1) {
      idx = p + 6
    }
  }
  if (idx === -1) return ''
  const seg = h.slice(idx)
  const lowers = seg.toLowerCase()
  const markers = ['itens', 'arquivos', 'histórico', 'historico', 'valor total', 'valor total estimado', 'valor total homologado', 'modalidade', 'documentos']
  let end = -1
  for (const m of markers) {
    const p2 = lowers.indexOf(m)
    if (p2 !== -1) {
      end = end === -1 ? p2 : Math.min(end, p2)
    }
  }
  const chunk = end !== -1 ? seg.slice(0, end) : seg.slice(0, 2000)
  const text = chunk.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  return sanitize(text.replace(/^objeto[:\s-]*/i, ''))
}

function pick(o: any, keys: string[]): string {
  for (const k of keys) {
    const v = o?.[k]
    if (typeof v === 'string' && v.trim()) return v
  }
  return ''
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url') || ''
    const numeroControlePNCP = searchParams.get('numeroControlePNCP') || ''
    if (!url && !numeroControlePNCP) {
      return NextResponse.json({ objeto: '' }, { status: 400 })
    }
    // Try PNCP API first if numeroControlePNCP provided
    if (numeroControlePNCP) {
      try {
        const api = new URL('https://pncp.gov.br/api/consulta/v1/contratacoes/publicacao')
        api.searchParams.set('numeroControlePNCP', numeroControlePNCP)
        api.searchParams.set('tamanhoPagina', '1')
        api.searchParams.set('pagina', '1')
        const r = await fetch(api.toString(), {
          headers: { accept: 'application/json', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LicitMASA/1.0' },
          cache: 'no-store',
        })
        try { console.log('[PNCP Proxy:objeto] GET', api.toString(), '->', r.status) } catch {}
        if (r.ok) {
          const j = await r.json().catch(() => null)
          const item = Array.isArray(j?.content) ? j.content[0]
            : Array.isArray(j?.items) ? j.items[0]
            : Array.isArray(j?.data) ? j.data[0]
            : Array.isArray(j) ? j[0]
            : j
          if (item) {
            let objeto = pick(item, ['objeto','objetoLicitacao','descricao','resumo','texto'])
            if (!objeto && Array.isArray(item?.itens)) {
              for (const it of item.itens) {
                objeto = pick(it, ['objeto','objetoLicitacao','descricao','resumo','texto'])
                if (objeto) break
              }
            }
            if (objeto) {
              return NextResponse.json({ objeto: sanitize(objeto) })
            }
          }
        }
      } catch {}
    }
    // Fallback: fetch HTML and extract
    if (url) {
      const res = await fetch(url, { headers: { accept: 'text/html' }, cache: 'no-store' })
      if (res.ok) {
        const html = await res.text()
        const objeto = extractObject(html)
        return NextResponse.json({ objeto })
      }
    }
    return NextResponse.json({ objeto: '' }, { status: 200 })
  } catch {
    return NextResponse.json({ objeto: '' }, { status: 500 })
  }
}
