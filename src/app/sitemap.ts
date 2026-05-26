import type { MetadataRoute } from 'next'

const SITE_URL = 'https://kstage.vercel.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date()
  return ['', '/calendar', '/groups', '/login', '/signup'].map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified,
  }))
}
