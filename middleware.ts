import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(_req: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!OneSignalSDKWorker\\.js|OneSignalSDKUpdaterWorker\\.js|sw\\.js|firebase-messaging-sw\\.js|robots\\.txt|favicon\\.ico|\\.well-known/assetlinks\\.json|_next/static|_next/image|icons/).*)',
  ],
}
