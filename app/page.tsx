'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Search, Building2, Calendar, FileText, Banknote, X, Gauge, LineChart } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { fetchContratacoesPage, formatDateYYYYMMDD } from '../lib/pncp'
import { supabase } from '../lib/supabaseClient'
import { SidebarAlerts } from '../components/premium/SidebarAlerts'
import { BottomNavigation } from '@/components/ui/bottom-navigation'
import Link from 'next/link'

type Resultado = any

const UFS = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'
]

function formatCurrencyBRL(value: number | string | undefined) {
  const num = typeof value === 'string' ? Number(value) : value
  if (!num || Number.isNaN(num)) return 'R$ 0,00'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num)
}
function formatCNPJ(v: any) {
  const s = String(v ?? '').replace(/\D/g, '')
  if (s.length !== 14) return String(v ?? '')
  return `${s.slice(0,2)}.${s.slice(2,5)}.${s.slice(5,8)}/${s.slice(8,12)}-${s.slice(12)}`
}

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
function modalidadeNome(raw: any, code?: number | string): string {
  const txt = asText(raw)
  const cnum = typeof code === 'string' ? Number(code) : typeof raw === 'number' ? raw : typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : typeof code === 'number' ? code : undefined
  const map: Record<number, string> = { 8: 'Pregão', 22: 'Dispensa', 21: 'Inexigibilidade', 4: 'Concurso', 5: 'Leilão' }
  if (txt) return txt
  if (cnum && map[cnum]) return map[cnum]
  return 'Modalidade'
}
function truncate(s: any, max: number = 150): string {
  const t = asText(s) || ''
  if (t.length <= max) return t
  return t.slice(0, max).replace(/\s+$/, '') + '...'
}
function sanitizeText(s: any): string {
  const t = asText(s) || ''
  return t.replace(/[\u0000-\u001F\u007F]/g, '').replace(/\s+/g, ' ').trim()
}

function limparPrefixos(texto: any): string {
  const t = sanitizeText(texto)
  if (!t) return ''
  const prefixos = [
    /^contrataç[aã]o de empresa para\s*/i,
    /^contrataç[aã]o\s+de\s*/i,
    /^aquisiç[aã]o\s+de\s*/i,
    /^fornecimento\s+de\s*/i,
    /^registro\s+de\s+preços\s+para\s*/i,
    /^registro\s+de\s+preços\s*/i,
  ]
  let s = t
  for (const rx of prefixos) {
    s = s.replace(rx, '')
  }
  return s.trim()
}

function resumirObjeto(texto: any): string {
  const base = limparPrefixos(texto)
  if (!base) return ''
  if (base.length > 150) {
    const curto = base.substring(0, 150) + '...'
    return curto.charAt(0).toUpperCase() + curto.slice(1)
  }
  return base.charAt(0).toUpperCase() + base.slice(1)
}

