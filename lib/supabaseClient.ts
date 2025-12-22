import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export const supabase = url && key ? createClient(url, key) : null

const siteEnv = process.env.NEXT_PUBLIC_SITE_URL || ''
const siteRuntime = typeof window !== 'undefined' ? window.location.origin : ''
export const authRedirectTo = siteRuntime || siteEnv || 'http://localhost:3000'
