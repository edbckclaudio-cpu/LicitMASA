import type { MetadataRoute } from 'next'
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://licitmasa.com.br'
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  return [
    {
      url: `${siteUrl}/`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1
    },
    {
      url: `${siteUrl}/login`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.6
    },
    {
      url: `${siteUrl}/perfil`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8
    },
    {
      url: `${siteUrl}/perfil/alertas`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.8
    },
    {
      url: `${siteUrl}/favoritos`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7
    },
    {
      url: `${siteUrl}/preparacao`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7
    }
  ]
}
