 import { NextResponse } from 'next/server'
 
 /**
  * Diagnostico rapido das variaveis de ambiente do fluxo de billing.
  *
  * A rota nao expõe segredos; ela informa apenas presenca/ausencia das chaves
  * e devolve os identificadores publicos necessarios para validar configuracao.
  *
  * @returns Snapshot seguro da configuracao de Google Play e site.
  */
 export async function GET() {
   try {
    const productId = String(process.env.NEXT_PUBLIC_PLAY_PRODUCT_ID || '').trim()
    const packageName = String(process.env.ANDROID_PACKAGE_ID || process.env.GOOGLE_PLAY_PACKAGE_NAME || 'br.com.licitmasa').trim()
     const d = {
       GOOGLE_CLIENT_ID: !!(process.env.GOOGLE_CLIENT_ID || '').trim(),
       GOOGLE_CLIENT_SECRET: !!(process.env.GOOGLE_CLIENT_SECRET || '').trim(),
       GOOGLE_REFRESH_TOKEN: !!(process.env.GOOGLE_REFRESH_TOKEN || '').trim(),
      NEXT_PUBLIC_PLAY_PRODUCT_ID: !!productId,
       NEXT_PUBLIC_SITE_URL: !!(process.env.NEXT_PUBLIC_SITE_URL || '').trim(),
      ANDROID_PACKAGE_ID: !!packageName,
      GOOGLE_SERVICE_ACCOUNT_JSON: !!(process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '').trim(),
      GOOGLE_APPLICATION_CREDENTIALS: !!(process.env.GOOGLE_APPLICATION_CREDENTIALS || '').trim(),
     }
    return NextResponse.json({ ok: true, present: d, values: { productId, packageName } })
   } catch (e: any) {
     return NextResponse.json({ ok: false, error: e?.message || 'UNKNOWN' }, { status: 500 })
   }
 }
