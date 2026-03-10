import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2).reduce((acc, a) => {
  const m = a.match(/^--([^=]+)=(.*)$/)
  if (m) acc[m[1]] = m[2]
  return acc
}, {})

const SUPABASE_URL = argv.url || process.env.SUPABASE_URL || ''
const SERVICE_ROLE_KEY = argv.key || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const USER_EMAIL = argv.email || process.env.USER_EMAIL || ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !USER_EMAIL) {
  console.error('[check-runs] Missing --url --key --email')
  process.exit(1)
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  const { data: prof } = await supa.from('profiles').select('id').eq('email', USER_EMAIL).limit(1).maybeSingle()
  if (!prof?.id) {
    console.error('[check-runs] user not found')
    process.exit(1)
  }
  const userId = prof.id
  const { data, error } = await supa
    .from('alert_runs')
    .select('created_at,keyword,uf,found_count,notified_count,channel,error')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10)
  if (error) {
    console.error('[check-runs] query error:', error.message)
    process.exit(1)
  }
  console.log('[check-runs] last runs:', data || [])
  const totalNotified = (data || []).reduce((acc, r) => acc + (Number(r.notified_count || 0)), 0)
  console.log(JSON.stringify({ ok: true, totalNotified }, null, 2))
}

main().catch((e) => {
  console.error('[check-runs] fatal:', e?.message || e)
  process.exit(1)
})

