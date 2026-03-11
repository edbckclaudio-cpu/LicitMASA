'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function ServiceWorkerRegister() {
  const [canInstall, setCanInstall] = useState(false)
  const [promptEvent, setPromptEvent] = useState<any>(null)

  const getSubIdWithRetry = async (): Promise<string | null> => {
    try {
      const OneSignal = (typeof window !== 'undefined' ? (window as any).OneSignal : undefined)
      let pid: string | null = null
      const tryRead = async () => {
        try {
          const p1 = (OneSignal as any)?.User?.pushSubscriptionId
          const p2 = OneSignal?.User?.PushSubscription?.id
          const p3 = await OneSignal?.getSubscriptionId?.()
          pid = String(p1 || p2 || p3 || '') || null
        } catch {}
        return pid
      }
      for (let i = 0; i < 10; i++) {
        const got = await tryRead()
        if (got) return got
        try { await OneSignal?.User?.pushSubscription?.optIn?.() } catch {}
        await new Promise((r) => setTimeout(r, 800))
      }
      return pid
    } catch { return null }
  }

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
          const uemail = ud?.data?.user?.email || null
          try {
            const hasClient = !!supabase
            console.log('Auto-Sync status:', { hasClient, uid, uemail })
          } catch {}
          const getSubIdWithRetry = async (): Promise<string | null> => {
            try {
              let pid: string | null = null
              const tryRead = async () => {
                try {
                  const p1 = (OneSignal as any)?.User?.pushSubscriptionId
                  const p2 = OneSignal?.User?.PushSubscription?.id
                  const p3 = await OneSignal?.getSubscriptionId?.()
                  pid = String(p1 || p2 || p3 || '') || null
                } catch {}
                return pid
              }
              for (let i = 0; i < 10; i++) {
                const got = await tryRead()
                if (got) return got
                try { await OneSignal?.User?.pushSubscription?.optIn?.() } catch {}
                await new Promise((r) => setTimeout(r, 800))
              }
              return pid
            } catch { return null }
          }
          const ensureProfile = async () => {
            try {
              if (supabase && uid) {
                try { await supabase.from('profiles').upsert({ id: uid, // @ts-ignore
                  email: uemail || null }, { onConflict: 'id' }) } catch {}
                try {
                  const { data } = await supabase.from('profiles').select('id').eq('id', uid).maybeSingle()
                  if (!data?.id && uemail) {
                    await fetch('/api/profile/merge', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
                      body: JSON.stringify({ userId: uid, email: uemail })
                    }).catch(() => {})
                  }
                } catch {}
              }
            } catch {}
          }
          const migrateAlertsToTable = async () => {
            try {
              if (!supabase || !uid) return
              const prefs = await supabase.from('user_alerts').select('keywords').eq('user_id', uid).limit(1).maybeSingle()
              const keywords: string[] = Array.isArray(prefs.data?.keywords) ? prefs.data!.keywords.filter((x: any) => typeof x === 'string' && x.trim()).map((s: string) => s.trim()) : []
              if (!keywords.length) return
              const existing = await supabase.from('search_alerts').select('keyword').eq('user_id', uid).eq('active', true)
              const have = new Set<string>((existing.data || []).map((r: any) => String(r.keyword || '').trim().toLowerCase()).filter(Boolean))
              const missing = keywords.filter((k) => !have.has(String(k).toLowerCase()))
              if (!missing.length) return
              const rows = missing.map((k) => ({ user_id: uid, keyword: k, active: true }))
              try { await supabase.from('search_alerts').insert(rows) } catch {}
            } catch {}
          }
          const sync = async () => {
            try {
              await ensureProfile()
              let pid: string | null = null
              try {
                const p1 = (OneSignal as any)?.User?.pushSubscriptionId
                const p2 = OneSignal?.User?.PushSubscription?.id
                const p3 = await OneSignal?.getSubscriptionId?.()
                pid = String(p1 || p2 || p3 || '') || null
              } catch {}
              if (!pid) {
                pid = await getSubIdWithRetry()
              }
              if (uid && pid) {
                try {
                  if (supabase) {
                    try { 
                      const u1 = await supabase.from('profiles').upsert({ id: uid, // @ts-ignore
                        email: ud?.data?.user?.email || null }, { onConflict: 'id' })
                      if ((u1 as any)?.error) { try { console.error('profiles upsert error:', (u1 as any).error) } catch {} }
                    } catch (e:any) { try { console.error('profiles upsert throw:', e?.message || e) } catch {} }
                    try {
                      const u2 = await supabase.from('profiles').update({ subscription_id: String(pid), onesignal_id: String(pid) }).eq('id', uid)
                      if ((u2 as any)?.error) { try { console.error('profiles update subId error:', (u2 as any).error) } catch {} }
                    } catch (e:any) { try { console.error('profiles update subId throw:', e?.message || e) } catch {} }
                  }
                } catch {}
                try { 
                  if (supabase) {
                    const u3 = await supabase.from('user_alerts').upsert({ user_id: uid, fcm_token: String(pid) }, { onConflict: 'user_id' })
                    if ((u3 as any)?.error) { try { console.error('user_alerts upsert fcm_token error:', (u3 as any).error) } catch {} }
                  }
                } catch (e:any) { try { console.error('user_alerts upsert fcm_token throw:', e?.message || e) } catch {} }
                try { console.log('OneSignal ID sincronizado:', pid) } catch {}
              }
              await migrateAlertsToTable()
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
        // Garantir criação do profile imediatamente, independente do OneSignal
        (async () => {
          try {
            try {
              const u1 = await supabase!.from('profiles').upsert({ id: user.id, // @ts-ignore
                email: user.email || null }, { onConflict: 'id' })
              if ((u1 as any)?.error) { try { console.error('[EnsureProfile:init] upsert error:', (u1 as any).error) } catch {} }
            } catch (e:any) { try { console.error('[EnsureProfile:init] upsert throw:', e?.message || e) } catch {} }
            try {
              const { data } = await supabase!.from('profiles').select('id').eq('id', user.id).maybeSingle()
              if (!data?.id && user.email) {
                try {
                  const r = await fetch('/api/profile/merge', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
                    body: JSON.stringify({ userId: user.id, email: user.email })
                  })
                  try { console.log('[EnsureProfile:init] merge status:', r.status) } catch {}
                } catch (e:any) { try { console.error('[EnsureProfile:init] merge throw:', e?.message || e) } catch {} }
              }
            } catch (e:any) { try { console.error('[EnsureProfile:init] select throw:', e?.message || e) } catch {} }
          } catch {}
        })();
        OneSignal.push(function() {
          const ext = user.email || user.id
          try { OneSignal.login?.(ext); try { console.log('4. OneSignal.login executado:', ext) } catch {} } catch (e: any) { try { console.log('4. OneSignal.login falhou:', e?.message || e) } catch {} }
          try { OneSignal.setExternalUserId(ext); try { console.log('5. setExternalUserId executado:', ext) } catch {} } catch (e: any) { try { console.log('5. setExternalUserId falhou:', e?.message || e) } catch {} }
          try {
            const sync = async () => {
              try {
                try {
                  if (supabase) {
                    try { await supabase.from('profiles').upsert({ id: user.id, // @ts-ignore
                      email: user.email || null }, { onConflict: 'id' }) } catch {}
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
                  }
                } catch {}
                let pid: string | null = null
                try {
                  const p1 = (OneSignal as any)?.User?.pushSubscriptionId
                  const p2 = OneSignal?.User?.PushSubscription?.id
                  const p3 = await OneSignal?.getSubscriptionId?.()
                  pid = String(p1 || p2 || p3 || '') || null
                } catch {}
                if (!pid) {
                  pid = await getSubIdWithRetry()
                }
                if (pid) {
                  try {
                    if (supabase) {
                      try { await supabase.from('profiles').upsert({ id: user.id, // @ts-ignore
                        email: user.email || null }, { onConflict: 'id' }) } catch {}
                      await supabase.from('profiles').update({ subscription_id: String(pid), onesignal_id: String(pid) }).eq('id', user.id)
                    }
                  } catch {}
                  try { if (supabase) await supabase.from('user_alerts').upsert({ user_id: user.id, fcm_token: String(pid) }, { onConflict: 'user_id' }) } catch {}
                }
                try {
                  if (supabase) {
                    const prefs = await supabase.from('user_alerts').select('keywords').eq('user_id', user.id).limit(1).maybeSingle()
                    const keywords: string[] = Array.isArray(prefs.data?.keywords) ? prefs.data!.keywords.filter((x: any) => typeof x === 'string' && x.trim()).map((s: string) => s.trim()) : []
                    if (keywords.length) {
                      const existing = await supabase.from('search_alerts').select('keyword').eq('user_id', user.id).eq('active', true)
                      const have = new Set<string>((existing.data || []).map((r: any) => String(r.keyword || '').trim().toLowerCase()).filter(Boolean))
                      const missing = keywords.filter((k) => !have.has(String(k).toLowerCase()))
                      if (missing.length) {
                        const rows = missing.map((k) => ({ user_id: user.id, keyword: k, active: true }))
                        try { await supabase.from('search_alerts').insert(rows) } catch {}
                      }
                    }
                  }
                } catch {}
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
          // Garantir criação do profile no evento de autenticação, antes do OneSignal
          (async () => {
            try {
              const email = session?.user?.email || null
              try {
                const u1 = await supabase!.from('profiles').upsert({ id: uid, // @ts-ignore
                  email: email || null }, { onConflict: 'id' })
                if ((u1 as any)?.error) { try { console.error('[EnsureProfile:auth] upsert error:', (u1 as any).error) } catch {} }
              } catch (e:any) { try { console.error('[EnsureProfile:auth] upsert throw:', e?.message || e) } catch {} }
              try {
                const { data } = await supabase!.from('profiles').select('id').eq('id', uid).maybeSingle()
                if (!data?.id && email) {
                  try {
                    const r = await fetch('/api/profile/merge', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
                      body: JSON.stringify({ userId: uid, email })
                    })
                    try { console.log('[EnsureProfile:auth] merge status:', r.status) } catch {}
                  } catch (e:any) { try { console.error('[EnsureProfile:auth] merge throw:', e?.message || e) } catch {} }
                }
              } catch (e:any) { try { console.error('[EnsureProfile:auth] select throw:', e?.message || e) } catch {} }
            } catch {}
          })();
          const ext = (session?.user?.email || uid) as string
          try { OneSignal.login?.(ext); try { console.log('6. onAuthChange login OK:', ext) } catch {} } catch (e: any) { try { console.log('6. onAuthChange login falhou:', e?.message || e) } catch {} }
          try { OneSignal.setExternalUserId(ext); try { console.log('7. onAuthChange setExternalUserId OK:', ext) } catch {} } catch (e: any) { try { console.log('7. onAuthChange setExternalUserId falhou:', e?.message || e) } catch {} }
          try {
            const sync = async () => {
              try {
                try {
                  const email = session?.user?.email || null
                  if (supabase) {
                    try { await supabase.from('profiles').upsert({ id: uid, // @ts-ignore
                      email: email || null }, { onConflict: 'id' }) } catch {}
                    try {
                      const { data } = await supabase.from('profiles').select('id').eq('id', uid).maybeSingle()
                      if (!data?.id && email) {
                        await fetch('/api/profile/merge', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', 'x-admin-token': 'DEV' },
                          body: JSON.stringify({ userId: uid, email })
                        }).catch(() => {})
                      }
                    } catch {}
                  }
                } catch {}
                let pid: string | null = null
                try {
                  const p1 = (OneSignal as any)?.User?.pushSubscriptionId
                  const p2 = OneSignal?.User?.PushSubscription?.id
                  const p3 = await OneSignal?.getSubscriptionId?.()
                  pid = String(p1 || p2 || p3 || '') || null
                } catch {}
                if (!pid) {
                  pid = await getSubIdWithRetry()
                }
                if (pid) {
                try {
                  if (supabase) {
                    try { await supabase.from('profiles').upsert({ id: uid }, { onConflict: 'id' }) } catch {}
                    await supabase.from('profiles').update({ subscription_id: String(pid), onesignal_id: String(pid) }).eq('id', uid)
                  }
                } catch {}
                  try { if (supabase) await supabase.from('user_alerts').upsert({ user_id: uid, fcm_token: String(pid) }, { onConflict: 'user_id' }) } catch {}
                }
                try {
                  if (supabase) {
                    const prefs = await supabase.from('user_alerts').select('keywords').eq('user_id', uid).limit(1).maybeSingle()
                    const keywords: string[] = Array.isArray(prefs.data?.keywords) ? prefs.data!.keywords.filter((x: any) => typeof x === 'string' && x.trim()).map((s: string) => s.trim()) : []
                    if (keywords.length) {
                      const existing = await supabase.from('search_alerts').select('keyword').eq('user_id', uid).eq('active', true)
                      const have = new Set<string>((existing.data || []).map((r: any) => String(r.keyword || '').trim().toLowerCase()).filter(Boolean))
                      const missing = keywords.filter((k) => !have.has(String(k).toLowerCase()))
                      if (missing.length) {
                        const rows = missing.map((k) => ({ user_id: uid, keyword: k, active: true }))
                        try { await supabase.from('search_alerts').insert(rows) } catch {}
                      }
                    }
                  }
                } catch {}
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
