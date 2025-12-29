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
    const OneSignal = (window as any).OneSignal || []
    ;(window as any).OneSignal = OneSignal
    OneSignal.push(function() {
      try { window.alert('Iniciando OneSignal...') } catch {}
      try {
        const p = OneSignal.init({
          appId: '43f9ce9c-8d86-4076-a8b6-30dac8429149',
          serviceWorkerParam: { scope: '/' },
          serviceWorkerPath: 'OneSignalSDKWorker.js',
        })
        Promise.resolve(p)
          .then(() => { try { window.alert('OneSignal Iniciado com Sucesso!') } catch {} })
          .catch((e: any) => {
            const msg = String(e?.message || e)
            let reason = msg
            try {
              if (/invalid.*app.*id/i.test(msg)) reason = 'App ID Inválido'
              else if (/service.*worker.*(not|missing|fail)/i.test(msg)) reason = 'Service Worker não encontrado'
            } catch {}
            try { window.alert('Erro OneSignal: ' + reason) } catch {}
          })
      } catch (e: any) {
        const msg = String(e?.message || e)
        let reason = msg
        try {
          if (/invalid.*app.*id/i.test(msg)) reason = 'App ID Inválido'
          else if (/service.*worker.*(not|missing|fail)/i.test(msg)) reason = 'Service Worker não encontrado'
        } catch {}
        try { window.alert('Erro OneSignal: ' + reason) } catch {}
      }
      try { OneSignal.Notifications.requestPermission() } catch {}
    })
    supabase?.auth.getUser().then((ud) => {
      const user = ud?.data?.user
      if (user?.id) {
        OneSignal.push(function() {
          try { OneSignal.login?.(user.id) } catch {}
          try { OneSignal.setExternalUserId(user.id) } catch {}
        })
      }
    })
    supabase?.auth.onAuthStateChange((_ev, session) => {
      const uid = session?.user?.id
      OneSignal.push(function() {
        if (uid) {
          try { OneSignal.login?.(uid) } catch {}
          try { OneSignal.setExternalUserId(uid) } catch {}
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
