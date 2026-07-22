import { PrismaClient, Prisma } from '@prisma/client'
import { AsyncLocalStorage } from 'async_hooks'

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined
}

const neonUrl = process.env.NEON_DATABASE_URL

const prismaClientOptions = neonUrl
  ? {
      datasources: {
        db: {
          url: neonUrl,
        },
      },
    }
  : undefined

// ----------------------------------------------------------------------------
// Cliente base: conecta como a role do DATABASE_URL (superuser + BYPASSRLS).
// Reaproveitado entre `prismaAdmin` (bypass) e `prisma` (tenant, via extensão).
// ----------------------------------------------------------------------------
const base = globalForPrisma.prismaBase ?? new PrismaClient(prismaClientOptions)
if (process.env.NODE_ENV !== 'production') globalForPrisma.prismaBase = base

// ----------------------------------------------------------------------------
// Contexto de tenant.
//
// O id do tenant atual é resolvido (nesta ordem):
//   1) override explícito via `runWithTenant()` (AsyncLocalStorage) — usado por
//      scripts, testes, jobs e qualquer caso fora de um request com sessão;
//   2) cookie de sessão NextAuth do request atual (decodificado com NEXTAUTH_SECRET).
//
// Quando nada resolve, retorna null → o cliente de tenant seta `app.current_user_id`
// como '' e o RLS bloqueia tudo (fail-closed).
// ----------------------------------------------------------------------------
type TenantStore = { userId: string | null }
const tenantALS = new AsyncLocalStorage<TenantStore>()

export function runWithTenant<T>(userId: string | null, fn: () => Promise<T>): Promise<T> {
  // Importante: aguardamos `fn()` DENTRO do escopo do ALS. Operações do Prisma são
  // PrismaPromises preguiçosas — só executam quando aguardadas. Se apenas
  // retornássemos `fn()`, a execução real (e a leitura do contexto via getStore())
  // aconteceria fora do escopo, resultando em tenant nulo (fail-closed indevido).
  return tenantALS.run({ userId }, async () => await fn())
}

async function resolveTenantUserId(): Promise<string | null> {
  const store = tenantALS.getStore()
  if (store) return store.userId // override explícito (pode ser null = fail-closed)

  // Fallback: deriva da sessão do request atual (route handler / server component).
  try {
    const { cookies } = await import('next/headers')
    const { decode } = await import('next-auth/jwt')
    const jar = await cookies()
    const raw =
      jar.get('__Secure-next-auth.session-token')?.value ??
      jar.get('next-auth.session-token')?.value ??
      null
    if (!raw) return null
    const secret = process.env.NEXTAUTH_SECRET || process.env.SESSION_SECRET
    if (!secret) return null
    const token = await decode({ token: raw, secret })
    return (token?.id as string) ?? (token?.sub as string) ?? null
  } catch {
    // Fora de um contexto de request (cookies() lança) → sem tenant.
    return null
  }
}

// ----------------------------------------------------------------------------
// Aplica role + GUC do tenant dentro de uma transação e executa `run`.
// `SET LOCAL` reverte ao fim da transação (seguro com pool de conexões).
// ----------------------------------------------------------------------------
async function setTenantOnTx(tx: Prisma.TransactionClient, userId: string | null) {
  await tx.$executeRaw`SELECT set_config('app.current_user_id', ${userId ?? ''}, true)`
  await tx.$executeRawUnsafe('SET LOCAL ROLE "app_rls"')
}

// ----------------------------------------------------------------------------
// `prismaAdmin`: BYPASS de RLS. Permanece como a role do DATABASE_URL (superuser),
// que ignora RLS. Use SOMENTE em fluxos sem tenant: autenticação, webhooks
// públicos, cron jobs, painel administrativo e atribuição de afiliados.
// ----------------------------------------------------------------------------
export const prismaAdmin = base

// ----------------------------------------------------------------------------
// `prisma`: cliente de TENANT com RLS ativo. Cada operação de modelo roda numa
// transação que troca para a role `app_rls` (NOBYPASSRLS) e injeta o
// `app.current_user_id` do request → o Postgres filtra por RLS automaticamente.
// ----------------------------------------------------------------------------
export const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ args, query }) {
        const userId = await resolveTenantUserId()
        const result = await base.$transaction([
          base.$executeRaw`SELECT set_config('app.current_user_id', ${userId ?? ''}, true)`,
          base.$executeRawUnsafe('SET LOCAL ROLE "app_rls"'),
          query(args),
        ])
        return (result as unknown[])[2]
      },
    },
  },
})

// ----------------------------------------------------------------------------
// `withTenantTx`: transação interativa com contexto de tenant aplicado. Use para
// agrupar múltiplas operações atomicamente sob RLS (substitui
// `prisma.$transaction([...])`, que não compõe com a extensão por-operação).
// ----------------------------------------------------------------------------
export async function withTenantTx<T>(
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  const userId = await resolveTenantUserId()
  return base.$transaction(async (tx) => {
    await setTenantOnTx(tx, userId)
    return fn(tx)
  })
}
