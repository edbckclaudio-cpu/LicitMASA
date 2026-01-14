import { NextResponse } from 'next/server'

export async function GET() {
  const packageId = process.env.ANDROID_PACKAGE_ID || 'br.com.licitmasa'
  const fingerprintEnv = (process.env.ANDROID_SHA256_CERT || '').trim()
  const fallbackFingerprint = '0D:30:A6:64:2A:42:AB:79:95:A3:09:FE:15:F7:6B:E3:12:1E:31:34:DD:36:3D:B5:5B:29:08:56:68:C6:2B:F8'
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
