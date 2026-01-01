'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ServiceWorkerRegister() {
  const [canInstall, setCanInstall] = useState(false)
  const [promptEvent, setPromptEvent] = useState<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('serviceWorker' in navigator) {
      const isProd = process.env.NODE_ENV === 'production'
      const host = typeof location !== 'undefined' ? location.hostname : ''
      const isLocalhost = /^(localhost|127\.0\.0\.1)$/i.test(host)
      if (!isProd && isLocalhost) {
        navigator.serviceWorker.getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister())))
          .catch(() => {})
        if (window.caches) {
          caches.keys().then((keys) => {
            keys.forEach((k) => caches.delete(k))
          }).catch(() => {})
        }
      }
    }
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const OneSignal = (window as any).OneSignal || []
    ;(window as any).OneSignal = OneSignal
    OneSignal.push(async function() {
      try {
        try { console.log('1. Iniciando OneSignal...') } catch {}
        const APP_ID = '43f9ce9c-8d86-4076-a8b6-30dac8429149'
        try { console.log('2. App ID usado:', APP_ID) } catch {}
        await OneSignal.init({
          appId: APP_ID,
          allowLocalhostAsSecureOrigin: true,
          serviceWorkerPath: '/OneSignalSDKWorker.js',
          serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js'
        })
        try { OneSignal?.Debug?.setLogLevel?.('trace') } catch {}
      } catch (e: any) {
        try { console.log('INIT OneSignal falhou:', e?.message || e) } catch {}
        try { ;(window as any).__ONE_SIGNAL_INIT_ERROR = e?.message || 'INIT_FAILED' } catch {}
      }
    })
    supabase?.auth.getUser().then((ud) => {
      const user = ud?.data?.user
      try { console.log('3. Utilizador Supabase:', user?.id || null) } catch {}
      if (user?.id) {
        OneSignal.push(function() {
          try { OneSignal.login?.(user.id); try { console.log('4. OneSignal.login executado:', user.id) } catch {} } catch (e: any) { try { console.log('4. OneSignal.login falhou:', e?.message || e) } catch {} }
          try { OneSignal.setExternalUserId(user.id); try { console.log('5. setExternalUserId executado:', user.id) } catch {} } catch (e: any) { try { console.log('5. setExternalUserId falhou:', e?.message || e) } catch {} }
        })
      }
    })
    supabase?.auth.onAuthStateChange((_ev, session) => {
      const uid = session?.user?.id
      OneSignal.push(function() {
        if (uid) {
          try { OneSignal.login?.(uid); try { console.log('6. onAuthChange login OK:', uid) } catch {} } catch (e: any) { try { console.log('6. onAuthChange login falhou:', e?.message || e) } catch {} }
          try { OneSignal.setExternalUserId(uid); try { console.log('7. onAuthChange setExternalUserId OK:', uid) } catch {} } catch (e: any) { try { console.log('7. onAuthChange setExternalUserId falhou:', e?.message || e) } catch {} }
        } else {
          try { OneSignal.removeExternalUserId() } catch {}
        }
      })
    })
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
