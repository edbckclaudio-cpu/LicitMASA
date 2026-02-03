'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Search, Building2, Calendar, FileText, Banknote, X, SearchCheck, Info, MessageCircle, MapPin, RotateCcw, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Select } from '../components/ui/select'
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { fetchContratacoesPage, formatDateYYYYMMDD } from '../lib/pncp'
import { requestAndSaveToken } from '../lib/firebase'
import { supabase } from '../lib/supabaseClient'
import { SidebarAlerts } from '../components/premium/SidebarAlerts'
import { BottomNavigation } from '@/components/ui/bottom-navigation'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

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
  const router = useRouter()
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
  const [modToastOpen, setModToastOpen] = useState<boolean>(false)
  const [modToastMin, setModToastMin] = useState<boolean>(false)
  const modTimers = useRef<{ min?: number, close?: number }>({})
  const [modToastManual, setModToastManual] = useState<boolean>(false)
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
  const [raioxExtra, setRaioxExtra] = useState<{
    modoDisputa?: string,
    dataEncerramento?: string,
    dataAbertura?: string,
    horaAbertura?: string,
    plataforma?: string,
    disputaAbertaFechada?: string,
  } | null>(null)
  const [editalObjetos, setEditalObjetos] = useState<Record<string, string>>({})
  const [editalLoading, setEditalLoading] = useState<Record<string, boolean>>({})
  const [carIndex, setCarIndex] = useState<number>(0)
  const [swipeStart, setSwipeStart] = useState<number | null>(null)
  const [swipeDelta, setSwipeDelta] = useState<number>(0)
  const [loggedIn, setLoggedIn] = useState<boolean>(false)
  const [isPremium, setIsPremium] = useState<boolean | null>(null)
  const [planLoading, setPlanLoading] = useState<boolean>(true)
  const [checkingPremiumAction, setCheckingPremiumAction] = useState<boolean>(false)
  const planPrice = process.env.NEXT_PUBLIC_PLAN_PRICE || '49,90'
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const playProductId = process.env.NEXT_PUBLIC_PLAY_PRODUCT_ID || ''
  const [showPremiumBanner, setShowPremiumBanner] = useState<boolean>(false)
  const [ordenar, setOrdenar] = useState<'data' | 'valor_desc' | 'valor_asc'>('data')
  const [userId, setUserId] = useState<string | null>(null)
  const [debugAlertShown, setDebugAlertShown] = useState<boolean>(false)

  const hoje = useMemo(() => formatDateYYYYMMDD(new Date()), [])
  const inicio = useMemo(() => {
    const days = somenteHoje ? 0 : 2
    const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    return formatDateYYYYMMDD(d)
  }, [somenteHoje])
  useEffect(() => {
    document.title = 'Buscar Publicações'
  }, [])
  const loadUserPlan = useCallback(async () => {
    if (!supabase) return
    setPlanLoading(true)
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) {
      setLoggedIn(false)
      setUserId(null)
      setIsPremium(false)
      setShowPremiumBanner(true)
      setTimeout(() => setShowPremiumBanner(false), 5000)
      setPlanLoading(false)
      return
    }
    setLoggedIn(true)
    setUserId(user.id)
    const { data: prof } = await supabase.from('profiles').select('id, is_premium, plan, email').eq('id', user.id).maybeSingle()
    try {
      console.log('LOAD_USER_PLAN_IDENTIDADE', {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
        userId: user.id,
        userEmail: user.email || null,
        profileId: (prof as any)?.id ?? null,
        profileEmail: (prof as any)?.email ?? null,
        is_premium: prof?.is_premium ?? null,
        plan: prof?.plan ?? null,
      })
    } catch {}
    try {
      const uemail = user.email || null
      const pemail = (prof as any)?.email ?? null
      if (uemail && !pemail) {
        await supabase.from('profiles').upsert({ id: user.id, email: uemail }, { onConflict: 'id' })
      }
    } catch {}
    const allow = String(process.env.NEXT_PUBLIC_PREMIUM_EMAILS || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean)
    const email = String(user.email || '').toLowerCase()
    let premium = Boolean(prof?.is_premium) || String(prof?.plan || '').toLowerCase() === 'premium' || allow.includes(email)
    if (!premium) {
      try {
        if (email) {
          await fetch('/api/profile/merge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
            body: JSON.stringify({ userId: user.id, email })
          }).catch(() => {})
        }
      } catch {}
      try {
        const r = await fetch('/api/profile/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
          body: JSON.stringify({ userId: user.id })
        })
        if (r.ok) {
          const j = await r.json()
          try {
            console.log('LOAD_USER_PLAN_STATUS', {
              userId: user.id,
              isPremiumFromStatus: Boolean(j?.isPremium),
            })
          } catch {}
          premium = Boolean(j?.isPremium)
        }
      } catch {}
    }
    if (!premium) {
      try {
        const w: any = typeof window !== 'undefined' ? window : null
        if (w && 'getDigitalGoodsService' in w && playProductId) {
          const svc = await w.getDigitalGoodsService('https://play.google.com/billing')
          let tok: string | null = null
          try {
            if (svc && typeof svc.listPurchases === 'function') {
              const purchases = await svc.listPurchases()
              const item = Array.isArray(purchases) ? purchases.find((p: any) => String(p?.sku || '') === String(playProductId)) : null
              tok = String((item && (item.purchaseToken || item.token)) || '')
            } else if (svc && typeof svc.getPurchases === 'function') {
              const purchases = await svc.getPurchases([playProductId])
              const item = Array.isArray(purchases) && purchases.length > 0 ? purchases[0] : null
              tok = String((item && (item.purchaseToken || item.token)) || '')
            }
          } catch {}
          if (tok) {
            const vr = await fetch('/api/billing/validate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ purchaseToken: tok, productId: playProductId, userId: user.id })
            })
            if (vr.ok) {
              premium = true
            }
          }
        }
      } catch {}
    }
    setIsPremium(premium)
    if (!premium) {
      setShowPremiumBanner(true)
      setTimeout(() => setShowPremiumBanner(false), 5000)
    } else {
      setShowPremiumBanner(false)
      try { await requestAndSaveToken() } catch {}
    }
    try {
      if (!debugAlertShown) {
        window.alert(`URL: ${supabaseUrl}\nUID: ${user?.id || ''}\nPlan: ${(premium ? 'PREMIUM' : 'GRÁTIS')}\nLoading: ${(planLoading ? 'SIM' : 'NÃO')}`)
        setDebugAlertShown(true)
      }
    } catch {}
    setPlanLoading(false)
  }, [])
  useEffect(() => { loadUserPlan() }, [loadUserPlan])
  useEffect(() => {
    const sub = supabase?.auth?.onAuthStateChange?.((_event: any, _session: any) => { loadUserPlan() })
    return () => { try { (sub as any)?.data?.subscription?.unsubscribe?.() } catch {} }
  }, [loadUserPlan])
  useEffect(() => {
    const onFocus = () => { loadUserPlan() }
    const onVis = () => { try { if (document.visibilityState === 'visible') loadUserPlan() } catch {} }
    try { window.addEventListener('focus', onFocus) } catch {}
    try { document.addEventListener('visibilitychange', onVis) } catch {}
    return () => {
      try { window.removeEventListener('focus', onFocus) } catch {}
      try { document.removeEventListener('visibilitychange', onVis) } catch {}
    }
  }, [loadUserPlan])
  useEffect(() => {
    function onClear() { setToasts([]) }
    window.addEventListener('clear-toasts', onClear as any)
    return () => { window.removeEventListener('clear-toasts', onClear as any) }
  }, [])
  useEffect(() => {
    let active = true
    async function load() {
      if (raioxOpen && raioxItem) {
        setRaioxExtra(null)
        const url = (function () {
          const orgaoEnt = getField(raioxItem, ['orgaoEntidade'], {})
          const cnpjDet = String(getField(orgaoEnt, ['cnpj'], '')).replace(/\D/g, '')
          let anoDet = getField(raioxItem, ['anoCompra'], '')
          let seqDet = getField(raioxItem, ['sequencialCompra'], '')
          if (!anoDet || !seqDet) {
            const idStr = String(getField(raioxItem, ['numeroControlePNCP','id'], ''))
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
          const fallback = String(getField(raioxItem, ['linkEdital','url','link'], 'https://pncp.gov.br/'))
          return cnpjDet && anoDet && seqDet
            ? `https://pncp.gov.br/app/editais/${cnpjDet}/${anoDet}/${seqDet}`
            : fallback
        })()
        try {
          const r = await fetch(`/api/pncp/raiox?url=${encodeURIComponent(url)}`, { cache: 'no-store' })
          const j = await r.json().catch(() => null)
          if (active && j) setRaioxExtra(j)
        } catch {}
      }
    }
    load()
    return () => { active = false }
  }, [raioxOpen, raioxItem])

  function addToast(message: string, type: 'success' | 'error' | 'info' = 'info') {
    const id = Math.random().toString(36).slice(2)
    setToasts((prev) => [...prev, { id, type, message }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3000)
  }
  function openModalidadeToast() {
    setModToastOpen(true)
    setModToastMin(false)
    setModToastManual(false)
    if (modTimers.current.min) { window.clearTimeout(modTimers.current.min) }
    if (modTimers.current.close) { window.clearTimeout(modTimers.current.close) }
    modTimers.current.min = window.setTimeout(() => setModToastMin(true), 5000)
    modTimers.current.close = window.setTimeout(() => setModToastOpen(false), 12000)
  }
  function closeModalidadeToast() {
    setModToastOpen(false)
    setModToastMin(false)
    setModToastManual(false)
    if (modTimers.current.min) { window.clearTimeout(modTimers.current.min) }
    if (modTimers.current.close) { window.clearTimeout(modTimers.current.close) }
  }
  function expandModalidadeToast() {
    setModToastMin(false)
    setModToastOpen(true)
    setModToastManual(true)
    if (modTimers.current.min) { window.clearTimeout(modTimers.current.min) }
    if (modTimers.current.close) { window.clearTimeout(modTimers.current.close) }
  }
  function formatDateTimeBR(iso?: string): string {
    if (!iso) return ''
    const d = new Date(String(iso))
    if (Number.isNaN(d.getTime())) return ''
    const date = d.toLocaleDateString('pt-BR')
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    return `${date} ${hh}:${mm}`
  }
  function formatYYYYMMDDToBR(s: string): string {
    const t = String(s || '').trim()
    if (!/^\d{8}$/.test(t)) return t
    const dd = t.slice(6, 8)
    const mm = t.slice(4, 6)
    const yyyy = t.slice(0, 4)
    return `${dd}/${mm}/${yyyy}`
  }
  function formatISODateToBR(iso?: string): string {
    const raw = String(iso || '')
    if (!raw) return ''
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return raw.slice(0, 10)
    return d.toLocaleDateString('pt-BR')
  }
  function limpar() {
    setTermo('')
    setUf(undefined)
    setModalidade('')
    setMunicipioIbge('')
    setCnpj('')
    setCodigoUA('')
    setSomenteHoje(false)
    setPagina(1)
  }

  const sortResultados = useCallback((arr: any[]): any[] => {
    const copy = [...arr]
    if (ordenar === 'data') {
      copy.sort((a, b) => {
        const da = new Date(String(getField(a, ['dataPublicacao','dataInclusao','data'], '')))
        const db = new Date(String(getField(b, ['dataPublicacao','dataInclusao','data'], '')))
        return (db.getTime() || 0) - (da.getTime() || 0)
      })
    } else if (ordenar === 'valor_desc' || ordenar === 'valor_asc') {
      copy.sort((a, b) => {
        const va = Number(getField(a, ['valorEstimado','valorTotalEstimado','valor','valorContratacao'], 0) || 0)
        const vb = Number(getField(b, ['valorEstimado','valorTotalEstimado','valor','valorContratacao'], 0) || 0)
        return ordenar === 'valor_desc' ? (vb - va) : (va - vb)
      })
    }
    return copy
  }, [ordenar])

  const carregarIniciais = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const page = await fetchContratacoesPage({
        dataInicial: inicio,
        dataFinal: hoje,
        pagina,
        tamanhoPagina,
      })
      const base = Array.isArray(page.items) ? page.items : (Array.isArray((page as any).data) ? (page as any).data : [])
      setResultados(sortResultados(base))
      setTotalPages(Number(page.totalPages || 1))
      setLoaded(true)
      addToast('Publicações de hoje carregadas', 'info')
    } catch (e: any) {
      setError('Falha ao carregar publicações de hoje')
      setResultados([])
    } finally {
      setLoading(false)
    }
  }, [inicio, hoje, pagina, tamanhoPagina, sortResultados])

  const didInitRef = useRef(false)
  useEffect(() => {
    if (didInitRef.current) return
    didInitRef.current = true
    carregarIniciais()
  }, [carregarIniciais])

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
      setResultados(sortResultados(list))
      setTotalPages(Number(page.totalPages || 1))
      addToast('Resultados atualizados', 'success')
    } catch (e: any) {
      addToast('Não foi possível executar a busca', 'error')
      setResultados([])
    } finally {
      setLoading(false)
    }
  }

  const resumo = useMemo(() => {
    const total = resultados.length
    const ufCount: Record<string, number> = {}
    for (const it of resultados) {
      const ufItem = getField(getField(it, ['unidadeOrgao'], {}), ['ufSigla'], '') || ''
      const k = String(ufItem || '').trim()
      if (!k) continue
      ufCount[k] = (ufCount[k] || 0) + 1
    }
    const topUFs = Object.entries(ufCount).sort((a, b) => b[1] - a[1]).slice(0, 3)
    return { total, topUFs }
  }, [resultados])

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
  function shareToWhatsApp(currentItem: any) {
    if (!currentItem) return
    const objetoCompra = sanitizeText(getField(currentItem, ['objetoCompra','objeto','objetoLicitacao','descricao','resumo','texto'], '') || '')
    const razaoSocial = asText(getField(getField(currentItem, ['orgaoEntidade'], {}), ['razaoSocial'], '')) || ''
    const valor = formatCurrencyBRL(getField(currentItem, ['valorTotalEstimado','valorEstimado','valor','valorContratacao'], 0))
    const data = String(getField(currentItem, ['dataEncerramentoProposta'], '')) || ''
    const linkPNCP = buildEditalUrl(currentItem)
    const msg = `📢 *Publicação - LicitMASA*%0A%0A📦 *Objeto:* ${objetoCompra}%0A🏛️ *Órgão:* ${razaoSocial}%0A💰 *Valor:* ${valor}%%0A⏳ *Prazo Final:* ${formatDateTimeBR(data)}%0A%0A🔗 *Ver detalhes no Portal:* ${linkPNCP}%0A%0A_Enviado via LicitMASA_`
    const url = `https://wa.me/?text=${msg}`
    if (typeof window !== 'undefined') {
      window.open(url, '_blank')
    }
  }

  useEffect(() => {}, [resultados])

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-0">
      <div className="fixed top-0 left-0 right-0 z-50 bg-yellow-400 text-black text-xs px-2 py-1">
        <div className="flex flex-wrap gap-3">
          <span>URL: {supabaseUrl || '-'}</span>
          <span>UID: {userId || '-'}</span>
          <span>Plan: {isPremium ? 'PREMIUM' : 'GRÁTIS'}</span>
          <span>Loading: {planLoading ? 'SIM' : 'NÃO'}</span>
        </div>
      </div>
      {modToastOpen && (
        <div className="fixed top-2 left-1/2 z-50 -translate-x-1/2 w-[95%] max-w-xl">
          {!modToastMin ? (
            <div className="pointer-events-auto rounded-md border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 shadow">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Info className="h-4 w-4 text-blue-700" />
                  <span className="font-medium">Modalidades de contratação</span>
                </div>
                <div className="flex items-center gap-2">
                  <Button onClick={() => setModToastMin(true)} className="bg-gray-100 text-gray-800 hover:bg-gray-200 px-2 py-1 text-xs">Minimizar</Button>
                  <Button onClick={closeModalidadeToast} className="bg-gray-100 text-gray-800 hover:bg-gray-200 px-2 py-1 text-xs">Fechar</Button>
                </div>
              </div>
              <div className="grid gap-2 max-h-60 overflow-y-auto">
                <div className="rounded-md border border-green-200 bg-green-50 p-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded bg-green-600 px-2 py-0.5 text-xs font-semibold text-white">Alta chance</span>
                    <span className="font-semibold">Dispensa</span>
                  </div>
                  <div className="mt-1 text-xs text-green-900">
                    Compras de menor valor e hipóteses legais específicas. Menor concorrência e prazos curtos.
                    Foque em:
                    • Monitorar diariamente novas dispensas no seu nicho
                    • Preparar documentação padrão para envio rápido
                    • Atender requisitos formais e prazos com precisão
                  </div>
                </div>
                <div className="rounded-md border border-blue-200 bg-blue-50 p-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center rounded bg-blue-700 px-2 py-0.5 text-xs font-semibold text-white">Boa chance</span>
                    <span className="font-semibold">Pregão</span>
                  </div>
                  <div className="mt-1 text-xs text-blue-900">
                    Disputa com lances para bens/serviços comuns. Grande volume de oportunidades.
                    Foque em:
                    • Estudo prévio do edital e objeto
                    • Estratégia de lances e limites
                    • Comprovação técnica mínima exigida
                  </div>
                </div>
                <div>
                  <div><strong>Inexigibilidade:</strong> inviabilidade de competição, fornecedor único ou notório. Oportunidade depende da especificidade e notório saber.</div>
                </div>
                <div>
                  <div><strong>Concurso:</strong> seleção por melhor trabalho técnico, artístico ou científico. Aplicável a projetos específicos.</div>
                </div>
                <div>
                  <div><strong>Leilão:</strong> venda de bens ao maior lance, geralmente inservíveis ou apreendidos. Foco em aquisição/venda, não prestação de serviço.</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="pointer-events-auto flex items-center justify-between rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900 shadow">
              <span>Modalidades — explicações minimizadas</span>
              <div className="flex items-center gap-2">
                <Button onClick={expandModalidadeToast} className="bg-gray-100 text-gray-800 hover:bg-gray-200 px-2 py-1 text-xs">Reabrir</Button>
                <Button onClick={closeModalidadeToast} className="bg-gray-100 text-gray-800 hover:bg-gray-200 px-2 py-1 text-xs">Fechar</Button>
              </div>
            </div>
          )}
        </div>
      )}
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

      
      {isPremium === false && showPremiumBanner && (
        <div className="mx-auto max-w-5xl px-6 pt-2">
          <div className="flex items-center justify-between rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
            <span>Plano Premium por R$ {planPrice}/mês: desbloqueie alertas às 07:00/16:00, WhatsApp e Raio‑X.</span>
            <div className="flex items-center gap-2">
              <Button
                onClick={async () => {
                  try {
                    addToast('Testando escrita...', 'info')
                    const { data: ud } = await supabase?.auth.getUser()!
                    const user = ud?.user
                    const uid = String(user?.id || '')
                    if (!uid) { addToast('Erro: Faça login', 'error'); return }
                    const r = await fetch('/api/debug/force-write', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
                      body: JSON.stringify({ userId: uid }),
                    })
                    if (!r.ok) {
                      try {
                        const j = await r.json().catch(() => ({}))
                        const m = String((j && (j.error || j.message)) || '').trim()
                        addToast(m ? `Erro: ${m}` : 'Erro: Falha na escrita', 'error')
                      } catch {
                        addToast('Erro: Falha na escrita', 'error')
                      }
                      return
                    }
                    addToast('Sucesso: Banco Atualizado', 'success')
                    try { await loadUserPlan() } catch {}
                  } catch (e: any) {
                    const m = String(e?.message || '').trim()
                    addToast(m ? `Erro: ${m}` : 'Erro: Falha na escrita', 'error')
                  }
                }}
                className="inline-flex items-center rounded-md bg-yellow-600 px-3 py-1 text-xs font-semibold text-white hover:bg-yellow-500"
              >
                TESTAR ESCRITA DB
              </Button>
              <Link href="/assinar" className="inline-flex items-center rounded-md bg-blue-800 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700">
                Quero Assinar
              </Link>
            </div>
          </div>
          <div className="mt-2">
            <button
              onClick={async () => {
                try {
                  const { data: ud } = await supabase?.auth.getUser()!
                  const user = ud?.user
                  const uid = String(user?.id || '')
                  const res = await fetch('/api/debug/force-write', {
                    method: 'POST',
                    body: JSON.stringify({ userId: uid }),
                  })
                  const data = await res.json().catch(() => ({}))
                  alert(JSON.stringify(data))
                } catch (e: any) {
                  alert(JSON.stringify({ ok: false, error: e?.message || 'UNKNOWN' }))
                }
              }}
              style={{ background: 'red', color: 'white', padding: '20px', width: '100%', fontWeight: 'bold', zIndex: 9999 } as any}
            >
              CLIQUE AQUI: TESTAR ESCRITA NO BANCO AGORA
            </button>
          </div>
        </div>
      )}
      <main className="mx-auto max-w-5xl px-6 py-8">
        <section className="rounded-xl border-2 border-slate-300 bg-white p-6 shadow-2xl">
          <div className="flex flex-col gap-3 md:grid md:grid-cols-[1fr,auto] md:items-center">
            <div className="flex items-center gap-2">
              <Search className="h-5 w-5 text-blue-700" />
              <Input
                placeholder="Palavra-chave (ex: limpeza, TI, alimentos)"
                value={termo}
                onChange={(e) => setTermo(e.target.value)}
              />
              <Select value={ordenar} onChange={(e) => setOrdenar(e.target.value as any)} className="w-40">
                <option value="data">Mais recentes</option>
                <option value="valor_desc">Maior valor</option>
                <option value="valor_asc">Menor valor</option>
              </Select>
              <Button
                onClick={() => { addToast('Atualizando...', 'info'); buscar() }}
                className="bg-gray-100 text-slate-700 hover:bg-gray-200 px-2 py-2"
                aria-label="Atualizar resultados"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={() => setFiltersOpen(true)} className="bg-gray-100 text-gray-800 hover:bg-gray-200 md:hidden">
                Filtros
              </Button>
              <Button onClick={buscar} disabled={loading} className="bg-blue-800 hover:bg-blue-700 text-white w-full">
                {loading ? <Search className="mr-2 h-4 w-4 animate-spin" /> : null}
                {loading ? 'Buscando...' : 'Filtrar'}
              </Button>
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Dica: Se não preencher palavra-chave nem filtro, listaremos todas as publicações abaixo.
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
          <div className="mt-2">
            <Button onClick={limpar} className="bg-transparent text-slate-700 hover:underline px-0 py-0 text-xs">
              Limpar
            </Button>
          </div>
          <div className="mt-3 text-xs text-gray-500">Exibindo publicações de {formatYYYYMMDDToBR(inicio)} a {formatYYYYMMDDToBR(hoje)}</div>
          <div className="mt-3 flex items-center justify-between rounded-md border-2 border-slate-300 bg-white px-3 py-2 shadow-md">
            <div className="text-sm text-slate-700">
              {`Encontramos ${resumo.total} publicações`}
              {resumo.topUFs.length > 0 ? ` • Principais UFs: ${resumo.topUFs.map(([u, c]) => `${u} (${c})`).join(', ')}` : ''}
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-600">Itens por página</span>
                <Select
                  value={String(tamanhoPagina)}
                  onChange={(e) => setTamanhoPagina(Number(e.target.value))}
                >
                  <option value="10">10</option>
                  <option value="20">20</option>
                  <option value="50">50</option>
                </Select>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={() => { mudarPagina(pagina - 1) }}
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-2 py-1"
                  disabled={pagina <= 1}
                  aria-label="Página anterior"
                >
                  {'<'}
                </Button>
                <span className="text-xs text-slate-700">{pagina} / {totalPages}</span>
                <Button
                  onClick={() => { mudarPagina(pagina + 1) }}
                  className="bg-gray-100 text-gray-700 hover:bg-gray-200 px-2 py-1"
                  disabled={pagina >= totalPages}
                  aria-label="Próxima página"
                >
                  {'>'}
                </Button>
              </div>
            </div>
          </div>
        </section>

        <div className={"fixed inset-0 z-50 md:hidden " + (filtersOpen ? '' : 'pointer-events-none')}>
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
                <Button onClick={openModalidadeToast} className="inline-flex items-center gap-2 bg-gray-100 text-gray-800 hover:bg-gray-200 text-xs">
                  <Info className="h-4 w-4" />
                  Entenda modalidades
                </Button>
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
          className="relative mt-8"
        >
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
                className="md:hidden relative overflow-hidden rounded-xl border-0 bg-transparent shadow-none"
                style={{ height: `calc(100vh - 120px - env(safe-area-inset-bottom))` }}
              >
                {resultados.length > 1 ? (
                  <div className="pointer-events-none absolute top-2 right-2 z-10 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white/80 px-2 py-1 text-[10px] text-slate-700">
                    <ChevronLeft className="h-3 w-3 text-blue-700" />
                    Deslize para ver mais
                    <ChevronRight className="h-3 w-3 text-blue-700" />
                  </div>
                ) : null}
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
                      const orgaoShort = orgao.length > 100 ? (orgao.slice(0, 100) + '...') : orgao
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
                          <div className="rounded-xl border-2 border-slate-300 bg-white shadow-2xl flex h-full flex-col justify-between pb-20 p-4">
                            <div className="space-y-3">
                              <div className="flex items-center gap-2">
                                <Badge className={"px-2 " + (Number(modalidadeCode) === 22 ? "bg-blue-100 text-blue-800" : Number(modalidadeCode) === 8 ? "bg-green-100 text-green-800" : Number(modalidadeCode) === 21 ? "bg-yellow-100 text-yellow-800" : "bg-slate-100 text-slate-800")}>{modalidade}</Badge>
                                <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-sm font-semibold text-slate-900">
                                  {orgaoShort}
                                </div>
                              </div>
                              <div className="rounded-lg border border-slate-200 bg-blue-50 p-3 text-xs text-gray-800 lowercase line-clamp-3">
                                {String(objetoDisplay || 'Descrição não disponível').toLowerCase()}
                              </div>
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                                <div className="flex items-center gap-2 rounded-md border px-2 py-2 text-blue-800 font-semibold">
                                  <Banknote className="h-4 w-4 text-blue-700" />
                                  {formatCurrencyBRL(getField(item, ['valorEstimado','valorTotalEstimado','valor','valorContratacao'], 0))}
                                </div>
                                <div className="flex items-center gap-2 rounded-md border px-2 py-2 text-gray-700">
                                  <Calendar className="h-4 w-4 text-blue-700" />
                                  {formatISODateToBR(String(getField(item, ['dataPublicacao','dataInclusao','data'], '')))}
                                </div>
                                <div className="flex items-center gap-1 rounded-md border px-2 py-2 text-gray-700">
                                  <MapPin className="h-3 w-3 text-blue-700" />
                                  {String(ufItem || '-')}
                                </div>
                                <div className="flex items-center gap-1 rounded-md border px-2 py-2 text-gray-700">
                                  {municipio ? municipio : '-'}
                                </div>
                              </div>
                              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-700">
                                <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">{cnpj ? `CNPJ ${cnpj}` : '-'}</span>
                                <span className="inline-flex items-center gap-1 rounded-md border px-2 py-1">{uaCodigo ? `UA ${String(uaCodigo)}` : '-'}</span>
                              </div>
                            </div>
                            <div className="mt-4 flex flex-col gap-2">
                              <a
                                href={edital}
                                target="_blank"
                                rel="noreferrer"
                                onClick={async (e) => {
                                  e.preventDefault()
                                  if (planLoading || isPremium === null || checkingPremiumAction) return
                                  setCheckingPremiumAction(true)
                                  try {
                                    const ud = await supabase?.auth.getUser()
                                    const user = ud?.data?.user || (ud as any)?.user
                                    let premiumNow = isPremium
                                    if (user?.id && !premiumNow) {
                                      try {
                                        const r = await fetch('/api/profile/status', {
                                          method: 'POST',
                                          headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
                                          body: JSON.stringify({ userId: user.id })
                                        })
                                        if (r.ok) {
                                          const j = await r.json()
                                          premiumNow = Boolean(j?.isPremium)
                                          setIsPremium(premiumNow)
                                        }
                                      } catch {}
                                    }
                                    if (premiumNow) {
                                      try { window.open(edital, '_blank') } catch {}
                                    } else {
                                      setUpgradeOpen(true)
                                    }
                                  } finally {
                                    setCheckingPremiumAction(false)
                                  }
                                }}
                                className={"h-9 w-[70%] inline-flex items-center justify-center gap-2 rounded-md px-3 text-xs font-semibold text-white shadow " + ((planLoading || isPremium === null || checkingPremiumAction) ? "bg-blue-400 cursor-wait opacity-50 pointer-events-none" : "bg-blue-700 hover:bg-blue-600")}
                              >
                                <FileText className="h-4 w-4" />
                                {planLoading || isPremium === null || checkingPremiumAction ? 'Carregando...' : 'Ver Edital'}
                              </a>
                              <div className="flex items-center gap-2">
                                <Button
                                  onClick={async () => {
                                    if (planLoading || isPremium === null || checkingPremiumAction) return
                                    setCheckingPremiumAction(true)
                                    try {
                                      const ud = await supabase?.auth.getUser()
                                      const user = ud?.data?.user || (ud as any)?.user
                                      let premiumNow = isPremium
                                      if (user?.id && !premiumNow) {
                                        try {
                                          const r = await fetch('/api/profile/status', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
                                            body: JSON.stringify({ userId: user.id })
                                          })
                                          if (r.ok) {
                                            const j = await r.json()
                                            premiumNow = Boolean(j?.isPremium)
                                            setIsPremium(premiumNow)
                                          }
                                        } catch {}
                                      }
                                      if (premiumNow) {
                                        setRaioxItem(item); setRaioxOpen(true)
                                      } else {
                                        setUpgradeOpen(true)
                                      }
                                    } finally {
                                      setCheckingPremiumAction(false)
                                    }
                                  }}
                                  className={"h-9 inline-flex items-center justify-center rounded-md border px-2 text-xs " + ((planLoading || isPremium === null || checkingPremiumAction) ? "bg-gray-50 text-slate-500 cursor-wait opacity-50 pointer-events-none" : "bg-white text-slate-800 hover:bg-gray-100")}
                                  aria-label="Raio-X da Oportunidade"
                                  title="Raio-X da Oportunidade"
                                >
                                  <SearchCheck className="h-4 w-4 text-blue-700" />
                                </Button>
                                <Button
                                  onClick={() => { setDetailsItem(item); setDetailsOpen(true) }}
                                  className="h-9 inline-flex items-center justify-center rounded-md border bg-white px-2 text-xs text-slate-800 hover:bg-gray-100"
                                  aria-label="Detalhes"
                                  title="Detalhes"
                                >
                                  <Info className="h-4 w-4 text-blue-700" />
                                </Button>
                                
                                <Button
                                  onClick={async () => {
                                    if (planLoading || isPremium === null || checkingPremiumAction) return
                                    setCheckingPremiumAction(true)
                                    try {
                                      const ud = await supabase?.auth.getUser()
                                      const user = ud?.data?.user || (ud as any)?.user
                                      let premiumNow = isPremium
                                      if (user?.id && !premiumNow) {
                                        try {
                                          const r = await fetch('/api/profile/status', {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
                                            body: JSON.stringify({ userId: user.id })
                                          })
                                          if (r.ok) {
                                            const j = await r.json()
                                            premiumNow = Boolean(j?.isPremium)
                                            setIsPremium(premiumNow)
                                          }
                                        } catch {}
                                      }
                                      if (premiumNow) {
                                        shareToWhatsApp(item)
                                      } else {
                                        setUpgradeOpen(true)
                                      }
                                    } finally {
                                      setCheckingPremiumAction(false)
                                    }
                                  }}
                                  className={"h-9 inline-flex items-center justify-center rounded-md border px-2 text-xs " + ((planLoading || isPremium === null || checkingPremiumAction) ? "bg-green-50 text-green-600 cursor-wait opacity-50 pointer-events-none" : "bg-white text-green-700 hover:bg-green-50")}
                                  aria-label="Enviar para WhatsApp"
                                >
                                  <MessageCircle className="h-4 w-4 text-green-700" />
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
              <div className="hidden md:block rounded-xl border-2 border-slate-300 bg-white divide-y shadow-2xl">
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
                      <div className="mt-2 rounded-md border border-slate-200 bg-blue-50 px-3 py-2 text-sm text-gray-800">
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
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 w-full">
                        <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-gray-700">
                          <Banknote className="h-4 w-4 text-blue-700" />
                          {formatCurrencyBRL(valor)}
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-gray-700">
                          <Calendar className="h-4 w-4 text-blue-700" />
                          {formatISODateToBR(String(dataPub || ''))}
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-gray-700">
                          <MapPin className="h-4 w-4 text-blue-700" />
                          {String(ufItem || '-')}
                        </div>
                        <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-gray-700">
                          {municipio ? municipio : '-'}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <a
                          href={edital}
                          target="_blank"
                          rel="noreferrer"
                          onClick={async (e) => {
                            e.preventDefault()
                            if (planLoading || isPremium === null || checkingPremiumAction) return
                            setCheckingPremiumAction(true)
                            try {
                              const ud = await supabase?.auth.getUser()
                              const user = ud?.data?.user || (ud as any)?.user
                              let premiumNow = isPremium
                              if (user?.id && !premiumNow) {
                                try {
                                  const r = await fetch('/api/profile/status', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
                                    body: JSON.stringify({ userId: user.id })
                                  })
                                  if (r.ok) {
                                    const j = await r.json()
                                    premiumNow = Boolean(j?.isPremium)
                                    setIsPremium(premiumNow)
                                  }
                                } catch {}
                              }
                              if (premiumNow) {
                                try { window.open(edital, '_blank') } catch {}
                              } else {
                                setUpgradeOpen(true)
                              }
                            } finally {
                              setCheckingPremiumAction(false)
                            }
                          }}
                          className={"inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-white w-[70%] " + ((planLoading || isPremium === null || checkingPremiumAction) ? "bg-blue-500 cursor-wait opacity-50 pointer-events-none" : "bg-blue-700 hover:bg-blue-600")}
                        >
                          <FileText className="h-4 w-4 text-blue-700" />
                          {planLoading || isPremium === null || checkingPremiumAction ? 'Carregando...' : 'Ver Edital'}
                        </a>
                        <Button
                          onClick={async () => {
                            if (planLoading || isPremium === null || checkingPremiumAction) return
                            setCheckingPremiumAction(true)
                            try {
                              const ud = await supabase?.auth.getUser()
                              const user = ud?.data?.user || (ud as any)?.user
                              let premiumNow = isPremium
                              if (user?.id && !premiumNow) {
                                try {
                                  const r = await fetch('/api/profile/status', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
                                    body: JSON.stringify({ userId: user.id })
                                  })
                                  if (r.ok) {
                                    const j = await r.json()
                                    premiumNow = Boolean(j?.isPremium)
                                    setIsPremium(premiumNow)
                                  }
                                } catch {}
                              }
                              if (premiumNow) {
                                setRaioxItem(item); setRaioxOpen(true)
                              } else {
                                setUpgradeOpen(true)
                              }
                            } finally {
                              setCheckingPremiumAction(false)
                            }
                          }}
                          className="inline-flex items-center justify-center rounded-md border bg-white px-2 text-xs text-slate-800 hover:bg-gray-100"
                          aria-label="Raio-X da Oportunidade"
                          title="Raio-X da Oportunidade"
                        >
                          <SearchCheck className="h-4 w-4 text-blue-700" />
                        </Button>
                        <Button
                          onClick={() => { setDetailsItem(item); setDetailsOpen(true) }}
                          className="inline-flex items-center justify-center rounded-md border bg-white px-2 text-xs text-slate-800 hover:bg-gray-100"
                          aria-label="Detalhes"
                          title="Detalhes"
                        >
                          <Info className="h-4 w-4 text-blue-700" />
                        </Button>
                        
                        <Button
                          onClick={async () => {
                            if (planLoading || checkingPremiumAction) return
                            setCheckingPremiumAction(true)
                            try {
                              const ud = await supabase?.auth.getUser()
                              const user = ud?.data?.user || (ud as any)?.user
                              let premiumNow = isPremium
                              if (user?.id && !premiumNow) {
                                try {
                                  const r = await fetch('/api/profile/status', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
                                    body: JSON.stringify({ userId: user.id })
                                  })
                                  if (r.ok) {
                                    const j = await r.json()
                                    premiumNow = Boolean(j?.isPremium)
                                    setIsPremium(premiumNow)
                                  }
                                } catch {}
                              }
                              if (premiumNow) {
                                shareToWhatsApp(item)
                              } else {
                                setUpgradeOpen(true)
                              }
                            } finally {
                              setCheckingPremiumAction(false)
                            }
                          }}
                          className={"inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium " + (planLoading || checkingPremiumAction ? "border-green-600 bg-green-50 text-green-700 cursor-wait" : "border-green-600 bg-white text-green-700 hover:bg-green-50")}
                        >
                          <MessageCircle className="h-4 w-4 text-green-600" />
                          {planLoading || checkingPremiumAction ? 'Verificando...' : 'Enviar para WhatsApp'}
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
              <div className="text-sm text-gray-800 space-y-3">
                {(() => {
                  const editUrl = buildEditalUrl(raioxItem)
                  const exclusivo = Boolean(getField(raioxItem, ['exclusivoMeEpp'], false))
                  const criterio = asText(getField(raioxItem, ['tipoInstrumentoConvocatorioNome','criterioJulgamentoNome'], '')) || ''
                  const modoDisp = asText(getField(raioxItem, ['modoDisputaNome'], '')) || asText(raioxExtra?.modoDisputa) || ''
                  const valorEst = Number(getField(raioxItem, ['valorTotalEstimado','valorEstimado','valor','valorContratacao'], 0)) || 0
                  const amparoObj = getField(raioxItem, ['amparoLegal'], null) as any
                  const amparo = asText(getField(amparoObj || {}, ['nome','descricao'], '')) || ''
                  const status = asText(getField(raioxItem, ['situacaoCompraNome'], '')) || ''
                  const dataEnc = asText(getField(raioxItem, ['dataEncerramentoProposta'], '')) || asText(raioxExtra?.dataEncerramento) || ''
                  const dEnc = dataEnc ? new Date(String(dataEnc)) : null
                  const encerrada = dEnc ? (dEnc.getTime() - Date.now() <= 0) : false
                  function countdownLabel(iso?: string): string {
                    if (!iso) return ''
                    const d = new Date(String(iso))
                    if (Number.isNaN(d.getTime())) return ''
                    const ms = d.getTime() - Date.now()
                    if (ms <= 0) return 'Encerrada'
                    const dd = Math.floor(ms / (24 * 60 * 60 * 1000))
                    const hh = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
                    return `Faltam ${dd} dias, ${hh} horas`
                  }
                  return (
                    <>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <div className="rounded-md border bg-indigo-50 p-4">
                          <div className="text-xs text-gray-600">Valor Estimado</div>
                          <div className="mt-1 text-xl font-bold text-indigo-900">
                            {valorEst ? formatCurrencyBRL(valorEst) : (
                              <a href={editUrl} target="_blank" rel="noreferrer" className="underline">Consultar no Edital</a>
                            )}
                          </div>
                        </div>
                        <div className={"rounded-md border p-4 " + (encerrada ? "bg-red-50" : "bg-green-50")}>
                          <div className="text-xs text-gray-600">Contagem Regressiva</div>
                          <div className={"mt-1 text-lg font-semibold " + (encerrada ? "text-red-800" : "text-green-800")}>
                            {dataEnc ? countdownLabel(dataEnc) : (
                              <a href={editUrl} target="_blank" rel="noreferrer" className="underline text-blue-700">Consultar no Edital</a>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            {dataEnc ? `Encerramento: ${formatDateTimeBR(dataEnc)}` : ''}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <Button
                          onClick={() => { if (!isPremium) { setUpgradeOpen(true); return } shareToWhatsApp(raioxItem) }}
                          className="w-full md:w-auto border border-green-600 bg-white text-green-700 hover:bg-green-50 inline-flex items-center gap-2"
                        >
                          <MessageCircle className="h-4 w-4 text-green-600" />
                          Enviar para WhatsApp
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="rounded-md border p-3">
                          <div className="text-xs text-gray-500">Quem pode participar</div>
                          <div className="mt-1">
                            {exclusivo ? (
                              <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800">Sim (Exclusivo)</span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-1 text-xs font-medium text-gray-800">Não (Ampla Concorrência)</span>
                            )}
                          </div>
                        </div>
                        <div className="rounded-md border p-3">
                          <div className="text-xs text-gray-500">Status da Compra</div>
                          <div className="mt-1">
                            {status ? (
                              <span className={"inline-flex items-center rounded-full px-2 py-1 text-xs font-medium " + (encerrada ? "bg-red-100 text-red-800" : "bg-blue-100 text-blue-800")}>{status}</span>
                            ) : (
                              <a href={editUrl} target="_blank" rel="noreferrer" className="underline text-blue-700">Consultar no Edital</a>
                            )}
                          </div>
                        </div>
                        <div className="rounded-md border p-3">
                          <div className="text-xs text-gray-500">Critério de Julgamento</div>
                          <div className="mt-1 font-medium">
                            {criterio || (
                              <a href={editUrl} target="_blank" rel="noreferrer" className="underline text-blue-700">Consultar no Edital</a>
                            )}
                          </div>
                        </div>
                        <div className="rounded-md border p-3">
                          <div className="text-xs text-gray-500">Modo de Disputa</div>
                          <div className="mt-1 font-medium">
                            {modoDisp || (
                              <a href={editUrl} target="_blank" rel="noreferrer" className="underline text-blue-700">Consultar no Edital</a>
                            )}
                          </div>
                        </div>
                        <div className="rounded-md border p-3">
                          <div className="text-xs text-gray-500">Abertura</div>
                          <div className="mt-1 font-medium">
                            {formatDateTimeBR(raioxExtra?.dataAbertura) || (
                              <a href={editUrl} target="_blank" rel="noreferrer" className="underline text-blue-700">Consultar no Edital</a>
                            )}
                          </div>
                        </div>
                        <div className="rounded-md border p-3">
                          <div className="text-xs text-gray-500">Amparo Legal</div>
                          <div className="mt-1 font-medium">
                            {amparo || (
                              <a href={editUrl} target="_blank" rel="noreferrer" className="underline text-blue-700">Consultar no Edital</a>
                            )}
                          </div>
                        </div>
                        <div className="rounded-md border p-3">
                          <div className="text-xs text-gray-500">Plataforma</div>
                          <div className="mt-1 font-medium">
                            {raioxExtra?.plataforma || (
                              <a href={editUrl} target="_blank" rel="noreferrer" className="underline text-blue-700">Consultar no Edital</a>
                            )}
                          </div>
                        </div>
                      </div>
                    </>
                  )
                })()}
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
                      {formatISODateToBR(String(getField(detailsItem, ['dataPublicacao','dataInclusao','data'], '') || ''))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">UF</div>
                      <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-gray-700">
                        {String(getField(getField(detailsItem, ['unidadeOrgao'], {}), ['ufSigla'], uf || '-'))}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Município</div>
                      <div className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-gray-700">
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
                      onClick={async (e) => {
                        e.preventDefault()
                        if (planLoading || isPremium === null || checkingPremiumAction) return
                        setCheckingPremiumAction(true)
                        try {
                          const ud = await supabase?.auth.getUser()
                          const user = ud?.data?.user || (ud as any)?.user
                          let premiumNow = isPremium
                          if (user?.id && !premiumNow) {
                            try {
                              const r = await fetch('/api/profile/status', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
                                body: JSON.stringify({ userId: user.id })
                              })
                              if (r.ok) {
                                const j = await r.json()
                                premiumNow = Boolean(j?.isPremium)
                                setIsPremium(premiumNow)
                              }
                            } catch {}
                          }
                          if (premiumNow) {
                            try { window.open((function () {
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
                            })(), '_blank') } catch {}
                          } else {
                            setUpgradeOpen(true)
                          }
                        } finally {
                          setCheckingPremiumAction(false)
                        }
                      }}
                      className={"inline-flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-white " + ((planLoading || isPremium === null || checkingPremiumAction) ? "bg-blue-500 cursor-wait opacity-50 pointer-events-none" : "bg-blue-800 hover:bg-blue-700")}
                    >
                      {planLoading || isPremium === null || checkingPremiumAction ? 'Carregando...' : 'Ver Edital'}
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
            <div className="mb-2 text-lg font-semibold text-blue-900">Plano Premium</div>
            <p className="text-sm text-gray-700">
              Esta função está disponível no Plano Premium.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <Button onClick={() => { setUpgradeOpen(false); router.push('/assinar') }} className="bg-blue-800 text-white hover:bg-blue-700">Quero Assinar</Button>
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
