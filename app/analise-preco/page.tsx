'use client'
import { Suspense, useEffect, useMemo, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ChevronLeft, Search } from 'lucide-react'
import Link from 'next/link'

function getField(o: any, keys: string[], fallback?: any) {
  for (const k of keys) {
    if (o && o[k] !== undefined && o[k] !== null) return o[k]
  }
  return fallback
}
function asText(v: any): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'string') return v
  if (typeof v === 'number') return String(v)
  if (Array.isArray(v)) return v.map((x) => asText(x)).filter(Boolean).join(' ')
  if (typeof v === 'object') {
    const s =
      getField(v, ['razaoSocial','nome','denominacao','descricao','resumo','texto','titulo'], '')
    return typeof s === 'string' ? s : ''
  }
  return ''
}

function formatCurrencyBRL(value: number | string | undefined) {
  const num = typeof value === 'string' ? Number(value) : value
  if (!num || Number.isNaN(num)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}

function formatDateYYYYMMDD(date: Date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}${m}${d}`
}

const STOPWORDS = new Set([
  'de','da','do','das','dos','e','para','com','em','por','sem','se','uma','um','as','os','a','o','ao','à',
  'contratação','prestação','serviços','serviço','aquisição','compra','fornecimento','empresa','material','materiais',
  'execução','objeto','itens','item'
])

function extractKeywords(obj: string) {
  const words = obj
    .toLowerCase()
    .replace(/[.,;:()\/\-]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w) && w.length > 3)
  const unique = Array.from(new Set(words))
  const sorted = unique.sort((a, b) => b.length - a.length)
  const top = sorted.slice(0, Math.min(3, sorted.length))
  return top.join(' ')
}

function extractTwoSubstantives(obj: string) {
  const tokens = String(obj || '')
    .replace(/[.,;:()\/\-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const filtered: string[] = []
  for (const t of tokens) {
    const low = t.toLowerCase()
    const isStop = STOPWORDS.has(low)
    const isWord = /[a-zA-ZÀ-ÖØ-öø-ÿ]/.test(t)
    if (isStop || !isWord) continue
    filtered.push(t)
    if (filtered.length >= 2) break
  }
  return filtered.join(' ')
}

function extractNSubstantives(obj: string, n: number) {
  const tokens = String(obj || '')
    .replace(/[.,;:()\/\-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const out: string[] = []
  for (const t of tokens) {
    const low = t.toLowerCase()
    const isStop = STOPWORDS.has(low)
    const isWord = /[a-zA-ZÀ-ÖØ-öø-ÿ]/.test(t)
    if (isStop || !isWord) continue
    out.push(t)
    if (out.length >= n) break
  }
  return out.join(' ')
}
function getFirstNWords(text: string, n: number) {
  return String(text || '')
    .replace(/[.,;:()\/\-]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, n)
    .join(' ')
}
function cleanTerm(s: string) {
  const raw = String(s || '').trim()
  const lower = raw.toLowerCase()
  const phrases = [
    'contratação de', 'contratacao de', 'aquisição de', 'aquisiçao de', 'aquisicao de',
    'fornecimento', 'empresa', 'para', 'de', 'e', 'com', 'materiais', 'serviços', 'servico'
  ]
  let out = lower
  for (const p of phrases) {
    out = out.replace(new RegExp(`\\b${p}\\b`, 'gi'), ' ')
  }
  const tokens = out.replace(/[.,;:()\/\-]+/g, ' ').split(/\s+/).filter(Boolean)
  const filtered = tokens.filter((t) => !STOPWORDS.has(t))
  const toSingular = (w: string) => {
    const m = w.toLowerCase()
    const map: Record<string, string> = {
      materiais: 'material',
      medicamentos: 'medicamento',
      produtos: 'produto',
      servicos: 'serviço',
      serviços: 'serviço',
      itens: 'item',
    }
    if (map[m]) {
      const target = map[m]
      return w[0] === w[0].toUpperCase() ? (target[0].toUpperCase() + target.slice(1)) : target
    }
    if (m.endsWith('s') && m.length > 4) return w.slice(0, -1)
    return w
  }
  const singular = filtered.map(toSingular)
  return singular.slice(0, Math.max(2, singular.length)).join(' ').trim()
}

function removeAccents(s: string) {
  return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

function limparTermoBusca(texto: string) {
  const original = String(texto || '').trim()
  const norm = removeAccents(original).toLowerCase()
  const stop = new Set([
    'aquisição','aquisicao','fornecimento','compra','contratação','contratacao','empresa',
    'especializada','para','de','o','a','materiais','serviços','servicos'
  ])
  const tokens = norm.replace(/[.,;:()\/\-]+/g, ' ').split(/\s+/).filter(Boolean)
  const singularize = (t: string) => {
    if (t === 'materiais') return 'material'
    if (t.endsWith('s') && t.length > 4) return t.slice(0, -1)
    return t
  }
  const mapped = tokens.map(singularize)
  const filtered = mapped.filter((t) => !stop.has(t))
  let chosen = filtered
  if (chosen.includes('material')) {
    const others = chosen.filter((w) => w !== 'material')
    chosen = ['material', ...(others)]
  }
  const finalTokens = chosen.length > 2 ? chosen.slice(0, 2) : chosen
  const termoLimpo = finalTokens.join(' ').trim()
  return termoLimpo
}

function AnalisePrecoContent() {
  const params = useSearchParams()
  const objetoParam = params.get('obj') || ''
  const idParam = params.get('id') || ''
  const [objeto, setObjeto] = useState<string>(objetoParam)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultados, setResultados] = useState<any[]>([])
  const [analise, setAnalise] = useState<Array<{
    nome: string
    media?: number
    ultimo?: number
    sugestao?: number
    uf?: string
    historicoCount: number
  }>>([])
  const [itemUF, setItemUF] = useState<string>('')
  const [origem, setOrigem] = useState<'UF' | 'NACIONAL' | null>(null)
  const [itensLista, setItensLista] = useState<string[]>([])
  const [selectedItem, setSelectedItem] = useState<string>('')
  const [manualTerm, setManualTerm] = useState<string>('')
  const [statusBusca, setStatusBusca] = useState<'IDENTICA' | 'APROXIMADA' | 'SEMELHANTE' | null>(null)
  const [termoPesquisado, setTermoPesquisado] = useState<string>('')
  const [termoEditado, setTermoEditado] = useState<string>('')
  const [showTech, setShowTech] = useState<boolean>(false)
  const [sugestoes, setSugestoes] = useState<string[]>([])
  const [lastError, setLastError] = useState<string>('')
  const [statusItens, setStatusItens] = useState<string>('Carregando')
  const [termoExtraido, setTermoExtraido] = useState<string>('')
  const [urlFinal, setUrlFinal] = useState<string>('')
  const termo = useMemo(() => extractTwoSubstantives(objeto || ''), [objeto])
  const hoje = useMemo(() => formatDateYYYYMMDD(new Date()), [])
  const [itensVazios, setItensVazios] = useState<boolean>(false)
  const [statusSource, setStatusSource] = useState<string>('Carregando')
  const [termoUsado, setTermoUsado] = useState<string>('')

  async function fetchItensAtual(): Promise<string[]> {
    try {
      if (!idParam) return []
      setStatusItens('Carregando')
      const r = await fetch(`/api/pncp/itens?id=${encodeURIComponent(idParam)}`, { cache: 'no-store' })
      if (!r.ok) {
        setStatusItens(`Erro ${r.status}`)
        return []
      }
      const j = await r.json().catch(() => null as any)
      const itens = Array.isArray(j?.itens) ? j.itens : []
      const descrs = itens.map((it: any) => {
        const desc = asText(getField(it, ['descricao','objeto','nome','titulo'], '') || '')
        return desc.trim()
      }).filter(Boolean)
      const unique = (Array.from(new Set(descrs)) as string[])
      setStatusItens(unique.length ? 'Sucesso' : 'Vazio')
      setItensVazios(unique.length === 0)
      if (unique[0]) {
        const firstTwo = cleanTerm(getFirstNWords(unique[0], 2))
        setTermoExtraido(firstTwo)
      }
      return unique
    } catch {
      setStatusItens('Erro')
      setItensVazios(true)
      return []
    }
  }
  async function fetchUFAtual(): Promise<string> {
    try {
      if (!idParam) return ''
      const url = new URL('/api/pncp/contratacoes', window.location.origin)
      url.searchParams.set('numeroControlePNCP', idParam)
      url.searchParams.set('tamanhoPagina', '1')
      url.searchParams.set('pagina', '1')
      const res = await fetch(url.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' })
      if (!res.ok) return ''
      const j = await res.json().catch(() => null as any)
      const items = Array.isArray(j?.items) ? j.items : []
      const first = items[0] || {}
      const uf =
        asText(getField(getField(first, ['unidadeOrgao'], {}), ['ufSigla'], '')) ||
        asText(getField(first, ['uf','ufSigla'], ''))
      return uf || ''
    } catch {
      return ''
    }
  }
  async function buscarHistoricoTermo(nome: string, uf?: string) {
    try {
      const base = new URL('/api/pncp/contratacoes', window.location.origin)
      const query = removeAccents(String(nome || '').trim())
      base.searchParams.set('termo', query)
      base.searchParams.set('situacaoCompraId', '10')
      base.searchParams.set('dataInicial', '20240101')
      base.searchParams.set('dataFinal', hoje)
      base.searchParams.set('tamanhoPagina', '10')
      base.searchParams.set('pagina', '1')
      if (uf) base.searchParams.set('uf', uf)
      setUrlFinal(base.toString())
      let res = await fetch(base.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }
      let j = await res.json().catch(() => null as any)
      let items = Array.isArray(j?.items) ? j.items : (Array.isArray(j?.content) ? j.content : [])
      if ((!items || items.length === 0) && uf) {
        const national = new URL('/api/pncp/contratacoes', window.location.origin)
        national.searchParams.set('termo', query)
        national.searchParams.set('situacaoCompraId', '10')
        national.searchParams.set('dataInicial', '20240101')
        national.searchParams.set('dataFinal', hoje)
        national.searchParams.set('tamanhoPagina', '10')
        national.searchParams.set('pagina', '1')
        setUrlFinal(national.toString())
        res = await fetch(national.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        j = await res.json().catch(() => null as any)
        items = Array.isArray(j?.items) ? j.items : (Array.isArray(j?.content) ? j.content : [])
      }
      const sorted = items.slice().sort((a: any, b: any) => {
        const da = new Date(String(getField(a, ['dataPublicacaoPncp','dataInclusao','dataAtualizacaoGlobal','data'], ''))).getTime()
        const db = new Date(String(getField(b, ['dataPublicacaoPncp','dataInclusao','dataAtualizacaoGlobal','data'], ''))).getTime()
        return db - da
      })
      return sorted
    } catch (e: any) {
      setLastError(String(e?.message || e || 'Erro de consulta'))
      return []
    }
  }
  async function buscarHistoricoLivre(nome: string) {
    try {
      const base = new URL('/api/pncp/contratacoes', window.location.origin)
      const query = removeAccents(String(nome || '').trim())
      base.searchParams.set('termo', query)
      base.searchParams.set('dataInicial', '20240101')
      base.searchParams.set('dataFinal', hoje)
      base.searchParams.set('tamanhoPagina', '10')
      base.searchParams.set('pagina', '1')
      setUrlFinal(base.toString())
      const res = await fetch(base.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' })
      if (!res.ok) return []
      const j = await res.json().catch(() => null as any)
      const items = Array.isArray(j?.items) ? j.items : (Array.isArray(j?.content) ? j.content : [])
      const sorted = items.slice().sort((a: any, b: any) => {
        const da = new Date(String(getField(a, ['dataPublicacaoPncp','dataInclusao','dataAtualizacaoGlobal','data'], ''))).getTime()
        const db = new Date(String(getField(b, ['dataPublicacaoPncp','dataInclusao','dataAtualizacaoGlobal','data'], ''))).getTime()
        return db - da
      })
      return sorted
    } catch {
      return []
    }
  }
  function getSecondWord(s: string) {
    const arr = String(s || '').replace(/[.,;:()\/\-]+/g, ' ').split(/\s+/).filter(Boolean)
    return arr[1] || arr[0] || ''
  }
  function buildSugestoes(base: string) {
    const low = String(base || '').toLowerCase()
    if (/hidra/i.test(low)) return ['Tubo', 'Conexão', 'PVC', 'Registro']
    if (/pvc/i.test(low)) return ['Tubo', 'Conexão', 'Joelho', 'Adesivo']
    if (/medic/i.test(low)) return ['Medicamento', 'Genérico', 'Antibiótico', 'Analgésico']
    const tokens = String(base || '').replace(/[.,;:()\/\-]+/g, ' ').split(/\s+/).filter(Boolean)
    const filtered = tokens.map((t) => t.trim()).filter((t) => t.length > 3 && !STOPWORDS.has(t.toLowerCase()))
    const unique = Array.from(new Set(filtered))
    return unique.slice(0, 4)
  }
  async function buscarHistoricoFlex(nome: string, uf?: string) {
    const h1 = await buscarHistoricoTermo(nome, uf || undefined)
    if (h1.length) return { items: h1.slice(0, 10), origem: uf ? 'UF' : 'NACIONAL' as 'UF' | 'NACIONAL' }
    const h2 = await buscarHistoricoTermo(nome, undefined)
    if (h2.length) return { items: h2.slice(0, 10), origem: 'NACIONAL' as 'NACIONAL' }
    const h3 = await buscarHistoricoLivre(nome)
    if (h3.length) return { items: h3.slice(0, 10), origem: 'NACIONAL' as 'NACIONAL' }
    const segunda = getSecondWord(nome)
    if (segunda && segunda !== nome) {
      const h4 = await buscarHistoricoLivre(segunda)
      if (h4.length) return { items: h4.slice(0, 10), origem: 'NACIONAL' as 'NACIONAL' }
    }
    return { items: [], origem: uf ? 'UF' : 'NACIONAL' as 'UF' | 'NACIONAL' }
  }
  async function pesquisaInteligente(descricaoCompleta: string, ufAtual?: string) {
    const duasPalavras = getFirstNWords(descricaoCompleta, 2)
    let termoFinal = duasPalavras
    let nivel: 'IDENTICA' | 'APROXIMADA' | 'SEMELHANTE' | null = 'APROXIMADA'
    const hist = await buscarHistoricoTermo(duasPalavras, ufAtual || undefined)
    console.log('Nível de busca alcançado:', nivel || '—', 'Termo usado:', termoFinal || '—')
    setTermoPesquisado(termoFinal || descricaoCompleta)
    return { hist, termoFinal, origemFonte: 'NACIONAL' as 'NACIONAL', nivel }
  }
  const buscarPorItem = useCallback(async (nomeBase?: string) => {
    setLoading(true)
    setError(null)
    try {
      const ufAtual = await fetchUFAtual()
      setItemUF(ufAtual || '')
      const descricaoCompleta = String(nomeBase || selectedItem || '').trim()
      let termoLimpo = limparTermoBusca(descricaoCompleta)
      if (!termoLimpo && (objeto || '').trim()) {
        termoLimpo = limparTermoBusca(String(objeto).trim())
      }
      console.log('Original:', descricaoCompleta || objeto || '—', '-> Refinado para Busca:', termoLimpo || '—')
      if (!descricaoCompleta) {
          setResultados([])
          setAnalise([])
          setTermoUsado(termoLimpo)
          setError('Não encontramos histórico de preços para este item específico na base do PNCP.')
      } else {
        const termoFinal = termoLimpo
        const histBR = await buscarHistoricoTermo(termoFinal, undefined)
        const combined = histBR.slice(0, 10)
        setTermoUsado(termoFinal)
        setOrigem('NACIONAL')
        setStatusSource(itensVazios ? 'Usando Objeto Principal (Fallback)' : 'Itens Detectados')
        if (combined.length === 0) {
          setResultados([])
          setAnalise([])
          setError('Não encontramos histórico de preços para este item específico na base do PNCP.')
        } else {
          const valores = combined.map((h: any) => Number(getField(h, ['valorTotalHomologado','valorHomologado','valor'], 0)) || 0).filter((v: number) => v > 0)
          const media = valores.length ? (valores.reduce((a: number, b: number) => a + b, 0) / valores.length) : undefined
          const ultimo = combined.length ? Number(getField(combined[0], ['valorTotalHomologado','valorHomologado','valor'], 0)) || undefined : undefined
          const uf = ufAtual || ''
          const sugestao = media ? Number((media * 0.95).toFixed(2)) : undefined
          setResultados(combined.slice(0, 10))
          setAnalise([{ nome: termoFinal || descricaoCompleta, media, ultimo, sugestao, uf, historicoCount: combined.length }])
        }
      }
    } catch {
      setError('Não encontramos histórico de preços para este item específico na base do PNCP.')
      setResultados([])
      setAnalise([])
    } finally {
      setLoading(false)
    }
  }, [selectedItem, hoje, idParam])

  useEffect(() => {
    (async () => {
      const list = await fetchItensAtual()
      setItensLista(list)
      if (list.length > 0) {
        const textoOriginal = list[0]
        const termoRefinado = limparTermoBusca(textoOriginal)
        await buscarPorItem(termoRefinado)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idParam])
  useEffect(() => {
    if (selectedItem) {
      const termoRefinado = limparTermoBusca(selectedItem)
      buscarPorItem(termoRefinado)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem])

  useEffect(() => {
    (async () => {
      if (itensVazios && !objeto && idParam) {
        const ro = await fetch(`/api/pncp/objeto?numeroControlePNCP=${encodeURIComponent(idParam)}`, { cache: 'no-store' })
        if (ro.ok) {
          const jo = await ro.json().catch(() => null as any)
          const obj = asText(jo?.objeto || '')
          setObjeto(obj)
        }
      }
      if (itensVazios && objeto) {
        const termoRefinado = limparTermoBusca(objeto)
        await buscarPorItem(termoRefinado)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itensVazios, objeto, idParam])

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <Link href="/" className="inline-flex items-center gap-1 text-blue-800 hover:underline">
              <ChevronLeft className="h-4 w-4" />
              Fechar
            </Link>
            <span className="text-sm text-gray-600">🔍 INTELIGÊNCIA DE MERCADO - LicitMASA</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <Card>
              <CardHeader>
                <CardTitle className="text-base text-blue-900">
                  Análise de Preço
                </CardTitle>
              </CardHeader>
            </Card>
            <Link href="/" className="inline-flex items-center gap-1 rounded-md border px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
              Fechar
            </Link>
          </div>
          <div className="mt-4">
            {loading && (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-blue-800">
                  <Search className="h-4 w-4 animate-spin" />
                  {selectedItem ? `Buscando histórico para "${selectedItem}"...` : 'Buscando...'}
                </div>
                <div className="rounded-lg border bg-white p-6 text-sm text-gray-700">
                  Consultando base de dados do Governo...
                </div>
              </div>
            )}
            {!loading && resultados.length === 0 && analise.length === 0 && (
              <div className="rounded-lg border bg-white p-6 text-center text-sm text-gray-700">
                🔍 Buscamos por &#39;{termoUsado || '—'}&#39;, mas não há histórico recente no PNCP.
              </div>
            )}
            {!loading && analise.length > 0 && (
              <div className="rounded-lg border bg-slate-50 p-4">
                <div className="text-sm text-gray-800 font-semibold mb-2">Ganhadores</div>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="bg-gray-100 text-gray-700">
                        <th className="border p-2 text-left">Órgão</th>
                        <th className="border p-2 text-left">Data</th>
                        <th className="border p-2 text-left">Valor Vencedor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.map((item: any, idx: number) => {
                        const orgao = asText(getField(getField(item, ['orgaoEntidade'], {}), ['razaoSocial','nome'], '')) || '—'
                        const vHom = Number(getField(item, ['valorTotalHomologado','valorHomologado','valor'], 0)) || 0
                        const vEst = Number(getField(item, ['valorTotalEstimado','valorEstimado'], 0)) || 0
                        const valor = vHom || vEst || 0
                        const data = String(getField(item, ['dataPublicacaoPncp','data'], '')).slice(0, 10)
                        return (
                          <tr key={idx} className="hover:bg-gray-50">
                            <td className="border p-2">{orgao}</td>
                            <td className="border p-2">{data || '—'}</td>
                            <td className="border p-2">
                              <div className="flex items-center gap-2">
                                <span>{formatCurrencyBRL(valor)}</span>
                                {!vHom && vEst ? <Badge className="bg-yellow-100 text-yellow-800">Estimado</Badge> : null}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 rounded-md border bg-blue-50 p-3 text-sm text-blue-900">
                  {(() => {
                    const valores = resultados.map((r: any) => Number(getField(r, ['valorTotalHomologado','valorHomologado','valor'], 0)) || 0).filter((v: number) => v > 0)
                    const media = valores.length ? (valores.reduce((a: number, b: number) => a + b, 0) / valores.length) : undefined
                    return (
                      <div>💡 Preço Médio de Mercado: {media ? formatCurrencyBRL(media) : '—'}</div>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  )
}
export default function AnalisePrecoPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50" />}>
      <AnalisePrecoContent />
    </Suspense>
  )
}
