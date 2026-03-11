import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = url && key ? createClient(url, key) : null

const siteEnv = process.env.NEXT_PUBLIC_SITE_URL || ''
const siteRuntime = typeof window !== 'undefined' ? window.location.origin : ''
export const authRedirectTo = siteRuntime || siteEnv || 'http://localhost:3000'
export function buildAuthRedirect(path: string = '/perfil') {
  try {
    const rt = typeof window !== 'undefined' ? window.location.origin : ''
    const host = typeof window !== 'undefined' ? window.location.hostname : ''
    const ua = typeof navigator !== 'undefined' ? navigator.userAgent.toLowerCase() : ''
    const isTwa = typeof window !== 'undefined' && !!(window as any).matchMedia && (window as any).matchMedia('(display-mode: standalone)').matches && /android/.test(ua)
    const base = isTwa
      ? (siteEnv || 'https://www.licitmasa.com.br')
      : ((!rt || /^(localhost|127\.0\.0\.1)$/i.test(host)) ? (siteEnv || 'https://www.licitmasa.com.br') : rt)
    const clean = path.startsWith('/') ? path : `/${path}`
    return `${base}${clean}`
  } catch {
    const clean = path.startsWith('/') ? path : `/${path}`
    return `${(siteEnv || 'https://www.licitmasa.com.br')}${clean}`
  }
}

try {
  const mask = (s: string) => s ? `${s.slice(0, 4)}...${s.slice(-3)}` : ''
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  console.log('[SupabaseClient] url set:', !!url, 'key len:', key ? key.length : 0, 'host:', host, 'url prefix:', url ? url.slice(0, 30) : '')
  if (!supabase) console.error('[SupabaseClient] supabase client is null. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.')
} catch {}
