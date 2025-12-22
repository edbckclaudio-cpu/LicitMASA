import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { fetchContratacoesPage, formatDateYYYYMMDD } from '@/lib/pncp'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  if (!url || !key) return null
  return createClient(url, key)
}

export async function GET() {
  try {
    const supa = adminClient()
    if (!supa) {
      return NextResponse.json({ ok: false, error: 'SERVICE_KEY_MISSING' }, { status: 500 })
    }
    const { data: alerts, error } = await supa
      .from('user_alerts')
      .select('id,user_id,keywords,ufs,min_value,active,profiles!inner(plan,is_premium)')
      .eq('active', true)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    const now = new Date()
    const dataFinal = formatDateYYYYMMDD(now)
    const dataInicial = formatDateYYYYMMDD(new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000))
    let processed = 0
    const out: Array<{ alert_id: string, user_id: string, found: number }> = []
    for (const alert of alerts || []) {
      const premium = Boolean((alert as any)?.profiles?.is_premium) || String((alert as any)?.profiles?.plan || '').toLowerCase() === 'premium'
      if (!premium) continue
      processed++
      const kws: string[] = Array.isArray((alert as any).keywords) ? (alert as any).keywords : []
      const ufs: string[] = Array.isArray((alert as any).ufs) ? (alert as any).ufs : []
      const minValue = Number((alert as any).min_value || 0)
      let totalFound = 0
      const combos = (kws.length ? kws : [undefined]).flatMap((k) => (ufs.length ? ufs : [undefined]).map((u) => ({ k, u })))
      for (const combo of combos) {
        const page = await fetchContratacoesPage({
          dataInicial,
          dataFinal,
          termo: combo.k || undefined,
          uf: combo.u || undefined,
          pagina: 1,
          tamanhoPagina: 50,
        } as any)
        const items = Array.isArray((page as any).items) ? (page as any).items : Array.isArray((page as any).data) ? (page as any).data : []
        const filtered = items.filter((it: any) => {
          const v = Number(
            ([ 'valorEstimado','valorTotalEstimado','valor','valorContratacao' ] as const)
              .map((k) => (it?.[k] ?? 0))[0]
          ) || 0
          return v >= minValue
        })
        totalFound += filtered.length
      }
      out.push({ alert_id: String((alert as any).id), user_id: String((alert as any).user_id), found: totalFound })
    }
    return NextResponse.json({ ok: true, processed, results: out })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
  }
}
