 'use client'
 import { useEffect, useState } from 'react'
 import { useRouter } from 'next/navigation'
import { supabase, authRedirectTo, buildAuthRedirect } from '@/lib/supabaseClient'
 import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
 import { Button } from '@/components/ui/button'
 
 export default function AssinarGoogleFlowPage() {
   const router = useRouter()
   const [msg, setMsg] = useState<string | null>(null)
   const [loading, setLoading] = useState(false)
   const playProductId = process.env.NEXT_PUBLIC_PLAY_PRODUCT_ID || ''
   const twaAndroid = (() => {
     try {
       const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
       const isAndroid = /android/.test(ua)
       const isStandalone = typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(display-mode: standalone)').matches : false
       return Boolean(isAndroid && isStandalone)
     } catch { return false }
   })()
   const canPlayBilling = (() => {
     try { return Boolean(twaAndroid && playProductId && typeof window !== 'undefined' && (window as any).PaymentRequest) } catch { return false }
   })()
 
   useEffect(() => {
     async function ensureLogin() {
       try {
         setMsg(null)
         if (!supabase) { setMsg('Configure o Supabase'); return }
         const { data: ud } = await supabase.auth.getUser()
         const user = ud?.user
         if (user?.id) return
        const redirectTo = buildAuthRedirect('/assinar/google')
         const { data, error } = await supabase.auth.signInWithOAuth({
           provider: 'google',
           options: { redirectTo, skipBrowserRedirect: true }
         })
         if (error) { setMsg('Falha ao iniciar login com Google'); return }
         const url = String(data?.url || '')
         if (url && typeof window !== 'undefined') {
          try {
            const target = new URL(url)
            target.searchParams.set('redirect_to', redirectTo)
            window.location.href = target.toString()
          } catch {
            window.location.href = url
          }
         } else {
           setMsg('Redirecionamento de login indisponível')
         }
       } catch (e: any) {
         setMsg(e?.message || 'Falha ao iniciar login')
       }
     }
     ensureLogin()
   }, [])
 
   async function comprarViaGooglePlay() {
     try {
       setMsg(null)
       setLoading(true)
       if (!canPlayBilling) { setMsg('Pagamento via Google Play indisponível'); return }
       const { data: ud } = await supabase?.auth.getUser()!
       const user = ud?.user
       const uid = String(user?.id || '')
       if (!uid) { setMsg('Entre com sua conta Google'); return }
      // Evita compra se já for Premium
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
          setMsg('Você já é assinante Premium')
          try { router.push('/perfil') } catch {}
          return
        }
      } catch {}
       const methodData = [{
         supportedMethods: 'https://play.google.com/billing',
        data: { sku: playProductId, type: 'subs' }
       }] as any
       const details = { total: { label: 'Premium', amount: { currency: 'BRL', value: '0.00' } } } as any
       const pr = new (window as any).PaymentRequest(methodData, details)
       const resp = await pr.show()
       await resp.complete('success')
       const tok = String(resp?.details?.purchaseToken || '')
       if (!tok) { setMsg('Token de compra não retornado'); return }
       const vr = await fetch('/api/billing/validate', {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ purchaseToken: tok, productId: playProductId, userId: uid })
       })
       if (!vr.ok) { setMsg('Falha na validação da compra'); return }
       try { router.push('/perfil') } catch {}
     } catch (e: any) {
       setMsg(e?.message || 'Falha na compra')
     } finally {
       setLoading(false)
     }
   }
 
   return (
     <div className="min-h-screen bg-slate-50">
       <header className="border-b bg-white">
         <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
           <h1 className="text-xl font-semibold text-blue-900">Assinatura via Google Play</h1>
           <Button onClick={() => router.push('/assinar')} className="bg-transparent text-blue-700 hover:underline">Voltar</Button>
         </div>
       </header>
       <main className="mx-auto max-w-5xl px-6 py-8">
         <Card className="shadow-sm border-blue-100">
           <CardHeader>
             <CardTitle className="text-blue-900">Entrar e pagar com Google</CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
               {canPlayBilling
                 ? 'Pagamento via Google Play disponível neste dispositivo.'
                 : (twaAndroid ? 'Compras via Google Play disponíveis em breve nesta versão Android.' : 'Abra pelo app Android (TWA) para pagar via Google Play.')}
             </div>
             <div className="flex gap-3">
               <Button onClick={comprarViaGooglePlay} disabled={!canPlayBilling || loading} className="inline-flex items-center justify-center rounded-md bg-blue-800 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700">
                 {loading ? 'Processando...' : 'Pagar via Google Play'}
               </Button>
               <Button onClick={() => router.push('/perfil')} className="inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium bg-gray-100 text-gray-800 hover:bg-gray-200">
                 Ir ao Perfil
               </Button>
             </div>
             {msg ? <div className="mt-2 text-xs text-slate-600">{msg}</div> : null}
           </CardContent>
         </Card>
       </main>
     </div>
   )
 }
