
// Middleware atualizado para Next.js 14+
import { type NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { NextResponse } from 'next/server';

// Monta a Content-Security-Policy por requisição.
// - script-src usa 'self' 'unsafe-inline' https: — compatível com páginas
//   estáticas do Next (pré-renderadas no build, sem nonce no HTML). A abordagem
//   anterior com nonce + 'strict-dynamic' quebrava em produção: o middleware
//   gera um nonce novo por request, mas o HTML estático já foi gerado no build
//   sem nonce, então TODOS os scripts do Next eram bloqueados (sem hidratação).
// - em desenvolvimento liberamos 'unsafe-eval' e websockets para o HMR do Next,
//   e domínios do Replit em frame-ancestors para o preview em iframe.
function buildCsp(): string {
  const isDev = process.env.NODE_ENV !== 'production';

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    'https:',
    isDev ? "'unsafe-eval'" : '',
  ]
    .filter(Boolean)
    .join(' ');

  const connectSrc = [
    "'self'",
    'https://api.stripe.com',
    'https://*.stripe.com',
    'https://api.mercadopago.com',
    'https://*.mercadopago.com',
    'https://*.mercadolibre.com',
    'https://*.mlstatic.com',
    'https://connect.facebook.net',
    'https://*.facebook.com',
    'https://*.facebook.net',
    isDev ? 'ws:' : '',
    isDev ? 'wss:' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const frameAncestors = isDev
    ? "'self' https://*.replit.dev https://*.repl.co https://*.replit.app https://*.kirk.replit.dev https://*.picard.replit.dev"
    : "'self'";

  const directives = [
    "default-src 'self'",
    `script-src ${scriptSrc}`,
    // Estilos inline são usados por Tailwind/Recharts/Stripe — 'unsafe-inline'
    // é o padrão aceito aqui (nonce em <style> não é viável nesses casos).
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    // Stripe Checkout/Elements e 3DS rodam dentro de iframes do próprio Stripe.
    // Mercado Pago Payment Brick usa iframes (campos de cartão/3DS).
    "frame-src 'self' https://*.stripe.com https://*.mercadopago.com https://*.mercadolibre.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self' https://*.stripe.com",
    `frame-ancestors ${frameAncestors}`,
    'upgrade-insecure-requests',
  ];

  return directives.join('; ');
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // CSP por requisição (sem nonce: compatível com páginas estáticas do Next).
  const csp = buildCsp();

  const isProd = process.env.NODE_ENV === 'production';

  // Helper: aplica CSP + cabeçalhos de segurança a qualquer resposta.
  const requestId = request.headers.get('X-Request-ID') || crypto.randomUUID();

  const withCsp = (res: NextResponse): NextResponse => {
    res.headers.set('Content-Security-Policy', csp);
    // Correlation ID — propaga para logs e tracing end-to-end
    res.headers.set('X-Request-ID', requestId);
    // Cabeçalhos de segurança (defense-in-depth):
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), browsing-topics=()');
    res.headers.set('X-DNS-Prefetch-Control', 'off');
    // Em produção o app não é embedado em terceiros; em dev o preview do Replit
    // roda em iframe cross-origin, então framing é controlado só via CSP
    // frame-ancestors (X-Frame-Options SAMEORIGIN quebraria o preview em dev).
    if (isProd) {
      res.headers.set('X-Frame-Options', 'SAMEORIGIN');
      res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    }
    return res;
  };
  const next = () => withCsp(NextResponse.next());

  // Rotas públicas que não precisam de autenticação
  const publicRoutes = ['/', '/login', '/register', '/pricing', '/checkout', '/checkout/success', '/checkout/failure', '/checkout/pending', '/termos', '/privacidade', '/lgpd', '/verify-email', '/forgot-password', '/reset-password', '/activate-trial', '/invite', '/docs'];
  const publicApiRoutes = [
    '/api/auth',
    '/api/cron/snapshot',
    '/api/cron/alerts', // Bearer CRON_SECRET enforced in handler; machine-called by scheduler
    // External services (Meta, Hotmart, Monetizze, Eduzz, Kiwify) POST without credentials
    '/api/webhooks/whatsapp',
    '/api/webhooks/hotmart',
    '/api/webhooks/monetizze',
    '/api/webhooks/eduzz',
    '/api/webhooks/kiwify',
    '/api/webhooks/perfect-pay',
    '/api/webhooks/facebook',
    '/api/stripe/webhook',
    '/api/stripe/config', // Public: pricing page needs publishable key
    '/api/webhooks/mercadopago',
    '/api/mercadopago/create-preference',
    '/api/mercadopago/process-payment',
    '/api/mercadopago/public-key',
    '/api/mercadopago/payment-status',
    '/api/plan-prices',
    '/api/team/accept',
    '/api/team/viewer-stats',
    '/api/team/viewer-dashboard',
    // Public tracker endpoints (chamadas a partir das landing pages dos clientes)
    '/api/track/event',
    '/api/track/conversion',
    '/api/admin/seed-demo', // Bearer CRON_SECRET enforced in handler
    // /api/webhooks/logs is intentionally excluded — it requires auth
  ];

  const isPublicRoute = publicRoutes.some(
    r => pathname === r || pathname.startsWith(r + '/')
  );
  // Match the route exactly or as a path-segment prefix (route + "/..."), never
  // a substring prefix — so "/api/authXYZ" can't impersonate the public
  // "/api/auth" while tokenized subpaths like "/api/webhooks/kiwify/<token>"
  // and NextAuth subpaths like "/api/auth/session" still resolve as public.
  const isPublicApiRoute = publicApiRoutes.some(
    route => pathname === route || pathname.startsWith(route + '/')
  );

  if (isPublicRoute || isPublicApiRoute) {
    return next();
  }

  // Dev-only warmup bypass: allows server-side precompilation of all pages
  const warmupKey = request.headers.get('x-warmup-key');
  if (process.env.NODE_ENV === 'development' && warmupKey === 'ff-warmup-dev') {
    return next();
  }

  const token = await getToken({ req: request, secret: process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET });

  if (!token) {
    if (pathname.startsWith('/api/')) {
      return withCsp(NextResponse.json({ error: 'Não autorizado' }, { status: 401 }));
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return withCsp(NextResponse.redirect(loginUrl));
  }

  if (token && (pathname === '/login' || pathname === '/register')) {
    return withCsp(NextResponse.redirect(new URL('/dashboard', request.url)));
  }

  // Hard block: email verification required to access protected routes.
  // Users who register but haven't confirmed their email are redirected to /verify-email.
  // This does NOT block API routes (they return 401 from their own auth checks)
  // and does NOT block /activate-trial (user may be in the setup flow).
  if (!token.emailVerified && !pathname.startsWith('/api/')) {
    const allowedBeforeVerify = ['/verify-email', '/account', '/activate-trial']
    const isAllowed = allowedBeforeVerify.some(
      r => pathname === r || pathname.startsWith(r + '/')
    )
    if (!isAllowed) {
      // Remove o param interno _rsc e desabilita cache no redirect — sem isso,
      // redirecionar uma requisição RSC faz o navegador exibir o payload cru
      // (texto tipo ':HL[...]') em vez da página renderizada.
      const dest = new URL('/verify-email', request.url)
      dest.searchParams.delete('_rsc')
      const res = NextResponse.redirect(dest)
      res.headers.set('Cache-Control', 'no-store')
      return withCsp(res)
    }
  }

  // ── Modo somente leitura (sem bloqueio total) ────────────────────────────
  // Quando o plano vence (teste grátis expirado ou assinatura inativa), o
  // usuário NÃO é mais bloqueado nem redirecionado: continua vendo e navegando
  // por todos os dados já existentes. Um aviso discreto no topo (PlanExpiredBanner)
  // informa a situação, e a ENTRADA de novos dados é interrompida nas rotas de
  // ingestão (webhooks/tracker) via isIngestionBlockedForUser. Por isso o
  // middleware não faz mais redirect para /subscription-required.

  return next();
}

export const config = {
  matcher: [
    // Next.js 14+ recomenda usar "matcher" para definir as rotas que o middleware deve interceptar
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*|public).*)',
  ],
};
