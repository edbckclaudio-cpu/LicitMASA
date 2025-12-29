import './globals.css'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import Script from 'next/script'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br'
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: 'LicitMASA — Licitações e Alertas',
  description:
    'Pesquise licitações no PNCP, salve favoritos e receba alertas personalizados. Painel Premium do LicitMASA.',
  keywords: [
    'licitações',
    'PNCP',
    'compras públicas',
    'alertas',
    'favoritos',
    'pregão',
    'LicitMASA'
  ],
  robots: {
    index: true,
    follow: true
  },
  alternates: {
    canonical: '/'
  },
  openGraph: {
    title: 'LicitMASA',
    description:
      'Pesquise licitações e receba alertas do Painel Premium LicitMASA.',
    url: siteUrl,
    siteName: 'LicitMASA',
    locale: 'pt_BR',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LicitMASA',
    description:
      'Pesquise licitações e receba alertas do Painel Premium LicitMASA.'
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-[#A7E8BD] antialiased">
        <Script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" strategy="beforeInteractive" />
        <Script id="onesignal-verifier" strategy="afterInteractive">{`window.verificarOneSignal = () => { try { alert('OneSignal no Window: ' + !!window.OneSignal) } catch (e) { alert('OneSignal no Window: false') } }`}</Script>
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}
