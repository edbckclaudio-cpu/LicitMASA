export const dynamic = 'force-static'
export async function GET() {
  const script = "importScripts('https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js');"
  return new Response(script, {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
    },
  })
}
