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
  console.error('[seed-alerts] Missing --url, --key or --email')
  process.exit(1)
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  const { data: prof, error: e1 } = await supa.from('profiles').select('id,email,is_premium').eq('email', USER_EMAIL).limit(1).maybeSingle()
  if (e1) {
    console.error('[seed-alerts] profiles error:', e1.message)
    process.exit(1)
  }
  if (!prof?.id) {
    console.error('[seed-alerts] user not found for email:', USER_EMAIL)
    process.exit(1)
  }
  const userId = prof.id
  const combos = [
    { keyword: 'Obras', uf: 'SP' },
    { keyword: 'Serviços', uf: 'SP' },
    { keyword: 'Alimentos', uf: 'RJ' },
  ]
  // Ensure precise items in search_alerts (fonte principal do robô)
  for (const c of combos) {
    const { data: ex } = await supa.from('search_alerts').select('id').eq('user_id', userId).eq('keyword', c.keyword).eq('uf', c.uf).limit(1).maybeSingle()
    if (!ex) {
      const { error } = await supa.from('search_alerts').insert({ user_id: userId, keyword: c.keyword, uf: c.uf, active: true })
      if (error) console.error('[seed-alerts] insert search_alerts error:', error.message, c)
    } else {
      await supa.from('search_alerts').update({ active: true }).eq('id', ex.id)
    }
  }
  // Opcional: garantir fallback agregado em user_alerts (não é a fonte principal)
  const keywords = ['Obras', 'Serviços', 'Alimentos']
  const ufs = ['SP', 'RJ']
  const payload = { user_id: userId, keywords, ufs, ativo: true, push_notificacao: true }
  const { error: e2 } = await supa.from('user_alerts').upsert(payload, { onConflict: 'user_id' })
  if (e2) console.error('[seed-alerts] upsert user_alerts error:', e2.message)
  console.log(JSON.stringify({ ok: true, userId, seeded: combos.length }, null, 2))
}

main().catch((e) => {
  console.error('[seed-alerts] fatal:', e?.message || e)
  process.exit(1)
})

