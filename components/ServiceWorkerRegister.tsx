'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

const ONE_SIGNAL_APP_ID = '43f9ce9c-8d86-4076-a8b6-30dac8429149'

type AuthUserLike = {
  id: string
  email?: string | null
} | null

/**
 * Bootstrap do ambiente cliente para PWA/TWA.
 *
 * Responsabilidades principais:
 * - expor o cliente Supabase para debug controlado no navegador;
 * - remover service workers antigos que conflitam com o OneSignal;
 * - inicializar o SDK web do OneSignal;
 * - garantir existencia de `profiles`;
 * - sincronizar `subscription_id` com o backend;
 * - migrar filtros legados para `search_alerts` quando aplicavel.
 *
 * Este componente e critico para a entrega de push. Mudancas aqui devem
 * preservar a ordem geral: auth -> profile -> OneSignal -> sync-subscription.
 */
export default function ServiceWorkerRegister() {
  const [canInstall, setCanInstall] = useState(false)
  const [promptEvent, setPromptEvent] = useState<any>(null)
  const oneSignalInited = useRef(false)
  const oneSignalScriptPromise = useRef<Promise<any> | null>(null)
  const syncInFlightRef = useRef(false)
  const syncQueuedRef = useRef(false)

  const hasSyncedThisSession = () => {
    try {
      if (typeof window === 'undefined') return false
      return window.sessionStorage.getItem('on_signal_synced') === 'true'
        || window.sessionStorage.getItem('synced_session') === 'true'
    } catch {
      return false
    }
  }

  const markSyncedThisSession = () => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem('on_signal_synced', 'true')
        window.sessionStorage.removeItem('synced_session')
      }
    } catch {}
  }

  const clearSyncedThisSession = () => {
    try {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem('on_signal_synced')
        window.sessionStorage.removeItem('synced_session')
      }
    } catch {}
  }

  /**
   * Tenta resolver o `subscription_id` do OneSignal com retry leve.
   *
   * Nao chama `optIn()` nem slidedown no startup para nao competir com a
   * busca inicial e nao disparar "Already subscribed" / "dismissed".
   */
  const getSubIdWithRetry = async (oneSignal: any): Promise<string | null> => {
    try {
      for (let i = 0; i < 4; i++) {
        const p1 = oneSignal?.User?.pushSubscriptionId
        const p2 = oneSignal?.User?.PushSubscription?.id
        const p3 = await oneSignal?.getSubscriptionId?.()
        const got = String(p1 || p2 || p3 || '') || null
        if (got) return got
        await new Promise((r) => setTimeout(r, 1000))
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Carrega o SDK web do OneSignal apenas no cliente e somente uma vez.
   *
   * Isso evita que o script participe da fase de hidratacao do React e reduz
   * a chance de o SDK tocar em DOM/SW antes de o app concluir o primeiro paint.
   */
  const loadOneSignalSdk = async (): Promise<any> => {
    if (typeof window === 'undefined') return null
    const current = (window as any).OneSignal
    if (current && typeof current.init === 'function') return current
    if (oneSignalScriptPromise.current) return oneSignalScriptPromise.current

    oneSignalScriptPromise.current = new Promise((resolve, reject) => {
      try {
        const existing = document.querySelector('script[data-onesignal-sdk="true"]') as HTMLScriptElement | null
        if (existing) {
          existing.addEventListener('load', () => resolve((window as any).OneSignal || []), { once: true })
          existing.addEventListener('error', () => reject(new Error('ONESIGNAL_SCRIPT_LOAD_FAILED')), { once: true })
          return
        }

        const script = document.createElement('script')
        script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js'
        script.async = true
        script.defer = true
        script.setAttribute('data-onesignal-sdk', 'true')
        script.onload = () => resolve((window as any).OneSignal || [])
        script.onerror = () => reject(new Error('ONESIGNAL_SCRIPT_LOAD_FAILED'))
        document.body.appendChild(script)
      } catch (err) {
        reject(err)
      }
    })

    return oneSignalScriptPromise.current
  }

  const ensureProfile = async (user: AuthUserLike) => {
    try {
      if (!supabase || !user?.id) return
      try {
        await supabase.from('profiles').upsert({
          id: user.id,
          // @ts-ignore
          email: user.email || null,
        }, { onConflict: 'id' })
      } catch {}
      try {
        const { data } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
        if (!data?.id && user.email) {
          await fetch('/api/profile/merge', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
            body: JSON.stringify({ userId: user.id, email: user.email })
          }).catch(() => {})
        }
      } catch {}
    } catch {}
  }

  const migrateAlertsToTable = async (userId: string) => {
    try {
      if (!supabase || !userId) return
      // evitar 404: tabela user_alerts não disponível neste projeto
      const prefs = { data: null } as any
      const keywords: string[] = Array.isArray(prefs.data?.keywords)
        ? prefs.data.keywords.filter((x: any) => typeof x === 'string' && x.trim()).map((s: string) => s.trim())
        : []
      if (!keywords.length) return
      const existing = await supabase.from('search_alerts').select('keyword').eq('user_id', userId).eq('active', true)
      const have = new Set<string>((existing.data || []).map((r: any) => String(r.keyword || '').trim().toLowerCase()).filter(Boolean))
      const missing = keywords.filter((k) => !have.has(String(k).toLowerCase()))
      if (!missing.length) return
      const rows = missing.map((k) => ({ user_id: userId, keyword: k, active: true }))
      try { await supabase.from('search_alerts').insert(rows) } catch {}
    } catch {}
  }

  const syncUserState = async (oneSignal: any, userArg?: AuthUserLike) => {
    if (!supabase || !oneSignal) return
    if (syncInFlightRef.current) {
      syncQueuedRef.current = true
      return
    }

    syncInFlightRef.current = true
    try {
      const resolvedUser = userArg || (await supabase.auth.getUser())?.data?.user || null
      const user = resolvedUser ? { id: resolvedUser.id, email: resolvedUser.email || null } : null
      if (!user?.id) return

      if (hasSyncedThisSession()) {
        await migrateAlertsToTable(user.id)
        return
      }

      await ensureProfile(user)

      const ext = (user.email || user.id) as string
      try { oneSignal.login?.(ext) } catch {}

      const pid = await getSubIdWithRetry(oneSignal)
      if (pid) {
        try {
          const sess = await supabase.auth.getSession()
          const jwt = String(sess?.data?.session?.access_token || '')
          if (jwt) {
            const r = await fetch('/api/profile/sync-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
              body: JSON.stringify({ subscriptionId: String(pid) })
            })
            if (r.ok) markSyncedThisSession()
          }
        } catch {}
      } else {
        markSyncedThisSession()
      }

      await migrateAlertsToTable(user.id)
    } finally {
      syncInFlightRef.current = false
      if (syncQueuedRef.current) {
        syncQueuedRef.current = false
        window.setTimeout(() => {
          const current = (window as any).OneSignal
          void syncUserState(current)
        }, 0)
      }
    }
  }

  // Disponibiliza o client no escopo global para diagnosticos manuais no browser.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { (window as any).__supabase = supabase } catch {}
  }, [])

  // Remove service workers antigos para evitar conflito com o worker oficial do OneSignal.
  useEffect(() => {
    if (typeof window === 'undefined') return
    ;(async () => {
      try {
        const purgeKey = 'sw_purged_v1'
        const already = typeof localStorage !== 'undefined' ? localStorage.getItem(purgeKey) : '0'
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations().catch(() => [])
          let changed = false
          for (const r of regs) {
            try {
              const url = String((r.active && (r.active as any).scriptURL) || (r.installing && (r.installing as any).scriptURL) || (r.waiting && (r.waiting as any).scriptURL) || '')
              const isOneSignal = /OneSignalSDKWorker\.js/i.test(url)
              if (!isOneSignal) {
                await r.unregister().catch(() => null)
                changed = true
              }
            } catch {}
          }
          if (changed && already !== '1') {
            try {
              if (window.caches) {
                const names = await caches.keys().catch(() => [])
                for (const n of names || []) {
                  try { await caches.delete(n) } catch {}
                }
              }
            } catch {}
            try { localStorage.setItem(purgeKey, '1') } catch {}
            try { location.reload() } catch {}
          }
        }
      } catch {}
    })()
  }, [])

  // Inicializa o OneSignal depois do primeiro paint e sincroniza o estado do usuario sem duplicidade.
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (oneSignalInited.current) return

    let subscriptionChangeHandler: (() => void) | null = null

    const timer = window.setTimeout(() => {
      if (oneSignalInited.current) return
      oneSignalInited.current = true

      ;(async () => {
        try {
          const oneSignal = await loadOneSignalSdk().catch((err) => {
            try { console.error('Erro ao carregar SDK do OneSignal:', err) } catch {}
            return null
          })
          if (!oneSignal) return

          ;(window as any).OneSignal = oneSignal

          if (!(window as any).OneSignalInitialized) {
            await oneSignal.init({
              appId: ONE_SIGNAL_APP_ID,
              autoResubscribe: false,
              allowLocalhostAsSecureOrigin: true,
              promptOptions: { slidedown: { autoPrompt: false } },
              serviceWorkerParam: { scope: '/' },
              serviceWorkerPath: '/OneSignalSDKWorker.js',
              serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js'
            })
            try { (window as any).OneSignalInitialized = true } catch {}
          }

          await syncUserState(oneSignal)

          subscriptionChangeHandler = () => {
            void syncUserState(oneSignal)
          }
          try { oneSignal?.User?.addEventListener?.('subscriptionChange', subscriptionChangeHandler) } catch {}
        } catch (err: any) {
          try { ;(window as any).__ONE_SIGNAL_INIT_ERROR = err?.message || 'INIT_FAILED' } catch {}
          try { console.error('Erro silencioso OneSignal:', err) } catch {}
        }
      })()
    }, 10000)

    const authSubscription = supabase?.auth.onAuthStateChange((event, session) => {
      const user = session?.user ? { id: session.user.id, email: session.user.email || null } : null
      if (!user?.id) {
        try { ((window as any).OneSignal || {}).logout?.() } catch {}
        clearSyncedThisSession()
        return
      }

      const authEvent = String(event || '').toLowerCase()
      if (authEvent === 'signed_in') {
        clearSyncedThisSession()
      }

      if (hasSyncedThisSession()) return

      void ensureProfile(user)

      window.setTimeout(() => {
        const currentOneSignal = (window as any).OneSignal
        if (currentOneSignal && typeof currentOneSignal.init === 'function') {
          void syncUserState(currentOneSignal, user)
        }
      }, 300)
    })

    return () => {
      window.clearTimeout(timer)
      try {
        const currentOneSignal = (window as any).OneSignal
        if (subscriptionChangeHandler && currentOneSignal?.User?.removeEventListener) {
          currentOneSignal.User.removeEventListener('subscriptionChange', subscriptionChangeHandler)
        }
      } catch {}
      authSubscription?.data?.subscription?.unsubscribe?.()
    }
  }, [])

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault()
      setPromptEvent(e)
      setCanInstall(true)
    }
    window.addEventListener('beforeinstallprompt', handler)
    const installed = () => {
      setCanInstall(false)
      setPromptEvent(null)
    }
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  async function install() {
    if (!promptEvent) return
    setCanInstall(false)
    await promptEvent.prompt()
    setPromptEvent(null)
  }

  return canInstall ? (
    <button
      onClick={install}
      className="fixed bottom-4 right-4 z-50 md:hidden rounded-full bg-blue-700 text-white px-4 py-2 text-sm shadow-lg"
    >
      Instalar App
    </button>
  ) : null
}
