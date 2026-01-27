import { NextResponse } from 'next/server'
export const dynamic = 'force-dynamic'

export async function GET() {
  const packageId = process.env.ANDROID_PACKAGE_ID || 'br.com.licitmasa'
  const fp1 = '0D:30:A6:64:2A:42:AB:79:95:A3:09:FE:15:F7:6B:E3:12:1E:31:34:DD:36:3D:B5:5B:29:08:56:68:C6:2B:F8'
  const fp2 = 'F3:F5:2B:B3:5D:87:D1:49:15:1B:32:0C:5E:26:A6:61:CB:59:75:5D:2C:19:64:9C:24:CE:0F:70:E1:DA:46:1D'
  const body = [
    {
      relation: ['delegate_permission/common.handle_all_urls'],
      target: {
        namespace: 'android_app',
        package_name: packageId,
        sha256_cert_fingerprints: [fp1, fp2],
      },
    },
  ]
  return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store, max-age=0' } })
}
