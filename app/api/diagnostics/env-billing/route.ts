 import { NextResponse } from 'next/server'
 
 export async function GET() {
   try {
     const d = {
       GOOGLE_CLIENT_ID: !!(process.env.GOOGLE_CLIENT_ID || '').trim(),
       GOOGLE_CLIENT_SECRET: !!(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
       GOOGLE_REFRESH_TOKEN: !!(process.env.GOOGLE_REFRESH_TOKEN || '').trim(),
       NEXT_PUBLIC_PLAY_PRODUCT_ID: !!(process.env.NEXT_PUBLIC_PLAY_PRODUCT_ID || '').trim(),
       NEXT_PUBLIC_SITE_URL: !!(process.env.NEXT_PUBLIC_SITE_URL || '').trim(),
       ANDROID_PACKAGE_ID: !!(process.env.ANDROID_PACKAGE_ID || process.env.GOOGLE_PLAY_PACKAGE_NAME || 'br.com.licitmasa'),
     }
     return NextResponse.json({ ok: true, present: d })
   } catch (e: any) {
     return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
   }
 }
