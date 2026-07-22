/**
 * Testes de RLS (Row-Level Security).
 *
 * Roda com: `npx tsx __tests__/rls.test.ts`
 *
 * Cobre:
 *   1. acesso do próprio tenant (vê os próprios dados);
 *   2. tentativa de acesso cruzado (NÃO vê dados de outro tenant);
 *   3. ausência de contexto (fail-closed: 0 linhas e write rejeitado);
 *   4. acesso administrativo autorizado (prismaAdmin/bypass vê tudo).
 *
 * Usa o banco real de desenvolvimento. Cria dois usuários descartáveis e limpa
 * tudo via prismaAdmin no final.
 */
import { prisma, prismaAdmin, runWithTenant } from '../lib/prisma'

let passed = 0
let failed = 0

function check(name: string, cond: boolean) {
  if (cond) {
    passed++
    console.log(`  ✓ ${name}`)
  } else {
    failed++
    console.error(`  ✗ ${name}`)
  }
}

async function expectThrows(name: string, fn: () => Promise<unknown>) {
  try {
    await fn()
    failed++
    console.error(`  ✗ ${name} (esperava erro, mas não lançou)`)
  } catch {
    passed++
    console.log(`  ✓ ${name}`)
  }
}

async function main() {
  const suffix = Date.now()
  const emailA = `rls-a-${suffix}@test.local`
  const emailB = `rls-b-${suffix}@test.local`

  // --- setup via bypass (sem RLS) ---
  const userA = await prismaAdmin.user.create({ data: { email: emailA, name: 'RLS A' } })
  const userB = await prismaAdmin.user.create({ data: { email: emailB, name: 'RLS B' } })

  try {
    // === 1) Acesso do próprio tenant ======================================
    console.log('\n[1] Próprio tenant')
    const funnelA = await runWithTenant(userA.id, () =>
      prisma.funnel.create({
        data: { userId: userA.id, name: 'Funnel A', startDate: new Date() },
      }),
    )
    const funnelB = await runWithTenant(userB.id, () =>
      prisma.funnel.create({
        data: { userId: userB.id, name: 'Funnel B', startDate: new Date() },
      }),
    )
    check('tenant A cria e vê o próprio funil', !!funnelA?.id)

    const aSeesOwn = await runWithTenant(userA.id, () => prisma.funnel.findMany())
    check('tenant A lista apenas o próprio funil', aSeesOwn.length === 1 && aSeesOwn[0].id === funnelA.id)

    // Tabela filha (FunnelEvent/FunnelStage) via política por EXISTS no pai.
    const stageA = await runWithTenant(userA.id, () =>
      prisma.funnelStage.create({ data: { funnelId: funnelA.id, name: 'Etapa', order: 1 } }),
    )
    check('tenant A cria estágio no próprio funil (RLS via pai)', !!stageA?.id)

    // === 2) Acesso cruzado negado =========================================
    console.log('\n[2] Acesso cruzado negado')
    const bSeesA = await runWithTenant(userB.id, () =>
      prisma.funnel.findUnique({ where: { id: funnelA.id } }),
    )
    check('tenant B NÃO vê funil de A (findUnique → null)', bSeesA === null)

    const bListExcludesA = await runWithTenant(userB.id, () => prisma.funnel.findMany())
    check(
      'tenant B lista só os próprios (não inclui o de A)',
      bListExcludesA.every((f) => f.id !== funnelA.id),
    )

    const crossUpdate = await runWithTenant(userB.id, () =>
      prisma.funnel.updateMany({ where: { id: funnelA.id }, data: { name: 'hackeado' } }),
    )
    check('tenant B NÃO consegue atualizar funil de A (count=0)', crossUpdate.count === 0)

    const crossDelete = await runWithTenant(userB.id, () =>
      prisma.funnel.deleteMany({ where: { id: funnelA.id } }),
    )
    check('tenant B NÃO consegue deletar funil de A (count=0)', crossDelete.count === 0)

    // WITH CHECK: B não pode criar linha com userId de A.
    await expectThrows('tenant B NÃO cria funil em nome de A (WITH CHECK)', () =>
      runWithTenant(userB.id, () =>
        prisma.funnel.create({
          data: { userId: userA.id, name: 'forjado', startDate: new Date() },
        }),
      ),
    )

    // === 3) Ausência de contexto (fail-closed) ============================
    console.log('\n[3] Sem contexto de tenant (fail-closed)')
    const noCtxList = await runWithTenant(null, () => prisma.funnel.findMany())
    check('sem contexto → nenhuma linha visível', noCtxList.length === 0)

    await expectThrows('sem contexto → INSERT rejeitado (WITH CHECK)', () =>
      runWithTenant(null, () =>
        prisma.funnel.create({
          data: { userId: userA.id, name: 'sem ctx', startDate: new Date() },
        }),
      ),
    )

    // === 3b) RLS na tabela User (self-only) ===============================
    console.log('\n[3b] Tabela User (self-only)')
    const aSeesSelf = await runWithTenant(userA.id, () =>
      prisma.user.findUnique({ where: { id: userA.id } }),
    )
    check('tenant A vê o próprio User', aSeesSelf?.id === userA.id)

    const aSeesB = await runWithTenant(userA.id, () =>
      prisma.user.findUnique({ where: { id: userB.id } }),
    )
    check('tenant A NÃO vê o User de B (findUnique → null)', aSeesB === null)

    const crossUserUpdate = await runWithTenant(userB.id, () =>
      prisma.user.updateMany({ where: { id: userA.id }, data: { name: 'invadido' } }),
    )
    check('tenant B NÃO atualiza o User de A (count=0)', crossUserUpdate.count === 0)

    const noCtxUser = await runWithTenant(null, () => prisma.user.findMany())
    check('sem contexto → nenhum User visível', noCtxUser.length === 0)

    // === 4) Acesso administrativo (bypass) ================================
    console.log('\n[4] Admin / bypass')
    const adminSeesA = await prismaAdmin.funnel.findUnique({ where: { id: funnelA.id } })
    const adminSeesB = await prismaAdmin.funnel.findUnique({ where: { id: funnelB.id } })
    check('prismaAdmin vê funil de A', adminSeesA?.id === funnelA.id)
    check('prismaAdmin vê funil de B', adminSeesB?.id === funnelB.id)
    check('funil de A intacto (não foi hackeado por B)', adminSeesA?.name === 'Funnel A')
  } finally {
    // --- limpeza via bypass ---
    await prismaAdmin.user.deleteMany({ where: { id: { in: [userA.id, userB.id] } } })
    await prismaAdmin.$disconnect()
  }

  console.log(`\n=== RLS: ${passed} passou, ${failed} falhou ===`)
  if (failed > 0) process.exit(1)
}

main().catch((e) => {
  console.error('Erro fatal nos testes RLS:', e)
  process.exit(1)
})
