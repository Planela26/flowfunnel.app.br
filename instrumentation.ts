async function warmupRoutes() {
  const routes = [
    '/dashboard', '/lead-journey', '/conversion-intelligence',
    '/analytics', '/reports', '/goals', '/whatsapp-numbers',
    '/campaigns', '/leads', '/webhooks', '/billing', '/affiliate', '/settings',
  ]
  const base = `http://localhost:${process.env.PORT || 5000}`
  console.log('🔥 FlowSara: pré-compilando páginas...')
  for (const route of routes) {
    try {
      await fetch(`${base}${route}`, {
        headers: { 'x-warmup-key': 'ff-warmup-dev' },
        signal: AbortSignal.timeout(8000),
      })
    } catch { /* ignore errors — page still gets compiled */ }
    await new Promise(r => setTimeout(r, 250))
  }
  console.log('✅ FlowSara: todas as páginas pré-compiladas')
}

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    // Em dev no Replit, garante que NEXTAUTH_URL aponte para o domínio público
    // do preview (e não localhost), senão o cookie/CSRF do NextAuth quebra o login.
    if (process.env.NODE_ENV !== 'production' && process.env.REPLIT_DEV_DOMAIN) {
      process.env.NEXTAUTH_URL = `https://${process.env.REPLIT_DEV_DOMAIN}`
    }

    // Pre-compile all pages in dev so navigation is instant
    if (process.env.NODE_ENV === 'development') {
      setTimeout(warmupRoutes, 4000)
    }

    // Aqui existia a auto-inicialização do Stripe via `stripe-replit-sync`,
    // herdada de quando o projeto rodava no Replit. Removida porque não podia
    // funcionar e podia atrapalhar:
    //
    //   Em produção ela já se desligava sozinha logo na entrada — o próprio
    //   comentário do bloco explicava que as migrations do pacote usam prepared
    //   statements que quebram contra o Connection Pooler e "podem derrubar o
    //   processo". Os webhooks do Stripe nunca dependeram dela: quem os trata é
    //   /api/stripe/webhook.
    //
    //   Em desenvolvimento ela rodava `runMigrations()` de um pacote de
    //   terceiros CONTRA O DATABASE_URL a cada `next dev`, e depois um
    //   `syncBackfill()` puxando a base do Stripe para dentro dele. O registro
    //   do webhook, único efeito visível, dependia de REPLIT_DEV_DOMAIN ou
    //   REPLIT_DOMAINS — variáveis que deixaram de existir quando o projeto saiu
    //   do Replit. Então o que sobrava era só o risco.
    //
    //   De quebra, era o único uso de `stripe-replit-sync`, que arrastava
    //   `pg-node-migrations` com `require` dinâmico e produzia o aviso "Critical
    //   dependency: the request of a dependency is an expression" em todo build.
  }
}
