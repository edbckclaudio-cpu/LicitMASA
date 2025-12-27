import './globals.css'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import ServiceWorkerRegister from '@/components/ServiceWorkerRegister'
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://licitmasa.com.br'
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
      <body className="min-h-screen bg-slate-50 antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
    </html>
  )
}
