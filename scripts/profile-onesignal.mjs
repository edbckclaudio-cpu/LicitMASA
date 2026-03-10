import { createClient } from '@supabase/supabase-js'

const argv = process.argv.slice(2).reduce((acc, a) => {
  const m = a.match(/^--([^=]+)=(.*)$/)
  if (m) acc[m[1]] = m[2]
  return acc
}, {})

const SUPABASE_URL = argv.url || process.env.SUPABASE_URL || ''
const SERVICE_ROLE_KEY = argv.key || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const USER_EMAIL = argv.email || process.env.USER_EMAIL || ''
const SET_ID = argv.set || ''
const SET_SUB = argv.setsub || ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !USER_EMAIL) {
  console.error('[profile-onesignal] Missing --url, --key or --email')
  process.exit(1)
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function main() {
  let prof = null
  let error = null
  // Try a safe SELECT first
  {
    const r = await supa.from('profiles').select('*').eq('email', USER_EMAIL).limit(1).maybeSingle()
    prof = r.data
    error = r.error
  }
  if (error) {
    console.error('[profile-onesignal] profiles error:', error.message)
    process.exit(1)
  }
  if (!prof) {
    console.error('[profile-onesignal] user not found for email:', USER_EMAIL)
    process.exit(1)
  }
  const fields = Object.keys(prof || {})
  const candidateFields = ['onesignal_id', 'subscription_id', 'onesignalId', 'subscriptionId']
  const present = candidateFields.find((f) => fields.includes(f))
  console.log('[profile-onesignal] current:', {
    id: prof.id,
    email: prof.email,
    field: present || null,
    value: present ? prof[present] : null,
    availableFields: fields,
  })
  if (SET_ID) {
    if (!present) {
      console.error('[profile-onesignal] no known OneSignal field found in profiles')
      process.exit(1)
    }
    const payload = { [present]: SET_ID }
    const { error: uerr } = await supa.from('profiles').update(payload).eq('id', prof.id)
    if (uerr) {
      console.error('[profile-onesignal] update error:', uerr.message)
      process.exit(1)
    }
    console.log('[profile-onesignal] updated', present, 'to:', SET_ID)
  }
  if (SET_SUB) {
    const { error: subErr } = await supa.from('profiles').update({ subscription_id: SET_SUB }).eq('id', prof.id)
    if (subErr) {
      console.error('[profile-onesignal] update subscription_id error:', subErr.message)
      process.exit(1)
    }
    console.log('[profile-onesignal] updated subscription_id to:', SET_SUB)
  }
}

main().catch((e) => {
  console.error('[profile-onesignal] fatal:', e?.message || e)
  process.exit(1)
})
