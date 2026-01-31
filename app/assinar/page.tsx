'use client'
import { Bell, FileText, MessageCircle, SearchCheck, Bookmark, ShieldCheck, Star } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function AssinarPage() {
  const payUrl = process.env.NEXT_PUBLIC_PAYMENT_URL || '/perfil'
  const price = process.env.NEXT_PUBLIC_PLAN_PRICE || '49,90'
  const playProductId = process.env.NEXT_PUBLIC_PLAY_PRODUCT_ID || ''
  const [ctaHref, setCtaHref] = useState<string>('/login')
  const router = useRouter()
  const twaAndroid = (() => {
    try {
      const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
      const isAndroid = /android/.test(ua)
      const isStandalone = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(display-mode: standalone)').matches : false
      return Boolean(isAndroid && isStandalone)
    } catch { return false }
  })()
  const [playBillingAvailable, setPlayBillingAvailable] = useState(false)
  const [purchaseLoading, setPurchaseLoading] = useState(false)
  const [purchaseMsg, setPurchaseMsg] = useState<string | null>(null)
  async function assinanteDeTeste() {
    try {
      setPurchaseMsg(null)
      if (!supabase) { setPurchaseMsg('Configure o Supabase'); return }
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/perfil` : '/perfil'
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo, skipBrowserRedirect: true }
      })
      if (error) { setPurchaseMsg('Falha ao iniciar login de teste'); return }
      const url = String(data?.url || '')
      if (url && typeof window !== 'undefined') {
        window.location.href = url
        return
      }
      setPurchaseMsg('Redirecionamento indisponível')
    } catch (e: any) {
      setPurchaseMsg(e?.message || 'Falha no login de teste')
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
    async function probe() {
      try {
        setPlayBillingAvailable(false)
        if (!twaAndroid) return
        if (!playProductId) return
        const w: any = typeof window !== 'undefined' ? window : null
        if (!w) return
        if (!('getDigitalGoodsService' in w)) return
        const svc = await w.getDigitalGoodsService('https://play.google.com/billing')
        if (!svc) return
        if (!(w as any).PaymentRequest) return
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
      const methodData = [{
        supportedMethods: 'https://play.google.com/billing',
        data: { sku: playProductId, type: 'subs' }
      }] as any
      const pr = new (window as any).PaymentRequest(methodData, {})
      const resp = await pr.show()
      await resp.complete('success')
      const tok = String(resp?.details?.purchaseToken || '')
      const ud = await supabase?.auth.getUser()
      const user = ud?.data?.user
      const uid = String(user?.id || '')
      if (!tok || !uid) { setPurchaseMsg('Falha ao capturar token de compra'); return }
      const vr = await fetch('/api/billing/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ purchaseToken: tok, productId: playProductId, userId: uid })
      })
      setPurchaseMsg(vr.ok ? 'Premium liberado' : 'Falha na validação')
      if (vr.ok) {
        try { router.push(payUrl) } catch {}
      }
    } catch (e: any) {
      setPurchaseMsg(e?.message || 'Falha na compra')
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
              {playBillingAvailable ? (
                <Button onClick={purchaseViaPlay} disabled={purchaseLoading} className="mt-4 inline-flex w-full items-center justify-center rounded-md bg-blue-800 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  {purchaseLoading ? 'Processando...' : 'Comprar via Google Play'}
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
