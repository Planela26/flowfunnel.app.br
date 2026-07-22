async function warmupRoutes() {
  const routes = [
    '/dashboard', '/lead-journey', '/conversion-intelligence',
    '/analytics', '/reports', '/goals', '/whatsapp-numbers',
    '/campaigns', '/leads', '/webhooks', '/billing', '/affiliate', '/settings',
  ]
  const base = `http://localhost:${process.env.PORT || 5000}`
  console.log('🔥 FlowFunnel: pré-compilando páginas...')
  for (const route of routes) {
    try {
      await fetch(`${base}${route}`, {
        headers: { 'x-warmup-key': 'ff-warmup-dev' },
        signal: AbortSignal.timeout(8000),
      })
    } catch { /* ignore errors — page still gets compiled */ }
    await new Promise(r => setTimeout(r, 250))
  }
  console.log('✅ FlowFunnel: todas as páginas pré-compiladas')
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

    try {
      const databaseUrl = process.env.DATABASE_URL
      const stripeSecretKey = process.env.STRIPE_SECRET_KEY

      if (!databaseUrl || !stripeSecretKey) {
        console.warn('⚠️ DATABASE_URL ou STRIPE_SECRET_KEY não configurados, pulando inicialização do Stripe')
        return
      }

      const { runMigrations, StripeSync } = await import('stripe-replit-sync')
      await runMigrations({ databaseUrl })

      const stripeSync = new StripeSync({
        poolConfig: { connectionString: databaseUrl, max: 2 },
        stripeSecretKey,
      })

      const domain = process.env.REPLIT_DEV_DOMAIN
        || process.env.REPLIT_DOMAINS?.split(',')[0]

      if (domain) {
        const webhookUrl = `https://${domain}/api/stripe/webhook`
        await stripeSync.findOrCreateManagedWebhook(webhookUrl)
        console.log(`✅ Stripe webhook registrado: ${webhookUrl}`)
      }

      await stripeSync.syncBackfill()
      console.log('✅ Stripe inicializado com sucesso')
    } catch (error: any) {
      console.error('❌ Erro ao inicializar Stripe:', error.message)
    }
  }
}
