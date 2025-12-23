import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'LicitMASA',
    short_name: 'LicitMASA',
    description: 'Pesquise licitações no PNCP, salve favoritos e receba alertas.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    theme_color: '#0b5bd7',
    background_color: '#ffffff',
    lang: 'pt-BR',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }
    ]
  }
}
