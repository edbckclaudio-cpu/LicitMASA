'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ServiceWorkerRegister() {
  const [canInstall, setCanInstall] = useState(false)
  const [promptEvent, setPromptEvent] = useState<any>(null)

  useEffect(() => {
    if (typeof window === 'undefined') return
    try { window.alert('Status do SDK: ' + (typeof (window as any).OneSignal !== 'undefined')) } catch {}
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    if ('serviceWorker' in navigator) {
      const isProd = process.env.NODE_ENV === 'production'
      if (!isProd) {
        navigator.serviceWorker.getRegistrations()
          .then((regs) => Promise.all(regs.map((r) => r.unregister())))
          .catch(() => {})
        if (window.caches) {
          caches.keys().then((keys) => {
            keys.forEach((k) => caches.delete(k))
          }).catch(() => {})
        }
      } else {
        try {
          navigator.serviceWorker.getRegistrations()
            .then((regs) => {
              try { window.alert('SW registrados: ' + regs.map((r) => r.scope).join(', ') ) } catch {}
            })
            .catch(() => {})
        } catch {}
      }
    }
  }, [])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const OneSignal = (window as any).OneSignal || []
    ;(window as any).OneSignal = OneSignal
    OneSignal.push(function() {
      try { window.alert('1. Carregando SDK...') } catch {}
      try {
        const APP_ID = '43f9ce9c-8d86-4076-a8b6-30dac8429149'
        try { window.alert('2. ID sendo usado: ' + APP_ID) } catch {}
        const p = OneSignal.init({
          appId: APP_ID,
          serviceWorkerPath: 'OneSignalSDKWorker.js',
          serviceWorkerParam: { scope: '/' },
          allowLocalhostAsSecureOrigin: true,
        })
        Promise.resolve(p)
          .then((res: any) => { try { window.alert('3. Resultado do Init: ' + String(res ?? 'ok')) } catch {} })
          .catch((e: any) => {
            const msg = String(e?.message || e)
            let reason = msg
            try {
              if (/invalid.*app.*id/i.test(msg)) reason = 'App ID Inválido'
              else if (/service.*worker.*(not|missing|fail)/i.test(msg)) reason = 'Service Worker não encontrado'
            } catch {}
            try { (window as any).__ONE_SIGNAL_INIT_ERROR = reason } catch {}
            try { window.alert('3. Resultado do Init: ' + reason) } catch {}
            try { window.alert('Erro OneSignal: ' + String(e?.message || e)) } catch {}
            try {
              const m = String(reason).match(/https?:\/\/[^\s]+/i)
              const target = m ? m[0].replace(/\/+$/,'') : ''
              const current = typeof window !== 'undefined' ? String(window.location.origin).replace(/\/+$/,'') : ''
              if (target && current && target !== current) {
                const path = typeof window !== 'undefined' ? (String(window.location.pathname || '') + String(window.location.search || '')) : ''
                window.location.href = target + path
              }
            } catch {}
          })
      } catch (e: any) {
        const msg = String(e?.message || e)
        let reason = msg
        try {
          if (/invalid.*app.*id/i.test(msg)) reason = 'App ID Inválido'
          else if (/service.*worker.*(not|missing|fail)/i.test(msg)) reason = 'Service Worker não encontrado'
        } catch {}
        try { (window as any).__ONE_SIGNAL_INIT_ERROR = reason } catch {}
        try { window.alert('3. Resultado do Init: ' + reason) } catch {}
        try { window.alert('Erro OneSignal: ' + String(e?.message || e)) } catch {}
        try {
          const m = String(reason).match(/https?:\/\/[^\s]+/i)
          const target = m ? m[0].replace(/\/+$/,'') : ''
          const current = typeof window !== 'undefined' ? String(window.location.origin).replace(/\/+$/,'') : ''
          if (target && current && target !== current) {
            const path = typeof window !== 'undefined' ? (String(window.location.pathname || '') + String(window.location.search || '')) : ''
            window.location.href = target + path
          }
        } catch {}
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
