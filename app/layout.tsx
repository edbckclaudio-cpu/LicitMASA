import './globals.css'
import type { ReactNode } from 'react'
import type { Metadata } from 'next'
import AppShell from '@/components/AppShell'
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.licitmasa.com.br'
export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  manifest: '/manifest.webmanifest',
  title: 'LicitMASA — Publicações e Alertas',
  description:
    'Pesquise publicações no PNCP, salve favoritos e receba alertas personalizados. Painel Premium do LicitMASA.',
  keywords: [
    'publicações',
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
      'Pesquise publicações e receba alertas do Painel Premium LicitMASA.',
    url: siteUrl,
    siteName: 'LicitMASA',
    locale: 'pt_BR',
    type: 'website'
  },
  twitter: {
    card: 'summary_large_image',
    title: 'LicitMASA',
    description:
      'Pesquise publicações e receba alertas do Painel Premium LicitMASA.'
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning={true}>
      <body className="min-h-screen bg-[#A7E8BD] antialiased" suppressHydrationWarning={true}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
