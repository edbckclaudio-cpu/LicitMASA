import https from 'https'

const url = process.argv[2]
if (!url) {
  console.error('usage: node scripts/call-cron.mjs <url>')
  process.exit(1)
}
https.get(url, (res) => {
  let d = ''
  res.on('data', (c) => (d += c))
  res.on('end', () => {
    try {
      console.log(d)
    } catch {
      process.stdout.write(d)
    }
  })
}).on('error', (e) => {
  console.error('request error:', e.message)
  process.exit(2)
})

