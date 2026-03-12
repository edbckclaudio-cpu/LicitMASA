import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'

export function middleware(req: NextRequest) {
  try {
    const host = req.nextUrl.hostname.toLowerCase()
    const isProd = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production'
    if (isProd && host === 'licitmasa.com.br') {
      const url = req.nextUrl.clone()
      url.hostname = 'www.licitmasa.com.br'
      url.protocol = 'https:'
      return NextResponse.redirect(url, 308)
    }
  } catch {}
  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!OneSignalSDKWorker\\.js|OneSignalSDKUpdaterWorker\\.js|\\.well-known/assetlinks\\.json|manifest\\.json|_next/static|_next/image|favicon\\.ico|robots\\.txt).*)',
  ],
}
