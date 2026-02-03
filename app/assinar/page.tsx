'use client'
import { Bell, FileText, MessageCircle, SearchCheck, Bookmark, ShieldCheck, Star } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase, buildAuthRedirect } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AssinarPage() {
  const payUrl = process.env.NEXT_PUBLIC_PAYMENT_URL || '/perfil'
  const price = process.env.NEXT_PUBLIC_PLAN_PRICE || '49,90'
  const playProductId = process.env.NEXT_PUBLIC_PLAY_PRODUCT_ID || ''
  const [ctaHref, setCtaHref] = useState<string>('/login')
  const router = useRouter()
  const [isPremium, setIsPremium] = useState(false)
  const twaAndroid = (() => {
    try {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
      const isAndroid = /android/.test(ua)
      const isStandalone = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(display-mode: standalone)').matches : false
      return Boolean(isAndroid && isStandalone)
    } catch { return false }
  })()
  const [playBillingAvailable, setPlayBillingAvailable] = useState(false)
  const [skuValid, setSkuValid] = useState(false)
  const [skuPrice, setSkuPrice] = useState<string | null>(null)
  const [purchaseLoading, setPurchaseLoading] = useState(false)
  const [purchaseMsg, setPurchaseMsg] = useState<string | null>(null)
  const [restoreLoading, setRestoreLoading] = useState(false)
  const [restoreMsg, setRestoreMsg] = useState<string | null>(null)
  async function assinanteDeTeste() {
    try {
      setPurchaseMsg(null)
      if (!supabase) { setPurchaseMsg('Configure o Supabase'); return }
      const redirectTo = buildAuthRedirect('/perfil')
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true }
      })
      if (error) { setPurchaseMsg('Falha ao iniciar login de teste'); return }
      const url = String(data?.url || '')
      if (url && typeof window !== 'undefined') {
        try {
          const target = new URL(url)
          target.searchParams.set('redirect_to', redirectTo)
          window.location.href = target.toString()
        } catch {
          window.location.href = url
        }
        return
      }
      setPurchaseMsg('Redirecionamento indisponível')
    } catch (e: any) {
      setPurchaseMsg(e?.message || 'Falha no login de teste')
    }
  }
  async function restoreViaPlay() {
    try {
      setRestoreMsg(null)
      setRestoreLoading(true)
      const ud = await supabase?.auth.getUser()
      const user = ud?.data?.user
      const uid = String(user?.id || '')
      if (!uid) { setRestoreMsg('Faça login para restaurar'); try { router.push('/login') } catch {}; return }
      const w: any = typeof window !== 'undefined' ? window : null
      if (!w || !('getDigitalGoodsService' in w)) { setRestoreMsg('Digital Goods indisponível'); return }
      const svc = await w.getDigitalGoodsService('https://play.google.com/billing')
      if (!svc) { setRestoreMsg('Serviço de cobrança indisponível'); return }
      let tok: string | null = null
      try {
        if (typeof svc.listPurchases === 'function') {
          const purchases = await svc.listPurchases()
          const item = Array.isArray(purchases) ? purchases.find((p: any) => String(p?.sku || '') === String(playProductId)) : null
          tok = String((item && (item.purchaseToken || item.token)) || '')
        } else if (typeof svc.getPurchases === 'function') {
          const purchases = await svc.getPurchases([playProductId])
          const item = Array.isArray(purchases) && purchases.length > 0 ? purchases[0] : null
          tok = String((item && (item.purchaseToken || item.token)) || '')
        }
      } catch {}
      if (!tok && (w as any).PaymentRequest) {
        try {
          const pr = new (w as any).PaymentRequest([{ supportedMethods: 'https://play.google.com/billing', data: { sku: playProductId, type: 'subs' } }], {})
          const resp = await pr.show()
          await resp.complete('success')
          const details: any = (resp as any)?.details || {}
          tok = String(details?.purchaseToken || details?.token || details?.purchase_token || '')
        } catch {}
      }
      if (!tok) { setRestoreMsg('Nenhuma assinatura ativa encontrada'); return }
      const vr = await fetch('/api/billing/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseToken: tok, productId: playProductId, userId: uid })
      })
      if (!vr.ok) {
        try {
          const data = await vr.json().catch(() => ({}))
          const m = String((data && (data.error || data.message)) || '').trim()
          setRestoreMsg(m ? `Falha na validação: ${m}` : 'Falha na validação')
        } catch {
          setRestoreMsg('Falha na validação')
        }
      } else {
        setRestoreMsg('Premium restaurado')
        try { router.push(payUrl) } catch {}
      }
    } finally {
      setRestoreLoading(false)
    }
  }
  useEffect(() => {
    async function resolve() {
      const ud = await supabase?.auth.getUser()
      const user = ud?.data?.user
      setCtaHref(user?.id ? payUrl : '/login')
    }
    resolve()
  }, [payUrl])
  useEffect(() => {
    async function checkPremium() {
      try {
        const ud = await supabase?.auth.getUser()
        const user = ud?.data?.user
        const uid = String(user?.id || '')
        if (!uid) { setIsPremium(false); return }
        const { data: prof } = await supabase!.from('profiles').select('is_premium, plan').eq('id', uid).single()
        let premium = Boolean(prof?.is_premium) || String(prof?.plan || '').toLowerCase() === 'premium'
        if (!premium) {
          try {
            const r = await fetch('/api/profile/status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
              body: JSON.stringify({ userId: uid })
            })
            if (r.ok) {
              const j = await r.json()
              premium = Boolean(j?.isPremium)
            }
          } catch {}
        }
        setIsPremium(premium)
      } catch { setIsPremium(false) }
    }
    checkPremium()
  }, [])
  useEffect(() => {
    async function probe() {
      try {
        setPlayBillingAvailable(false)
        setSkuValid(false)
        setSkuPrice(null)
        if (!twaAndroid) return
        if (!playProductId) return
        const w: any = typeof window !== 'undefined' ? window : null
        if (!w) return
        if (!('getDigitalGoodsService' in w)) return
        const svc = await w.getDigitalGoodsService('https://play.google.com/billing')
        if (!svc) return
        if (!(w as any).PaymentRequest) return
        try {
          const details = await svc.getDetails([playProductId])
          if (Array.isArray(details) && details.length > 0) {
            const item = details[0]
            const price = (() => {
              try {
                const p = item?.price
                if (p?.currency && p?.value != null) {
                  return new Intl.NumberFormat(
                    typeof navigator !== 'undefined' ? navigator.language : 'pt-BR',
                    { style: 'currency', currency: p.currency }
                  ).format(p.value)
                }
              } catch {}
              return null
            })()
            setSkuPrice(price)
            setSkuValid(true)
          } else {
            setSkuValid(true)
          }
        } catch {
          setSkuValid(true)
        }
        setPlayBillingAvailable(true)
      } catch {
        setPlayBillingAvailable(false)
      }
    }
    probe()
  }, [twaAndroid, playProductId])
  async function purchaseViaPlay() {
    try {
      setPurchaseMsg(null)
      setPurchaseLoading(true)
      if (!playBillingAvailable) { setPurchaseMsg('Pagamento via Google Play indisponível'); return }
      if (!skuValid) { setPurchaseMsg('Assinatura não encontrada ou inativa'); return }
      {
        const ud = await supabase?.auth.getUser()
        const user = ud?.data?.user
        const uid = String(user?.id || '')
        if (!uid) {
          try {
            const redirectTo = buildAuthRedirect('/perfil?continue=/assinar')
            const { data, error } = await supabase!.auth.signInWithOAuth({
              provider: 'google',
              options: { redirectTo, skipBrowserRedirect: true }
            })
            if (error) { setPurchaseMsg('Falha ao iniciar login com Google'); return }
            const url = String(data?.url || '')
            if (url && typeof window !== 'undefined') {
              setPurchaseMsg('Entrando com Google para prosseguir com a compra...')
              try {
                const target = new URL(url)
                target.searchParams.set('redirect_to', redirectTo)
                window.location.href = target.toString()
              } catch {
                window.location.href = url
              }
              return
            }
            setPurchaseMsg('Redirecionamento indisponível para login')
            return
          } catch (e: any) {
            const m = String(e?.message || '').trim()
            setPurchaseMsg(m || 'Falha ao iniciar login com Google')
            return
          }
        }
        // Verifica se já é premium e evita loop de compra
        try {
          const { data: prof } = await supabase!.from('profiles').select('is_premium, plan').eq('id', uid).single()
          let premium = Boolean(prof?.is_premium) || String(prof?.plan || '').toLowerCase() === 'premium'
          if (!premium) {
            try {
              const r = await fetch('/api/profile/status', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
                body: JSON.stringify({ userId: uid })
              })
              if (r.ok) {
                const j = await r.json()
                premium = Boolean(j?.isPremium)
              }
            } catch {}
          }
          if (premium) {
            setPurchaseMsg('Você já é assinante Premium')
            try { router.push(payUrl) } catch {}
            return
          }
        } catch {}
        // Checagem adicional via Digital Goods API para evitar abrir PaymentRequest em assinatura já ativa
        try {
          const w: any = typeof window !== 'undefined' ? window : null
          if (w && 'getDigitalGoodsService' in w) {
            const svc = await w.getDigitalGoodsService('https://play.google.com/billing')
            if (svc && typeof svc.listPurchases === 'function') {
              const purchases = await svc.listPurchases()
              const hasActive = Array.isArray(purchases) && purchases.some((p: any) => String(p?.sku || '') === String(playProductId))
              if (hasActive) {
                setPurchaseMsg('Você já tem uma assinatura via Google Play')
                try { router.push(payUrl) } catch {}
                return
              }
            }
          }
        } catch {}
      }
      const methodData = [{
        supportedMethods: 'https://play.google.com/billing',
        data: { sku: playProductId, type: 'subs' }
      }] as any
      let resp: any
      try {
        const pr = new (window as any).PaymentRequest(methodData, {})
        resp = await pr.show()
      } catch (e: any) {
        const m = String(e?.message || '').toLowerCase()
        if (m.includes('already') || m.includes('assinatura') || m.includes('already have')) {
          setPurchaseMsg('Assinatura já existente no Google Play')
          try { router.push(payUrl) } catch {}
          return
        }
        throw e
      }
      await resp.complete('success')
      const details: any = (resp as any)?.details || {}
      const tok = String(
        details?.purchaseToken
        || details?.token
        || details?.purchase_token
        || details?.['purchaseToken']
        || details?.['token']
        || ''
      )
      const ud = await supabase?.auth.getUser()
      const user = ud?.data?.user
      const uid = String(user?.id || '')
      if (!tok || !uid) { setPurchaseMsg('Falha ao capturar token de compra'); return }
      const vr = await fetch('/api/billing/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseToken: tok, productId: playProductId, userId: uid })
      })
      if (!vr.ok) {
        try {
          const data = await vr.json().catch(() => ({}))
          const m = String((data && (data.error || data.message)) || '').trim()
          setPurchaseMsg(m ? `Falha na validação: ${m}` : 'Falha na validação')
        } catch {
          setPurchaseMsg('Falha na validação')
        }
      } else {
        setPurchaseMsg('Premium liberado')
      }
      if (vr.ok) {
        try { router.push(payUrl) } catch {}
      }
    } catch (e: any) {
      const msg = String(e?.message || '').trim()
      setPurchaseMsg(msg ? msg : 'Falha na compra')
    } finally {
      setPurchaseLoading(false)
    }
  }
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold text-blue-900">Plano Premium</h1>
          <Link href="/" className="text-sm text-blue-700 hover:underline">Voltar</Link>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        <div className="grid gap-6 md:grid-cols-[1fr,380px]">
          <Card className="shadow-sm border-blue-100">
            <CardHeader>
              <CardTitle className="text-2xl text-blue-900">Desbloqueie o Poder Total do LicitMASA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border border-yellow-100 bg-yellow-50 p-4">
                <div className="flex items-center gap-2 text-yellow-700">
                  <Star className="h-5 w-5 text-yellow-600" />
                  Benefícios Premium
                </div>
                <div className="mt-3 grid gap-3">
                  <div className="flex items-center gap-2 text-sm text-slate-800">
                    <Bell className="h-4 w-4 text-yellow-600" />
                    Alertas em Tempo Real: notificações nativas às 07:00 e 16:00 com as melhores oportunidades.
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-800">
                    <FileText className="h-4 w-4 text-yellow-600" />
                    Acesso aos Editais: download e visualização de editais completos.
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-800">
                    <MessageCircle className="h-4 w-4 text-yellow-600" />
                    Compartilhamento Profissional: envie publicações formatadas via WhatsApp.
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-800">
                    <SearchCheck className="h-4 w-4 text-yellow-600" />
                    Raio-X da Oportunidade: análise profunda e inteligente de cada publicação.
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-800">
                    <Bookmark className="h-4 w-4 text-yellow-600" />
                    Favoritos Ilimitados: salve e organize todas as oportunidades sem restrições.
                  </div>
                </div>
              </div>
              <div className="rounded-lg border border-blue-100 bg-white p-4">
                <div className="flex items-center gap-2 text-blue-900">
                  <ShieldCheck className="h-5 w-5 text-blue-700" />
                  Regras de Acesso
                </div>
                <div className="mt-2 text-sm text-slate-800">
                  Usuários do plano gratuito podem buscar publicações. Recursos avançados como Ver Edital, WhatsApp, Raio‑X e Alertas Automáticos são exclusivos do Premium.
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-blue-100">
            <CardHeader>
              <CardTitle className="text-blue-900">Assine por R$ {price}/mês</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                {playBillingAvailable ? 'Pagamento via Google Play disponível.' : (twaAndroid ? 'Pagamento via Google Play indisponível neste navegador.' : 'Acesso imediato após confirmação do pagamento.')}
              </div>
              {isPremium ? (
                <div className="mt-4 space-y-3">
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">Você já é assinante Premium</div>
                  <Link href={payUrl} className="inline-flex w-full items-center justify-center rounded-md bg-blue-800 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    Ir ao Perfil
                  </Link>
                </div>
              ) : playBillingAvailable ? (
                <Button onClick={purchaseViaPlay} disabled={purchaseLoading} className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-blue-800 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  {purchaseLoading ? 'Processando...' : (skuValid ? `Comprar via Google Play${skuPrice ? ` (${skuPrice})` : ''}` : 'Assinatura indisponível')}
                </Button>
              ) : twaAndroid ? (
                <div className="space-y-3">
                  <Button disabled className="inline-flex w-full items-center justify-center rounded-md bg-gray-200 px-3 py-2 text-sm font-medium text-gray-800">Em breve via Google Play</Button>
                  <Link href="/assinar/google" className="inline-flex w-full items-center justify-center rounded-md bg-blue-800 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                    Entrar com Google e pagar via Play
                  </Link>
                </div>
              ) : (
                <Link href={ctaHref} className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-blue-800 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  Assinar Agora
                </Link>
              )}
              {purchaseMsg ? <div className="mt-3 text-center text-xs text-slate-600">{purchaseMsg}</div> : null}
              <div className="mt-3">
                <Button onClick={restoreViaPlay} disabled={restoreLoading} className="inline-flex w-full items-center justify-center rounded-md bg-green-700 px-3 py-2 text-sm font-medium text-white hover:bg-green-600">
                  {restoreLoading ? 'Restaurando...' : 'Já sou assinante / Restaurar Compra'}
                </Button>
              </div>
              {restoreMsg ? <div className="mt-2 text-center text-xs text-slate-600">{restoreMsg}</div> : null}
              <div className="mt-3 text-center text-xs text-slate-500">
                Cancelamento simples a qualquer momento.
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
