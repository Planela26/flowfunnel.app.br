/** @type {import('next').NextConfig} */
// Headers seguros em ambos ambientes (não dependem do host).
// HSTS e X-Frame-Options ficam no middleware.ts, gated por NODE_ENV === 'production'.
//   - HSTS em dev amarra o domínio *.replit.dev a HTTPS por 2 anos com preload;
//     isso quebra a limpeza de cookies via Ctrl+Shift+Del no Opera (cookies do
//     host prefixed com HSTS persistem).
//   - X-Frame-Options SAMEORIGIN em dev bloqueia o preview do Replit (que roda
//     em iframe cross-origin). Em dev, framing é controlado pelo CSP
//     frame-ancestors já presente em middleware.ts.
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
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
      // Impede que a CDN da Hostinger (hcdn/LiteSpeed) cache o HTML de qualquer
      // rota da aplicação. Next.js define s-maxage=31536000 para páginas estáticas
      // pré-renderizadas; sem este override a CDN serve o HTML por até 1 ano após
      // um deploy, ignorando novos builds (confirmado via x-nextjs-cache: HIT).
      // Arquivos de _next/static têm hash no nome e podem ser cacheados normalmente.
      {
        source: '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|webp|ico|svg|css|js|woff2?|ttf|eot)).*)',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'CDN-Cache-Control', value: 'no-store' },
          { key: 'Surrogate-Control', value: 'no-store' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
