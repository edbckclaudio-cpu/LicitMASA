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
    const { data: userData } = await supabase.auth.getUser()
    const user = userData?.user
    if (!user) return token
    await supabase
      .from('user_alerts')
      .upsert({ user_id: user.id, fcm_token: token }, { onConflict: 'user_id' })
    return token
  } catch {
    return null
  }
}
