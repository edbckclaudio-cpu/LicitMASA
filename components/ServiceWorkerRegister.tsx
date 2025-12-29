'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ServiceWorkerRegister() {
  const [canInstall, setCanInstall] = useState(false)
  const [promptEvent, setPromptEvent] = useState<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('serviceWorker' in navigator) {
      const isProd = process.env.NODE_ENV === 'production'
      if (isProd) {
        navigator.serviceWorker.register('/sw.js').catch(() => {})
      } else {
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
    try { alert('ID: ' + (process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || '')) } catch {}
    const isProd = process.env.NODE_ENV === 'production'
    const appIdEnv = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID || ''
    const appIdWanted = '43f9ce9c-8d86-4076-a8b6-30dac8429149'
    const appId = appIdEnv || appIdWanted
    try {
      if (appId !== appIdWanted) {
        console.error('OneSignal appId diferente do esperado', { appIdEnv, appIdUsed: appId, appIdWanted })
      }
    } catch {}
    if (!isProd) return
    if (!(window as any).OneSignal) {
      const s = document.createElement('script')
      s.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js'
      s.async = true
      s.onerror = (e) => { try { console.error('Falha ao carregar OneSignalSDK.js', e) } catch {} }
      s.onload = () => {
        const OneSignal = (window as any).OneSignal || []
        ;(window as any).OneSignal = OneSignal
        OneSignal.push(function() {
          try {
            OneSignal.init({
              appId,
              allowLocalhostAsSecureOrigin: true,
              serviceWorkerPath: '/OneSignalSDKWorker.js',
              serviceWorkerUpdaterPath: '/OneSignalSDKUpdaterWorker.js',
              notifyButton: { enable: false },
            })
          } catch (e: any) {
            try { console.log('OneSignal.init error', e) } catch {}
            try { console.error('Erro ao inicializar OneSignal', e) } catch {}
          }
          try { OneSignal.Notifications.requestPermission() } catch {}
        })
        supabase?.auth.getUser().then((ud) => {
          const user = ud?.data?.user
          if (user?.id) {
            OneSignal.push(function() {
              try { console.log('OneSignal init: fazendo login com usuário', user.id) } catch {}
              try { OneSignal.login?.(user.id) } catch {}
              OneSignal.setExternalUserId(user.id)
            })
          }
        })
        supabase?.auth.onAuthStateChange((_ev, session) => {
          const uid = session?.user?.id
          OneSignal.push(function() {
            if (uid) {
              try { console.log('OneSignal auth change: fazendo login com usuário', uid) } catch {}
              try { OneSignal.login?.(uid) } catch {}
              OneSignal.setExternalUserId(uid)
            } else {
              OneSignal.removeExternalUserId()
            }
          })
        })
      }
      document.head.appendChild(s)
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