export default function HomePage() {
  const [termo, setTermo] = useState('')
  const [uf, setUf] = useState<string | undefined>(undefined)
  const [modalidade, setModalidade] = useState<string | ''>('')
  const [municipioIbge, setMunicipioIbge] = useState<string>('')
  const [cnpj, setCnpj] = useState<string>('')
  const [codigoUA, setCodigoUA] = useState<string>('')
  const [pagina, setPagina] = useState<number>(1)
  const [tamanhoPagina, setTamanhoPagina] = useState<number>(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultados, setResultados] = useState<Resultado[]>([])
  const [totalPages, setTotalPages] = useState<number>(1)
  const [loaded, setLoaded] = useState<boolean>(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [toasts, setToasts] = useState<Array<{ id: string, type: 'success' | 'error' | 'info', message: string }>>([])
  const [compact, setCompact] = useState<boolean>(true)
  const pullRef = useRef<HTMLDivElement | null>(null)
  const [pullY, setPullY] = useState<number>(0)
  const [isPulling, setIsPulling] = useState<boolean>(false)
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const [somenteHoje, setSomenteHoje] = useState(false)
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [detailsItem, setDetailsItem] = useState<any | null>(null)
  const [raioxOpen, setRaioxOpen] = useState(false)
  const [raioxItem, setRaioxItem] = useState<any | null>(null)
  const [editalObjetos, setEditalObjetos] = useState<Record<string, string>>({})
  const [editalLoading, setEditalLoading] = useState<Record<string, boolean>>({})
  const [carIndex, setCarIndex] = useState<number>(0)
  const [swipeStart, setSwipeStart] = useState<number | null>(null)
  const [swipeDelta, setSwipeDelta] = useState<number>(0)

  const hoje = useMemo(() => formatDateYYYYMMDD(new Date()), [])
  const inicio = useMemo(() => {
    const days = somenteHoje ? 0 : 2
    const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    return formatDateYYYYMMDD(d)
  }, [somenteHoje])
  useEffect(() => {
    document.title = 'LicitMASA'
  }, [])

  function addToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }

  async function carregarIniciais() {
    setLoading(true)
    setError(null)
    try {
      const page = await fetchContratacoesPage({
        dataInicial: inicio,
        dataFinal: hoje,
        pagina,
        tamanhoPagina,
      })
      setResultados(Array.isArray(page.items) ? page.items : (Array.isArray((page as any).data) ? (page as any).data : []))
      setTotalPages(Number(page.totalPages || 1))
      setLoaded(true)
      addToast('Licitações de hoje carregadas', 'info')
    } catch (e: any) {
      setError('Falha ao carregar licitações de hoje')
      setResultados([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarIniciais()
  }, [])

  useEffect(() => {
    setCarIndex(0)
  }, [resultados])

  async function buscar() {
    setLoading(true)
    setError(null)
    try {
      const page = await fetchContratacoesPage({
        dataInicial: inicio,
        dataFinal: hoje,
        termo: termo || undefined,
        uf: uf || undefined,
        codigoModalidadeContratacao: modalidade ? Number(modalidade) : undefined,
        codigoMunicipioIbge: municipioIbge ? Number(municipioIbge) : undefined,
        cnpj: cnpj || undefined,
        codigoUnidadeAdministrativa: codigoUA ? Number(codigoUA) : undefined,
        pagina,
        tamanhoPagina,
      })
      const list = Array.isArray(page.items) ? page.items : []
      setResultados(list)
      setTotalPages(Number(page.totalPages || 1))
      addToast('Resultados atualizados', 'success')
    } catch (e: any) {
      addToast('Não foi possível executar a busca', 'error')
      setResultados([])
    } finally {
      setLoading(false)
    }
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    const el = pullRef.current
    if (!el) return
    if (el.scrollTop <= 0) {
      setIsPulling(true)
      setPullY(0)
    }
  }
  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!isPulling) return
    const dy = e.touches[0].clientY
    setPullY((prev) => Math.min(120, Math.max(0, prev + dy * 0.01)))
  }
  function onTouchEnd() {
    if (isPulling && pullY > 60) {
      addToast('Atualizando...', 'info')
      buscar()
    }
    setIsPulling(false)
    setPullY(0)
  }

  function onSlideTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    setSwipeStart(e.touches[0].clientX)
    setSwipeDelta(0)
  }
  function onSlideTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (swipeStart === null) return
    const x = e.touches[0].clientX
    setSwipeDelta(x - swipeStart)
  }
  function onSlideTouchEnd() {
    if (Math.abs(swipeDelta) > 50) {
      if (swipeDelta < 0) {
        setCarIndex((i) => Math.min(resultados.length - 1, i + 1))
      } else {
        setCarIndex((i) => Math.max(0, i - 1))
      }
    }
    setSwipeStart(null)
    setSwipeDelta(0)
  }

  async function handleFavorite(item: any) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      addToast('Configure o Supabase no .env', 'error')
      return
    }
    if (!supabase) {
      addToast('Configure o Supabase no .env', 'error')
      return
    }
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) {
      addToast('Entre para favoritar', 'error')
      return
    }
    const { data: prof, error: profErr } = await supabase
      .from('profiles')
      .select('id, is_premium, email')
      .eq('id', user.id)
      .single()
    if (profErr && profErr.code === 'PGRST116') {
      await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
        is_premium: false,
      })
    }
    const isPremium = Boolean(prof?.is_premium)
    const { count } = await supabase
      .from('favorite_biddings')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
    if (!isPremium && (count ?? 0) >= 3) {
      setUpgradeOpen(true)
      return
    }
    const modalidade =
      getField(item, ['modalidade','modalidadeContratacao','modalidadeCompra','descricaoModalidade'], '')
    const orgao =
      getField(item, ['orgao','orgaoPublico','nomeUnidadeAdministrativa','uasgNome','entidade'], '')
    const valor =
      getField(item, ['valorEstimado','valorTotalEstimado','valor','valorContratacao'], 0)
    const dataPub =
      getField(item, ['dataPublicacao','dataInclusao','data'], '')
    const edital =
      getField(item, ['linkEdital','url','link'], '')
    const pncpId =
      getField(item, ['numeroControlePNCP','id','linkEdital'], String(Date.now()))
    let objetoBruto: string =
      getField(item, ['objetoCompra','objeto','objetoLicitacao','descricao','resumo','texto'], '')
    if (!objetoBruto && Array.isArray((item as any)?.itens)) {
      for (const it of (item as any).itens) {
        const cand = getField(it, ['objetoCompra','objeto','objetoLicitacao','descricao','resumo','texto'], '')
        if (cand) { objetoBruto = cand; break }
      }
    }
    if (!objetoBruto) {
      const key = String(pncpId || '')
      if (key) {
        const cached = String(editalObjetos[key] || '')
        if (cached) {
          objetoBruto = cached
        } else {
          const url = buildEditalUrl(item)
          if (url) {
            const fetched = await extrairObjetoDoEdital(url, String(pncpId || ''))
            if (fetched) {
              objetoBruto = fetched
              setEditalObjetos((prev) => ({ ...prev, [key]: fetched }))
            }
          }
        }
      }
    }
    const objeto = sanitizeText(objetoBruto) || ''
    const title = `${String(modalidade || 'Modalidade')} • ${String(objeto || 'Objeto')}`
    const { error } = await supabase.from('favorite_biddings').insert({
      user_id: user.id,
      pncp_id: String(pncpId),
      title,
      organ_name: String(orgao || ''),
      estimated_value: Number(valor || 0),
      link_edital: String(edital || ''),
      data_abertura: dataPub ? new Date(String(dataPub)) : null,
    })
    if (error) {
      addToast('Erro ao favoritar', 'error')
      return
    }
    addToast('Favorito salvo', 'success')
  }
  function mudarPagina(next: number) {
    const p = Math.max(1, next)
    setPagina(p)
  }

  useEffect(() => {
    if (loaded) {
      buscar()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagina, tamanhoPagina])

  function buildEditalUrl(it: any): string {
    const idStr = String(getField(it, ['numeroControlePNCP','numeroSequencial','id'], ''))
    if (idStr) {
      const slashIdx = idStr.lastIndexOf('/')
      const ano = slashIdx !== -1 ? idStr.slice(slashIdx + 1).replace(/[^0-9]/g, '') : ''
      const before = slashIdx !== -1 ? idStr.slice(0, slashIdx) : idStr
      const parts = before.split('-')
      const cnpj = (parts[0] || '').replace(/\D/g, '')
      const seqRaw = parts[2] || ''
      const sequencial = String(seqRaw).replace(/\D/g, '').replace(/^0+/, '')
      if (cnpj && ano && sequencial) {
        return `https://pncp.gov.br/app/editais/${cnpj}/${ano}/${sequencial}`
      }
    }
    const editalRaw = getField(it, ['linkEdital','url','link'], '')
    return String(editalRaw || 'https://pncp.gov.br/')
  }

  async function extrairObjetoDoEdital(url: string, pncpId?: string): Promise<string> {
    if (!url) return ''
    try {
      const apiUrl = `/api/pncp/objeto?url=${encodeURIComponent(url)}${pncpId ? `&numeroControlePNCP=${encodeURIComponent(pncpId)}` : ''}`
      const res = await fetch(apiUrl, { headers: { accept: 'application/json' }, cache: 'no-store' })
      if (!res.ok) return ''
      const data = await res.json().catch(() => null)
      const obj = (data && typeof data.objeto === 'string') ? data.objeto : ''
      return sanitizeText(obj)
    } catch {
      return ''
    }
  }

  useEffect(() => {}, [resultados])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="pointer-events-none fixed top-2 left-1/2 z-50 -translate-x-1/2 space-y-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={
              (t.type === 'success'
                ? 'bg-green-100 text-green-800'
                : t.type === 'error'
                ? 'bg-red-100 text-red-800'
                : 'bg-blue-100 text-blue-800') +
              ' pointer-events-auto rounded-md px-4 py-2 text-sm shadow transition-all duration-300 ease-out'
            }
          >
            {t.message}
          </div>
        ))}
      </div>

      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-blue-900">LicitMASA</h1>
            <p className="mt-1 text-sm text-gray-600">O radar de oportunidades para sua empresa</p>
          </div>
          <div className="flex items-center gap-3">
            {loading && (
              <div className="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs text-blue-800">
                <Search className="h-4 w-4 animate-spin" />
                Buscando...
              </div>
            )}
            <SidebarAlerts />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-3 md:grid md:grid-cols-[1fr,auto] md:items-center">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-700" />
              <Input
                placeholder="Palavra-chave (ex: limpeza, TI, alimentos)"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setFiltersOpen(true)} className="bg-gray-100 text-gray-800 hover:bg-gray-200 md:hidden">
                Filtros
              </Button>
              <Button onClick={buscar} disabled={loading} className="bg-blue-800 hover:bg-blue-700 text-white">
                {loading ? <Search className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? 'Buscando...' : 'Buscar'}
              </Button>
              <Button
                onClick={() => setCompact((c) => !c)}
                className="bg-gray-100 text-gray-800 hover:bg-gray-200"
              >
                {compact ? 'Modo completo' : 'Modo compacto'}
              </Button>
            </div>
          </div>
          <div className="mt-3 hidden grid-cols-1 gap-4 md:grid md:grid-cols-[160px,120px,160px,160px,1fr]">
            <Select value={uf || ''} onChange={(e) => setUf(e.target.value || undefined)}>
              <option value="">UF</option>
              {UFS.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </Select>
            <Select value={modalidade} onChange={(e) => setModalidade(e.target.value)}>
              <option value="">Modalidade</option>
              <option value="8">Pregão (8)</option>
              <option value="22">Dispensa (22)</option>
              <option value="21">Inexigibilidade (21)</option>
              <option value="4">Concurso (4)</option>
              <option value="5">Leilão (5)</option>
            </Select>
            <Input
              placeholder="Município IBGE (ex: 5300108)"
              value={municipioIbge}
              onChange={(e) => setMunicipioIbge(e.target.value)}
            />
            <Input
              placeholder="CNPJ (ex: 00059311000126)"
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
            />
            <Input
              placeholder="Código UA (ex: 194035)"
              value={codigoUA}
              onChange={(e) => setCodigoUA(e.target.value)}
            />
            <Button
              onClick={() => setSomenteHoje((v) => !v)}
              className={"bg-gray-100 text-gray-800 hover:bg-gray-200 " + (somenteHoje ? "border border-blue-300" : "")}
            >
              {somenteHoje ? "Somente hoje" : "Últimos 3 dias"}
            </Button>
          </div>
          <div className="mt-3 text-xs text-gray-500">Exibindo publicações de {inicio} a {hoje}</div>
          <div className="mt-4 flex items-center justify-between">
            <div className="text-xs text-gray-500">Página {pagina} de {totalPages}</div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => { mudarPagina(pagina - 1) }}
                className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                disabled={pagina <= 1}
              >
                Anterior
              </Button>
              <Button
                onClick={() => { mudarPagina(pagina + 1) }}
                className="bg-gray-100 text-gray-700 hover:bg-gray-200"
                disabled={pagina >= totalPages}
              >
                Próxima
              </Button>
              <Select
                value={String(tamanhoPagina)}
                onChange={(e) => setTamanhoPagina(Number(e.target.value))}
              >
                <option value="10">10</option>
                <option value="20">20</option>
                <option value="50">50</option>
              </Select>
            </div>
          </div>
        </section>

        <div className={"fixed inset-0 z-40 md:hidden " + (filtersOpen ? '' : 'pointer-events-none')}>
          <div
            className={
              "absolute inset-0 bg-black/30 transition-opacity duration-300 " +
              (filtersOpen ? 'opacity-100' : 'opacity-0')
            }
            onClick={() => setFiltersOpen(false)}
          />
          <div
            className={
              "absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-xl border bg-white p-4 shadow-lg transition-transform duration-300 ease-out " +
              (filtersOpen ? 'translate-y-0' : 'translate-y-full')
            }
          >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-gray-800">Filtros</span>
                <Button onClick={() => setFiltersOpen(false)} className="bg-gray-100 text-gray-800 hover:bg-gray-200">
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <Select value={uf || ''} onChange={(e) => setUf(e.target.value || undefined)}>
                  <option value="">UF</option>
                  {UFS.map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </Select>
                <Select value={modalidade} onChange={(e) => setModalidade(e.target.value)}>
                  <option value="">Modalidade</option>
                  <option value="8">Pregão (8)</option>
                  <option value="22">Dispensa (22)</option>
                  <option value="21">Inexigibilidade (21)</option>
                  <option value="4">Concurso (4)</option>
                  <option value="5">Leilão (5)</option>
                </Select>
                <Input
                  placeholder="Município IBGE (ex: 5300108)"
                  value={municipioIbge}
                  onChange={(e) => setMunicipioIbge(e.target.value)}
                />
                <Input
                  placeholder="CNPJ (ex: 00059311000126)"
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                />
                <Input
                  placeholder="Código UA (ex: 194035)"
                  value={codigoUA}
                  onChange={(e) => setCodigoUA(e.target.value)}
                />
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600">Tamanho</span>
                  <Select
                    value={String(tamanhoPagina)}
                    onChange={(e) => setTamanhoPagina(Number(e.target.value))}
                  >
                    <option value="10">10</option>
                    <option value="20">20</option>
                    <option value="50">50</option>
                  </Select>
                </div>
                <Button
                  onClick={() => setSomenteHoje((v) => !v)}
                  className={"bg-gray-100 text-gray-800 hover:bg-gray-200 " + (somenteHoje ? "border border-blue-300" : "")}
                >
                  {somenteHoje ? "Somente hoje" : "Últimos 3 dias"}
                </Button>
                <Button onClick={() => { setFiltersOpen(false); buscar() }} className="bg-blue-800 hover:bg-blue-700 text-white">
                  Aplicar filtros
                </Button>
              </div>
            </div>
        </div>

        <div
          ref={pullRef}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          className="relative mt-8"
        >
          <div
            className={
              "pointer-events-none absolute -top-6 left-1/2 z-10 -translate-x-1/2 rounded-full border bg-white px-3 py-1 text-xs text-gray-700 transition-transform duration-300 " +
              (isPulling ? 'translate-y-2' : '')
            }
          >
            <Search className="mr-1 inline h-3 w-3 animate-bounce" />
            Puxe para atualizar
          </div>
        <section className="mt-0">
          {loading && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse transition-opacity duration-300">
                  <CardHeader>
                    <div className="h-4 w-24 rounded bg-gray-200" />
                    <div className="mt-2 h-5 w-3/4 rounded bg-gray-200" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-4 w-full rounded bg-gray-200" />
                      <div className="h-4 w-2/3 rounded bg-gray-200" />
                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-8 w-24 rounded bg-gray-200" />
                        <div className="h-8 w-32 rounded bg-gray-200" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {!loading && !error && resultados.length === 0 && (
            <div className="rounded-lg border bg-white p-12 text-center text-sm text-gray-600">
              Nenhum resultado encontrado
            </div>
          )}

          {!loading && !error && resultados.length > 0 && (
            <>
              <div
                className="md:hidden relative overflow-hidden rounded-xl border bg-white"
                style={{ height: `calc(100vh - 220px)` }}
              >
                <div className="pointer-events-none absolute right-3 top-3 z-10 rounded-full bg-blue-900/90 px-3 py-1 text-xs font-medium text-white">
                  {carIndex + 1} de {resultados.length}
                </div>
                <div
                  className="h-full w-full"
                  onTouchStart={onSlideTouchStart}
                  onTouchMove={onSlideTouchMove}
                  onTouchEnd={onSlideTouchEnd}
                >
                  <div
                    className="flex h-full transition-transform duration-300"
                    style={{ transform: `translateX(calc(-${carIndex} * 100% + ${swipeDelta}px))` }}
                  >
                    {resultados.map((item: any, idx: number) => {
                      const modalidadeRaw =
                        getField(item, ['modalidadeNome','modalidade','modalidadeContratacao','modalidadeCompra','descricaoModalidade'], '')
                      const modalidadeCode =
                        getField(item, ['codigoModalidadeContratacao'], undefined)
                      const orgaoRaw =
                        getField(item, ['orgaoEntidade'], '')
                      let objetoRaw =
                        getField(item, ['objetoCompra','objeto','objetoLicitacao','descricao','resumo','texto'], '')
                      if (!objetoRaw && Array.isArray((item as any)?.itens)) {
                        for (const it of (item as any).itens) {
                          const cand = getField(it, ['objetoCompra','objeto','objetoLicitacao','descricao','resumo','texto'], '')
                          if (cand) { objetoRaw = cand; break }
                        }
                      }
                      const valor =
                        getField(item, ['valorEstimado','valorTotalEstimado','valor','valorContratacao'], 0)
                      const dataPub =
                        getField(item, ['dataPublicacao','dataInclusao','data'], '')
                      const pncpId =
                        getField(item, ['numeroControlePNCP','numeroSequencial','id'], '')
                      const editalRaw =
                        getField(item, ['linkEdital','url','link'], '')
                      const ufItem =
                        getField(getField(item, ['unidadeOrgao'], {}), ['ufSigla'], uf || '')
                      const municipioNomeRaw =
                        getField(getField(item, ['unidadeOrgao'], {}), ['municipioNome'], '')
                      const municipioCodigo =
                        getField(item, ['codigoMunicipioIbge'], '')
                      const orgaoObj = typeof orgaoRaw === 'object' ? orgaoRaw : null
                      const cnpjRaw =
                        (orgaoObj ? getField(orgaoObj, ['cnpj','numeroDocumento','documento'], '') : '') ||
                        getField(item, ['cnpj'], '')
                      const uaCodigo =
                        getField(item, ['codigoUnidadeAdministrativa','uaCodigo','uasgCodigo'], '')
                      const modalidade = modalidadeNome(modalidadeRaw, modalidadeCode)
                      const orgao = asText(getField(orgaoObj || {}, ['razaoSocial'], orgaoRaw)) || 'Órgão não informado'
                      const textoObjeto = getField(item, ['objetoCompra'], '') || ''
                      const objetoLimpo = limparPrefixos(textoObjeto || '')
                      const objetoDisplay =
                        String(textoObjeto).length > 240
                          ? String(textoObjeto).substring(0, 240).replace(/^(Contratação de empresa para |Aquisição de |Fornecimento de )/i, '') + '...'
                          : String(textoObjeto)
                      const cnpjDigits = String(cnpjRaw || '').replace(/\D/g, '')
                      let ano = getField(item, ['anoCompra'], '') ||
                        getField(item, ['ano','anoProposta','anoPublicacao'], '') ||
                        (String(dataPub || '').slice(0, 4) || '')
                      let sequencial = getField(item, ['sequencialCompra'], '') ||
                        getField(item, ['numeroSequencial'], '')
                      if ((!ano || !sequencial) && pncpId) {
                        const idStr = String(pncpId)
                        const slashIdx = idStr.lastIndexOf('/')
                        if (!ano && slashIdx !== -1) {
                          const a = idStr.slice(slashIdx + 1)
                          if (/^\d{4}$/.test(a)) ano = a
                        }
                        const before = slashIdx !== -1 ? idStr.slice(0, slashIdx) : idStr
                        const dashIdx = before.lastIndexOf('-')
                        if (!sequencial && dashIdx !== -1) {
                          const seq = before.slice(dashIdx + 1).replace(/^0+/, '')
                          if (/^\d+$/.test(seq)) sequencial = seq
                        }
                      }
                      const edital =
                        cnpjDigits && ano && sequencial
                          ? `https://pncp.gov.br/app/editais/${cnpjDigits}/${ano}/${sequencial}`
                          : String(editalRaw || 'https://pncp.gov.br/')
                      const municipio =
                        asText(municipioNomeRaw) || (municipioCodigo ? `IBGE ${String(municipioCodigo)}` : '')
                      const cnpj = formatCNPJ(cnpjRaw)
                      return (
                        <div key={idx} className="min-w-full h-full p-4">
                          <div className="flex h-full flex-col justify-between">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Badge className="bg-indigo-100 text-indigo-800">{modalidade}</Badge>
                                <div className="text-lg font-semibold text-gray-900">{orgao}</div>
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-gray-800">
                                {objetoDisplay || 'Descrição não disponível'}
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-gray-700">
                                  <Banknote className="h-4 w-4 text-indigo-700" />
                                  {formatCurrencyBRL(getField(item, ['valorEstimado','valorTotalEstimado','valor','valorContratacao'], 0))}
                                </div>
                                <div className="flex items-center gap-2 rounded-md border px-3 py-2 text-gray-700">
                                  <Calendar className="h-4 w-4 text-indigo-700" />
                                  {String(getField(item, ['dataPublicacao','dataInclusao','data'], '') || '').slice(0, 10)}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-gray-700">
                                <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">{String(ufItem || '-')}</span>
                                <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">{municipio ? municipio : '-'}</span>
                                <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">{cnpj ? `CNPJ ${cnpj}` : '-'}</span>
                                <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">{uaCodigo ? `UA ${String(uaCodigo)}` : '-'}</span>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-col gap-3">
                              <a
                                href={edital}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-700 px-3 py-2 text-sm font-medium text-white shadow hover:bg-indigo-600"
                              >
                                <FileText className="h-4 w-4" />
                                Ver Edital
                              </a>
                              <div className="grid grid-cols-2 gap-3">
                                <Link
                                  href={`/analise-preco?obj=${encodeURIComponent(objetoLimpo || '')}`}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-50"
                                >
                                  Análise de Preço
                                </Link>
                                <Button
                                  onClick={() => handleFavorite(item)}
                                  className="bg-gray-900 text-white hover:bg-gray-800"
                                >
                                  Favoritar
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="hidden md:block rounded-xl border bg-white divide-y">
              {resultados.map((item: any, idx: number) => {
                const modalidadeRaw =
                  getField(item, ['modalidadeNome','modalidade','modalidadeContratacao','modalidadeCompra','descricaoModalidade'], '')
                const modalidadeCode =
                  getField(item, ['codigoModalidadeContratacao'], undefined)
                const orgaoRaw =
                  getField(item, ['orgaoEntidade'], '')
                let objetoRaw =
                  getField(item, ['objetoCompra','objeto','objetoLicitacao','descricao','resumo','texto'], '')
                if (!objetoRaw && Array.isArray((item as any)?.itens)) {
                  for (const it of (item as any).itens) {
                    const cand = getField(it, ['objetoCompra','objeto','objetoLicitacao','descricao','resumo','texto'], '')
                    if (cand) { objetoRaw = cand; break }
                  }
                }
                const valor =
                  getField(item, ['valorEstimado','valorTotalEstimado','valor','valorContratacao'], 0)
                const dataPub =
                  getField(item, ['dataPublicacao','dataInclusao','data'], '')
                const pncpId =
                  getField(item, ['numeroControlePNCP','numeroSequencial','id'], '')
                const editalRaw =
                  getField(item, ['linkEdital','url','link'], '')
                const ufItem =
                  getField(getField(item, ['unidadeOrgao'], {}), ['ufSigla'], uf || '')
                const municipioNomeRaw =
                  getField(getField(item, ['unidadeOrgao'], {}), ['municipioNome'], '')
                const municipioCodigo =
                  getField(item, ['codigoMunicipioIbge'], '')
                const orgaoObj = typeof orgaoRaw === 'object' ? orgaoRaw : null
                const cnpjRaw =
                  (orgaoObj ? getField(orgaoObj, ['cnpj','numeroDocumento','documento'], '') : '') ||
                  getField(item, ['cnpj'], '')
                const uaCodigo =
                  getField(item, ['codigoUnidadeAdministrativa','uaCodigo','uasgCodigo'], '')
                const modalidade = modalidadeNome(modalidadeRaw, modalidadeCode)
                const orgao = asText(getField(orgaoObj || {}, ['razaoSocial'], orgaoRaw)) || 'Órgão não informado'
                const objeto = sanitizeText(objetoRaw) || ''
                const cnpjDigits = String(cnpjRaw || '').replace(/\D/g, '')
                let ano = getField(item, ['anoCompra'], '') ||
                  getField(item, ['ano','anoProposta','anoPublicacao'], '') ||
                  (String(dataPub || '').slice(0, 4) || '')
                let sequencial = getField(item, ['sequencialCompra'], '') ||
                  getField(item, ['numeroSequencial'], '')
                if ((!ano || !sequencial) && pncpId) {
                  const idStr = String(pncpId)
                  const slashIdx = idStr.lastIndexOf('/')
                  if (!ano && slashIdx !== -1) {
                    const a = idStr.slice(slashIdx + 1)
                    if (/^\d{4}$/.test(a)) ano = a
                  }
                  const before = slashIdx !== -1 ? idStr.slice(0, slashIdx) : idStr
                  const dashIdx = before.lastIndexOf('-')
                  if (!sequencial && dashIdx !== -1) {
                    const seq = before.slice(dashIdx + 1).replace(/^0+/, '')
                    if (/^\d+$/.test(seq)) sequencial = seq
                  }
                }
                const edital =
                  cnpjDigits && ano && sequencial
                    ? `https://pncp.gov.br/app/editais/${cnpjDigits}/${ano}/${sequencial}`
                    : String(editalRaw || 'https://pncp.gov.br/')
                const municipio =
                  asText(municipioNomeRaw) || (municipioCodigo ? `IBGE ${String(municipioCodigo)}` : '')
                const cnpj = formatCNPJ(cnpjRaw)
                const textoObjeto = getField(item, ['objetoCompra'], '') || ''
                const objetoLimpo = limparPrefixos(textoObjeto || '')
                const objetoDisplay =
                  String(textoObjeto).length > 160
                    ? String(textoObjeto).substring(0, 160).replace(/^(Contratação de empresa para |Aquisição de |Fornecimento de )/i, '') + '...'
                    : String(textoObjeto)
                return (
                  <div key={idx} className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-blue-100 text-blue-800">{modalidade}</Badge>
                        <div className="text-base font-medium text-gray-900 truncate">{orgao}</div>
                      </div>
                      <div className="mt-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-gray-800">
                        {objetoDisplay || 'Descrição não disponível'}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-700">
                        <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">{String(ufItem || '-')}</span>
                        <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">{municipio ? municipio : '-'}</span>
                        {!compact && (
                          <>
                            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">{cnpj ? `CNPJ ${cnpj}` : '-'}</span>
                            <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">{uaCodigo ? `UA ${String(uaCodigo)}` : '-'}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className="w-full md:w-auto flex md:flex-col items-center md:items-end gap-3">
                      <div className="flex items-center gap-3">
                        <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-gray-700">
                          <Banknote className="h-4 w-4 text-blue-700" />
                          {formatCurrencyBRL(valor)}
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-gray-700">
                          <Calendar className="h-4 w-4 text-blue-700" />
                          {String(dataPub || '').slice(0, 10)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={edital}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                        >
                          <FileText className="h-4 w-4" />
                          Ver Edital
                        </a>
                        <Link
                          href={`/analise-preco?obj=${encodeURIComponent(objetoLimpo || '')}`}
                          className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
                        >
                          <LineChart className="h-4 w-4 text-blue-700" />
                          Análise de Preço
                        </Link>
                        <Button
                          onClick={() => { setRaioxItem(item); setRaioxOpen(true) }}
                          className="bg-gray-100 text-gray-800 hover:bg-gray-200 text-xs px-2 py-1"
                        >
                          <Gauge className="h-4 w-4 text-blue-700" />
                          Raio-X
                        </Button>
                        <Button
                          onClick={() => { setDetailsItem(item); setDetailsOpen(true) }}
                          className="bg-gray-100 text-gray-800 hover:bg-gray-200"
                        >
                          Detalhes
                        </Button>
                        <Button
                          onClick={() => handleFavorite(item)}
                          className="bg-gray-900 text-white hover:bg-gray-800"
                        >
                          Favoritar
                        </Button>
                        {!compact && (
                          <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-gray-700">
                            <Building2 className="h-4 w-4 text-blue-700" />
                            {pncpId ? String(pncpId) : (uf || 'UF')}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              </div>
            </>
          )}
        </section>
        <div className={"fixed inset-0 z-50 " + (raioxOpen ? '' : 'pointer-events-none')}>
          <div
            className={
              "absolute inset-0 bg-black/40 transition-opacity duration-300 " +
              (raioxOpen ? 'opacity-100' : 'opacity-0')
            }
            onClick={() => { setRaioxOpen(false); setRaioxItem(null) }}
          />
          <div
            className={
              "absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border bg-white p-6 shadow-lg transition-transform duration-300 ease-out " +
              (raioxOpen ? 'translate-y-0' : 'translate-y-full')
            }
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-lg font-semibold text-blue-900">Raio-X da Oportunidade</div>
              <Button onClick={() => { setRaioxOpen(false); setRaioxItem(null) }} className="bg-gray-100 text-gray-800 hover:bg-gray-200">Fechar</Button>
            </div>
            {raioxItem ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 text-sm text-gray-800">
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Exclusividade (ME/EPP)</div>
                  <div className="font-medium">
                    {String(
                      getField(raioxItem, ['exclusivoMeEpp','exclusivoME','somenteMeEpp','exclusivoME_EPP'], false)
                    ) === 'true'
                      ? 'Sim'
                      : 'Não'}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Contagem Regressiva</div>
                  <div className="font-medium">
                    {(() => {
                      const fim = getField(raioxItem, ['dataEncerramento','dataFim','dataLimite','dataTermino'], '')
                      const d = fim ? new Date(String(fim)) : null
                      if (!d || Number.isNaN(d.getTime())) return '—'
                      const ms = d.getTime() - Date.now()
                      if (ms <= 0) return 'Encerrado'
                      const dd = Math.floor(ms / (24 * 60 * 60 * 1000))
                      const hh = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
                      const mm = Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000))
                      return `${dd}d ${hh}h ${mm}m`
                    })()}
                  </div>
                </div>
                <div className="rounded-md border p-3">
                  <div className="text-xs text-gray-500">Critério</div>
                  <div className="font-medium">
                    {String(
                      getField(raioxItem, ['criterioJulgamento','tipoJulgamento','criterio'], '')
                    ) || '—'}
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
        <div className={"fixed inset-0 z-50 " + (detailsOpen ? '' : 'pointer-events-none')}>
          <div
            className={
              "absolute inset-0 bg-black/40 transition-opacity duration-300 " +
              (detailsOpen ? 'opacity-100' : 'opacity-0')
            }
            onClick={() => { setDetailsOpen(false); setDetailsItem(null) }}
          />
          <div
            className={
              "absolute bottom-0 left-0 right-0 max-h-[70vh] overflow-y-auto rounded-t-2xl border bg-white p-6 shadow-lg transition-transform duration-300 ease-out " +
              (detailsOpen ? 'translate-y-0' : 'translate-y-full')
            }
          >
            <div className="mb-2 text-lg font-semibold text-blue-900">Detalhes da publicação</div>
            {detailsItem ? (
              <div className="space-y-3 text-sm text-gray-800">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-gray-500">Modalidade</div>
                    <div className="font-medium">
                      {modalidadeNome(
                        getField(detailsItem, ['modalidade','modalidadeContratacao','modalidadeCompra','descricaoModalidade'], ''),
                        getField(detailsItem, ['codigoModalidadeContratacao'], undefined)
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Órgão</div>
                    <div className="font-medium">
                      {asText(getField(getField(detailsItem, ['orgaoEntidade'], {}), ['razaoSocial'], '')) || 'Órgão não informado'}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-gray-500">Objeto</div>
                    <div className="font-medium">
                      {asText(getField(detailsItem, ['objeto','descricao','resumo','texto'], '')) || 'Objeto indisponível'}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Valor</div>
                    <div className="font-medium">
                      {formatCurrencyBRL(getField(detailsItem, ['valorEstimado','valorTotalEstimado','valor','valorContratacao'], 0))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Data</div>
                    <div className="font-medium">
                      {String(getField(detailsItem, ['dataPublicacao','dataInclusao','data'], '') || '').slice(0, 10)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">UF</div>
                    <div className="font-medium">
                      {String(getField(getField(detailsItem, ['unidadeOrgao'], {}), ['ufSigla'], uf || '-'))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Município</div>
                    <div className="font-medium">
                      {asText(getField(getField(detailsItem, ['unidadeOrgao'], {}), ['municipioNome'], '')) ||
                        (getField(detailsItem, ['codigoMunicipioIbge'], '') ? `IBGE ${String(getField(detailsItem, ['codigoMunicipioIbge'], ''))}` : '-')}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">CNPJ do Órgão</div>
                    <div className="font-medium">
                      {formatCNPJ(
                        getField(detailsItem, ['orgao','orgaoPublico','entidade'], null)
                          ? getField(getField(detailsItem, ['orgao','orgaoPublico','entidade'], {}), ['cnpj','numeroDocumento','documento'], '')
                          : getField(detailsItem, ['cnpj'], '')
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Código UA</div>
                    <div className="font-medium">
                      {String(getField(detailsItem, ['codigoUnidadeAdministrativa','uaCodigo','uasgCodigo'], 'UA'))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">ID PNCP</div>
                    <div className="font-medium">
                      {String(getField(detailsItem, ['numeroControlePNCP','numeroSequencial','id'], ''))}
                    </div>
                  </div>
                  <div className="col-span-2">
                    <a
                      href={(function () {
                        const orgaoEnt = getField(detailsItem, ['orgaoEntidade'], {})
                        const cnpjDet = String(getField(orgaoEnt, ['cnpj'], '')).replace(/\D/g, '')
                        let anoDet = getField(detailsItem, ['anoCompra'], '')
                        let seqDet = getField(detailsItem, ['sequencialCompra'], '')
                        if (!anoDet || !seqDet) {
                          const idStr = String(getField(detailsItem, ['numeroControlePNCP','id'], ''))
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
                        const fallback = String(getField(detailsItem, ['linkEdital','url','link'], 'https://pncp.gov.br/'))
                        return cnpjDet && anoDet && seqDet
                          ? `https://pncp.gov.br/app/editais/${cnpjDet}/${anoDet}/${seqDet}`
                          : fallback
                      })()}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-md bg-blue-800 px-3 py-2 text-xs font-medium text-white hover:bg-blue-700"
                    >
                      Ver Edital
                    </a>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex items-center justify-end">
              <Button onClick={() => { setDetailsOpen(false); setDetailsItem(null) }} className="bg-gray-100 text-gray-800 hover:bg-gray-200">
                Fechar
              </Button>
            </div>
          </div>
        </div>
        <div className={"fixed inset-0 z-50 " + (upgradeOpen ? '' : 'pointer-events-none')}>
          <div
            className={
              "absolute inset-0 bg-black/40 transition-opacity duration-300 " +
              (upgradeOpen ? 'opacity-100' : 'opacity-0')
            }
            onClick={() => setUpgradeOpen(false)}
          />
          <div
            className={
              "absolute bottom-0 left-0 right-0 max-h-[60vh] overflow-y-auto rounded-t-2xl border bg-white p-6 shadow-lg transition-transform duration-300 ease-out " +
              (upgradeOpen ? 'translate-y-0' : 'translate-y-full')
            }
          >
            <div className="mb-2 text-lg font-semibold text-blue-900">Plano Pro</div>
            <p className="text-sm text-gray-700">
              Você atingiu o limite de 3 favoritos no plano Gratuito. Ative o Pro para favoritos ilimitados e alertas automáticos.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Button className="bg-blue-800 text-white hover:bg-blue-700">Ver planos</Button>
              <Button onClick={() => setUpgradeOpen(false)} className="bg-gray-100 text-gray-800 hover:bg-gray-200">
                Fechar
              </Button>
            </div>
          </div>
        </div>
        </div>
      </main>
      <BottomNavigation />
    </div>
  )
}
