import { NextResponse } from 'next/server'

function brDateToISO(d: string, t?: string): string {
  const trimmed = (d || '').trim()
  if (/^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}(:\d{2})?)?/.test(trimmed)) {
    if (trimmed.includes('T')) return trimmed
    return t ? `${trimmed}T${t}:00-03:00` : `${trimmed}T00:00:00-03:00`
  }
  const m = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (!m) return trimmed
  const [_, dd, mm, yyyy] = m
  const hhmm = (t || '00:00').trim()
  return `${yyyy}-${mm}-${dd}T${hhmm}:00-03:00`
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url') || ''
    if (!url) return NextResponse.json({}, { status: 400 })
    const res = await fetch(url, {
      headers: { accept: 'text/html,application/xhtml+xml' },
      cache: 'no-store',
    })
    if (!res.ok) return NextResponse.json({}, { status: 200 })
    const html = await res.text()
    const modoMatch = html.match(/modo\s*de\s*disputa[^<:]*[:>]\s*([^<\n]+)/i)
      || html.match(/"modoDisputa"\s*:\s*"([^"]+)"/i)
    const modoDisputa = modoMatch ? (modoMatch[1] || '').trim() : undefined
    const inicioMatch = html.match(/data\s*de\s*in[íi]cio\s*de\s*recebimento\s*de\s*propostas[^0-9]*([\d]{2}\/[\d]{2}\/[\d]{4})\s*([\d]{2}:[\d]{2})?/i)
      || html.match(/"dataInicioRecebimentoPropostas"\s*:\s*"([^"]+)"/i)
    const fimMatch = html.match(/data\s*fim\s*de\s*recebimento\s*de\s*propostas[^0-9]*([\d]{2}\/[\d]{2}\/[\d]{4})\s*([\d]{2}:[\d]{2})?/i)
      || html.match(/"dataFimRecebimentoPropostas"\s*:\s*"([^"]+)"/i)
    const dataAbertura = inicioMatch
      ? (inicioMatch[2] ? brDateToISO(inicioMatch[1], inicioMatch[2]) : brDateToISO((inicioMatch[1] || inicioMatch[0]) as string))
      : undefined
    const dataEncerramento = fimMatch
      ? (fimMatch[2] ? brDateToISO(fimMatch[1], fimMatch[2]) : brDateToISO((fimMatch[1] || fimMatch[0]) as string))
      : undefined
    const plataforma =
      /compras\.gov\.br/i.test(html) ? 'Compras.gov.br'
      : /pncp\.gov\.br/i.test(html) ? 'PNCP'
      : undefined
    return NextResponse.json({ modoDisputa, dataAbertura, dataEncerramento, plataforma })
  } catch {
    return NextResponse.json({}, { status: 200 })
  }
}
