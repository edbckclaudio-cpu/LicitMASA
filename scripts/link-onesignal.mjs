import { createClient } from '@supabase/supabase-js'
import https from 'https'

const argv = process.argv.slice(2).reduce((acc, a) => {
  const m = a.match(/^--([^=]+)=(.*)$/)
  if (m) acc[m[1]] = m[2]
  return acc
}, {})

const SUPABASE_URL = argv.url || process.env.SUPABASE_URL || ''
const SERVICE_ROLE_KEY = argv.key || process.env.SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
const USER_EMAIL = argv.email || process.env.USER_EMAIL || ''
const APP_ID = argv.app || process.env.ONESIGNAL_APP_ID || ''
const API_KEY = argv.apikey || process.env.ONESIGNAL_API_KEY || process.env.ONESIGNAL_REST_API_KEY || ''
const SUB_ID = argv.sub || process.env.SUB_ID || ''
const EXTERNAL_ID = argv.external || process.env.EXTERNAL_ID || ''

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !USER_EMAIL || !APP_ID || !API_KEY || !SUB_ID) {
  console.error('[link-onesignal] Missing required args: --url --key --email --app --apikey --sub')
  process.exit(1)
}

const supa = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

function onesignalUpdateSubscription({ appId, apiKey, subId, externalId }) {
  return new Promise((resolve, reject) => {
    const path = `/apps/${appId}/subscriptions/${encodeURIComponent(subId)}`
    const body = JSON.stringify({ external_id: externalId })
    const req = https.request(
      {
        hostname: 'api.onesignal.com',
        path,
        method: 'PATCH',
        headers: {
          'Authorization': `Basic ${apiKey}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          const ok = res.statusCode && res.statusCode >= 200 && res.statusCode < 300
          resolve({ ok, status: res.statusCode, body: data })
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

async function main() {
  let externalId = EXTERNAL_ID
  if (!externalId) {
    const { data: prof, error } = await supa.from('profiles').select('id,email').eq('email', USER_EMAIL).limit(1).maybeSingle()
    if (error || !prof?.id) {
      console.error('[link-onesignal] user not found or error:', error?.message || 'not found')
      process.exit(1)
    }
    externalId = prof.id
  }
  console.log('[link-onesignal] linking sub to externalId:', { externalId, email: USER_EMAIL })
  const upd = await onesignalUpdateSubscription({ appId: APP_ID, apiKey: API_KEY, subId: SUB_ID, externalId })
  console.log('[link-onesignal] update result:', upd)
  if (!upd.ok) process.exit(2)
  console.log(JSON.stringify({ ok: true }, null, 2))
}

main().catch((e) => {
  console.error('[link-onesignal] fatal:', e?.message || e)
  process.exit(1)
})
