import { NextResponse } from 'next/server'

export async function GET() {
  const packageId = process.env.ANDROID_PACKAGE_ID || 'br.com.licitmasa'
  const fingerprintEnv = (process.env.ANDROID_SHA256_CERT || '').trim()
  const fallbackFingerprint = '4C:02:B2:67:A9:51:BA:4C:7E:90:43:5B:5B:EE:77:F5:29:CD:BF:BE:BE:D0:09:C6:2C:B5:82:4A:AE:21:44:F9'
  const fingerprint = fingerprintEnv || fallbackFingerprint
  return NextResponse.json([
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageId,
        sha256_cert_fingerprints: [fingerprint],
      },
    },
  ])
}

