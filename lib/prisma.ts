import { PrismaClient, Prisma } from '@prisma/client'
import { AsyncLocalStorage } from 'async_hooks'

const globalForPrisma = globalThis as unknown as {
  prismaBase: PrismaClient | undefined
}

// Supabase Transaction Pooler (port 6543) requer pgbouncer=true para que o Prisma
// desabilite prepared statements — sem isso ocorre 42P05 "prepared statement already exists"
// porque o pooler pode redirecionar queries para conexões de servidor diferentes.
function buildPoolerUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  if (raw.includes('pgbouncer=true')) return raw
  return raw.includes('?') ? `${raw}&pgbouncer=true` : `${raw}?pgbouncer=true`
}

const supabasePoolerUrl = buildPoolerUrl(process.env.SUPABASE_DATABASE_URL)

/**
 * Limita o pool de conexões explicitamente.
 *
 * Sem `connection_limit`, o Prisma usa `núcleos × 2 + 1` — num VPS de 8 núcleos
 * são 17 conexões, e o app é UM processo entre outros que também falam com o
 * mesmo Postgres. O pooler do Supabase tem um teto de slots bem menor do que a
 * soma disso.
 *
 * Agrava o quadro o desenho do cliente de tenant logo abaixo: CADA operação de
 * modelo abre uma transação de três comandos, segurando uma conexão do começo
 * ao fim. Uma tela como o dashboard dispara mais de dez buscas em paralelo, e
 * cada uma faz várias consultas — dezenas de transações concorrentes.
 *
 * Estourado o teto, o erro que chega é "Can't reach database server", que
 * parece queda do banco e não é: é falta de slot. Some sozinho quando o
 * tráfego alivia, e por isso o sintoma aparece como "às vezes funciona, às
 * vezes não".
 *
 * Com o teto explícito, a requisição ESPERA por um slot (até `pool_timeout`)
 * em vez de falhar. Ajustável por ambiente sem mexer no código.
 */
function comLimiteDePool(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const u = new URL(raw)
    if (!u.searchParams.has('connection_limit')) {
      u.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT ?? '10')
    }
    if (!u.searchParams.has('pool_timeout')) {
      u.searchParams.set('pool_timeout', process.env.DB_POOL_TIMEOUT ?? '20')
    }
    return u.toString()
  } catch {
    // URL malformada: melhor deixar o Prisma reclamar do original do que
    // devolver algo remendado.
    return raw
  }
}

const urlComPool = comLimiteDePool(supabasePoolerUrl ?? process.env.DATABASE_URL)

const prismaClientOptions = urlComPool
  ? {
      datasources: {
        db: {
          url: urlComPool,
        },
      },
    }
  : undefined

/**
 * Erros que significam "a operação NEM COMEÇOU" — falha ao obter conexão ou ao
 * alcançar o servidor. Repetir é seguro: nada foi aplicado.
 *
 * Deliberadamente NÃO inclui erro no meio da transação, onde repetir poderia
 * aplicar duas vezes.
 *
 *   P1001 servidor inalcançável   P1002 timeout de conexão
 *   P1008 timeout de operação     P1017 servidor fechou a conexão
 *   P2024 timeout esperando slot no pool
 */
const ERROS_DE_CONEXAO = new Set(['P1001', 'P1002', 'P1008', 'P1017', 'P2024'])

/**
 * Contadores de contenção, expostos em /api/version.
 *
 * Existem porque a pergunta "o limite de pool resolveu?" não tem resposta
 * olhando a tela: quando funciona, funciona — e antes também funcionava, às
 * vezes. Sem medir, a única verificação possível é usar o sistema e torcer.
 *
 * Com isto, depois do deploy a resposta é um número:
 *   `retentativas` > 0  → houve disputa por conexão e a retentativa segurou;
 *                         o diagnóstico estava certo.
 *   `desistencias` > 0  → a disputa passou do que 3 tentativas resolvem;
 *                         subir DB_CONNECTION_LIMIT ou migrar para o pooler
 *                         de transação (porta 6543).
 *   tudo em 0 e a tela estável → o teto resolveu antes de virar erro.
 *
 * São contagens de processo, sem nada de usuário. Zeram a cada restart.
 */
const conexao = { retentativas: 0, recuperadas: 0, desistencias: 0, ultimoCodigo: null as string | null }

export function estatisticasDeConexao() {
  return { ...conexao }
}

async function comRetentativa<T>(fn: () => Promise<T>, tentativas = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      const r = await fn()
      if (i > 0) conexao.recuperadas++
      return r
    } catch (e: any) {
      const codigo = e?.code ?? null
      const transitorio =
        ERROS_DE_CONEXAO.has(codigo) ||
        /Can't reach database server|Timed out fetching a new connection/i.test(String(e?.message ?? ''))
      if (!transitorio) throw e
      conexao.ultimoCodigo = codigo
      if (i >= tentativas - 1) {
        conexao.desistencias++
        console.error(`[prisma] desisti após ${tentativas} tentativas (${codigo ?? 'sem código'})`)
        throw e
      }
      conexao.retentativas++
      console.warn(`[prisma] conexão indisponível (${codigo ?? 'sem código'}), tentativa ${i + 2}/${tentativas}`)
      // 100ms, 200ms — curto o bastante para caber num request, longo o
      // bastante para o slot ser devolvido por quem estava na frente.
      await new Promise(r => setTimeout(r, 100 * 2 ** i))
    }
  }
}

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
        // A retentativa cobre só falha de CONEXÃO — ver ERROS_DE_CONEXAO. Sem
        // ela, um pico de concorrência derruba a consulta, o chamador cai no
        // `.catch(() => [])` e a tela conclui "não há dados" quando o que
        // faltou foi um slot no pool.
        // Preparo em UM comando, não dois.
        //
        // Cada ida ao banco custa a latência da rede, e o Postgres fica em
        // outra região: uma consulta simples leva ~330ms, mas embrulhada em
        // três comandos passava de 1100ms. Tudo no produto paga esse pedágio,
        // porque toda leitura de tenant passa por aqui.
        //
        // `set_config('role', 'app_rls', true)` é equivalente a
        // `SET LOCAL ROLE "app_rls"` — o GUC `role` é o que define o papel
        // corrente, e `is_local = true` limita o efeito à transação. Verificado
        // com duas contas: o papel efetivo continua `app_rls` e cada uma
        // enxerga só os próprios registros. Medido: 786ms → 633ms por consulta.
        const result = await comRetentativa(() =>
          base.$transaction([
            base.$executeRaw`SELECT set_config('app.current_user_id', ${userId ?? ''}, true), set_config('role', 'app_rls', true)`,
            query(args),
          ]),
        )
        return (result as unknown[])[1]
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
  return comRetentativa(() =>
    base.$transaction(async (tx) => {
      await setTenantOnTx(tx, userId)
      return fn(tx)
    }),
  )
}
