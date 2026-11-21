import type { NextConfig } from 'next'

/** Headers for every response. The Content-Security-Policy is per request, with a nonce: proxy.ts sets it. */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]

const nextConfig: NextConfig = {
  // No `X-Powered-By: Next.js`.
  poweredByHeader: false,
  reactStrictMode: true,
  // Cache Components stays off: its prerendered shells can't carry the per-request CSP nonce (see AGENTS.md).
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [384, 640, 828, 1080, 1280, 1920],
  },
  experimental: {
    // Turbopack's dev file-system cache grows by gigabytes; keep it off.
    turbopackFileSystemCacheForDev: false,
    // two root layouts (app/[lang]): app/global-not-found.tsx renders a URL no route matches
    globalNotFound: true,
  },
  turbopack: {
    // this app has its own lockfile inside a larger repo
    root: __dirname,
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async headers() {
    return [
      { source: '/(.*)', headers: securityHeaders },
      // share images and videos, fleet pictures and icons change rarely; hashed build files are immutable already
      { source: '/(og|fleet|icons)/(.*)', headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }] },
    ]
  },
}

export default nextConfig
