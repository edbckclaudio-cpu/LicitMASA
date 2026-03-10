import https from 'https'

function parseArgs() {
  const out = {}
  for (const a of process.argv.slice(2)) {
    const m = a.match(/^--([^=]+)=(.*)$/)
    if (m) out[m[1]] = m[2]
  }
  return out
}

const args = parseArgs()
const ref = args.ref || ''
const key = args.key || ''
const sub = args.sub || ''
const test = args.test || '1'
if (!ref || !key) {
  console.error('usage: node scripts/call-check-alerts.mjs --ref=<project_ref> --key=<service_role_key> [--sub=<subscription_id>] [--test=1]')
  process.exit(1)
}

const qs = []
if (test) qs.push(`test=${encodeURIComponent(test)}`)
if (sub) qs.push(`sub=${encodeURIComponent(sub)}`)
const path = `/check-alerts${qs.length ? `?${qs.join('&')}` : ''}`
const options = {
  hostname: `${ref}.functions.supabase.co`,
  path,
  method: 'GET',
  headers: { 'Authorization': `Bearer ${key}` }
}

const req = https.request(options, (res) => {
  let data = ''
  res.on('data', (c) => (data += c))
  res.on('end', () => {
    try {
      console.log(data)
    } catch {
      process.stdout.write(data)
    }
  })
})
req.on('error', (e) => {
  console.error('request error:', e.message)
  process.exit(2)
})
req.end()

