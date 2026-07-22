/** @type {import('next').NextConfig} */
const SECURITY_HEADERS = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
]

const nextConfig = {
  reactStrictMode: false,
  devIndicators: {
    buildActivity: false,
    appIsrStatus: false,
  },
  // Allowed dev origins for Replit; harmless on production, but Hostinger production
  // should rely on NEXTAUTH_URL / canonical host instead.
  allowedDevOrigins: ['*.replit.dev', '*.kirk.replit.dev', '*.picard.replit.dev'],
  serverExternalPackages: ['@whiskeysockets/baileys', '@hapi/boom', 'pino'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
      {
        protocol: 'https',
        hostname: 'api.qrserver.com',
      },
    ],
  },
  // Trust the Hostinger proxy so req.headers['x-forwarded-proto'] is respected.
  // Remove this if Hostinger handles HTTPS termination differently.
  skipTrailingSlashRedirect: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: SECURITY_HEADERS,
      },
    ]
  },
}

module.exports = nextConfig
