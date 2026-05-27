import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'picsum.photos' },
      { protocol: 'https', hostname: 'i.ytimg.com' },
      { protocol: 'https', hostname: 'kpopofficial.com' },
      { protocol: 'https', hostname: 'lgewrmrbksgtjmzzebhz.supabase.co' },
    ],
  },
}

export default nextConfig
