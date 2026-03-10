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
    if ((window as any).OneSignalInitialized) return
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
        try {
          const ud = await supabase?.auth.getUser()
          const uid = ud?.data?.user?.id
          const sync = async () => {
            try {
              let pid: string | null = null
              try {
                const p1 = (OneSignal as any)?.User?.pushSubscriptionId
                const p2 = OneSignal?.User?.PushSubscription?.id
                const p3 = await OneSignal?.getSubscriptionId?.()
                pid = String(p1 || p2 || p3 || '') || null
              } catch {}
              if (!pid) {
                try { await OneSignal?.User?.pushSubscription?.optIn?.() } catch {}
                await new Promise((r) => setTimeout(r, 400))
                try {
                  const p1b = (OneSignal as any)?.User?.pushSubscriptionId
                  const p2b = OneSignal?.User?.PushSubscription?.id
                  const p3b = await OneSignal?.getSubscriptionId?.()
                  pid = String(p1b || p2b || p3b || '') || null
                } catch {}
              }
              if (uid && pid) {
                try { if (supabase) await supabase.from('profiles').update({ subscription_id: String(pid) }).eq('id', uid) } catch {}
                try { if (supabase) await supabase.from('user_alerts').upsert({ user_id: uid, fcm_token: String(pid) }, { onConflict: 'user_id' }) } catch {}
                try { console.log('OneSignal ID sincronizado:', pid) } catch {}
              }
            } catch {}
          }
          try { await sync() } catch {}
          try {
            OneSignal?.User?.addEventListener?.('subscriptionChange', () => {
              try { sync() } catch {}
              try {
                if (uid) {
                  try { OneSignal.login?.(uid) } catch {}
                  try { OneSignal.setExternalUserId?.(uid) } catch {}
                }
              } catch {}
            })
          } catch {}
        } catch {}
        try {
          const hasNotif = !!(OneSignal && (OneSignal as any).Notifications)
          if (!hasNotif) {
            ;(OneSignal as any).Notifications = {}
            try {
              if (!((OneSignal as any).Notifications as any).on) {
                ;((OneSignal as any).Notifications as any).on = function() {}
              }
            } catch {}
          }
        } catch {}
        try {
          if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations().catch(() => [])
            const found = Array.isArray(regs) && regs.some((r: any) => {
              const s1 = (r.active && (r.active as any).scriptURL) || ''
              const s2 = (r.installing && (r.installing as any).scriptURL) || ''
              const s3 = (r.waiting && (r.waiting as any).scriptURL) || ''
              return [s1, s2, s3].some((u) => typeof u === 'string' && /OneSignalSDKWorker\.js/i.test(u))
            })
            if (!found) {
              try { console.log('Tentando registrar SW em /OneSignalSDKWorker.js') } catch {}
              await navigator.serviceWorker.register('/OneSignalSDKWorker.js').catch(() => {})
            }
          }
        } catch {}
        try { (window as any).OneSignalInitialized = true } catch {}
        try { OneSignal?.Debug?.setLogLevel?.('trace') } catch {}
        try {
          const pid = (OneSignal as any)?.User?.pushSubscriptionId || await OneSignal?.getSubscriptionId?.()
          if (pid) { try { console.log('OneSignal SubscriptionId:', String(pid)) } catch {} }
        } catch {}
        try { OneSignal?.Slidedown?.promptPush?.() } catch {}
        try { OneSignal?.Notifications?.requestPermission?.() } catch {}
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
          try {
            const sync = async () => {
              try {
                let pid: string | null = null
                try {
                  const p1 = (OneSignal as any)?.User?.pushSubscriptionId
                  const p2 = OneSignal?.User?.PushSubscription?.id
                  const p3 = await OneSignal?.getSubscriptionId?.()
                  pid = String(p1 || p2 || p3 || '') || null
                } catch {}
                if (!pid) {
                  try { await OneSignal?.User?.pushSubscription?.optIn?.() } catch {}
                  await new Promise((r) => setTimeout(r, 400))
                  try {
                    const p1b = (OneSignal as any)?.User?.pushSubscriptionId
                    const p2b = OneSignal?.User?.PushSubscription?.id
                    const p3b = await OneSignal?.getSubscriptionId?.()
                    pid = String(p1b || p2b || p3b || '') || null
                  } catch {}
                }
                if (pid) {
                  try { if (supabase) await supabase.from('profiles').update({ subscription_id: String(pid) }).eq('id', user.id) } catch {}
                  try { if (supabase) await supabase.from('user_alerts').upsert({ user_id: user.id, fcm_token: String(pid) }, { onConflict: 'user_id' }) } catch {}
                }
              } catch {}
            }
            try { sync() } catch {}
          } catch {}
        })
      }
    })
    supabase?.auth.onAuthStateChange((_ev, session) => {
      const uid = session?.user?.id
      OneSignal.push(function() {
        if (uid) {
          try { OneSignal.login?.(uid); try { console.log('6. onAuthChange login OK:', uid) } catch {} } catch (e: any) { try { console.log('6. onAuthChange login falhou:', e?.message || e) } catch {} }
          try { OneSignal.setExternalUserId(uid); try { console.log('7. onAuthChange setExternalUserId OK:', uid) } catch {} } catch (e: any) { try { console.log('7. onAuthChange setExternalUserId falhou:', e?.message || e) } catch {} }
          try {
            const sync = async () => {
              try {
                let pid: string | null = null
                try {
                  const p1 = (OneSignal as any)?.User?.pushSubscriptionId
                  const p2 = OneSignal?.User?.PushSubscription?.id
                  const p3 = await OneSignal?.getSubscriptionId?.()
                  pid = String(p1 || p2 || p3 || '') || null
                } catch {}
                if (!pid) {
                  try { await OneSignal?.User?.pushSubscription?.optIn?.() } catch {}
                  await new Promise((r) => setTimeout(r, 400))
                  try {
                    const p1b = (OneSignal as any)?.User?.pushSubscriptionId
                    const p2b = OneSignal?.User?.PushSubscription?.id
                    const p3b = await OneSignal?.getSubscriptionId?.()
                    pid = String(p1b || p2b || p3b || '') || null
                  } catch {}
                }
                if (pid) {
                  try { if (supabase) await supabase.from('profiles').update({ subscription_id: String(pid) }).eq('id', uid) } catch {}
                  try { if (supabase) await supabase.from('user_alerts').upsert({ user_id: uid, fcm_token: String(pid) }, { onConflict: 'user_id' }) } catch {}
                }
              } catch {}
            }
            try { sync() } catch {}
          } catch {}
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
