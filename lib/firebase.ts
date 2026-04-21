import { initializeApp, getApps } from 'firebase/app'
import { getMessaging, getToken, isSupported } from 'firebase/messaging'
import { supabase } from './supabaseClient'

function init() {
  const cfg = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
  }
  const app = getApps().length ? getApps()[0] : initializeApp(cfg)
  return app
}

export async function requestAndSaveToken(): Promise<string | null> {
  try {
    // O app usa OneSignal como canal principal de push. Evitamos registrar
    // um segundo service worker do Firebase quando o OneSignal já está ativo,
    // pois isso causa conflito de workers e reinstalações repetidas.
    if (typeof window !== 'undefined') {
      try {
        const hasOneSignalSdk = !!(window as any).OneSignal
        if (hasOneSignalSdk) return null
      } catch {}
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations().catch(() => [])
          const hasOneSignalWorker = Array.isArray(regs) && regs.some((r: any) => {
            const s1 = (r.active && (r.active as any).scriptURL) || ''
            const s2 = (r.installing && (r.installing as any).scriptURL) || ''
            const s3 = (r.waiting && (r.waiting as any).scriptURL) || ''
            return [s1, s2, s3].some((u) => typeof u === 'string' && /OneSignalSDKWorker\.js/i.test(u))
          })
          if (hasOneSignalWorker) return null
        }
      } catch {}
    }
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return null
    const supported = await isSupported()
    if (!supported) return null
    const app = init()
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      try { await navigator.serviceWorker.register('/firebase-messaging-sw.js') } catch {}
    }
    const messaging = getMessaging(app)
    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || ''
    const token = await getToken(messaging, { vapidKey }).catch(() => null)
    if (!token || !supabase) return token
    // Integração original com user_alerts desativada neste projeto (tabela ausente).
    // Mantemos apenas a solicitação do token para eventuais usos locais.
    return token
  } catch {
    return null
  }
}
