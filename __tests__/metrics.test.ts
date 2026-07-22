import { calculateROI, calculateCTR, calculateCPC, calculateCPM, calculateConversion, distributeByClicks, hasROI, calculateROAS, auditConsistency } from '../lib/metrics'

function expectEq(actual: unknown, expected: unknown, msg: string) {
  if (actual !== expected && !(Number.isNaN(actual) && Number.isNaN(expected))) {
    throw new Error(`${msg} — esperado ${String(expected)}, recebido ${String(actual)}`)
  }
}

const tests: Array<[string, () => void]> = [
  ['ROI: receita 200 / custo 100 → 100%', () => expectEq(calculateROI(200, 100), 100, 'ROI 100%')],
  ['ROI: receita 100 / custo 100 → 0%',  () => expectEq(calculateROI(100, 100), 0, 'ROI 0%')],
  ['ROI: receita 50 / custo 100 → -50%', () => expectEq(calculateROI(50, 100), -50, 'ROI -50%')],
  ['ROI: custo 0 → 0',                   () => expectEq(calculateROI(500, 0), 0, 'ROI custo zero')],
  ['ROI: receita 0 / custo 100 → -100%', () => expectEq(calculateROI(0, 100), -100, 'ROI -100%')],
  ['ROI: NaN seguro',                    () => expectEq(calculateROI(NaN, 100), 0, 'ROI NaN')],
  ['hasROI: custo 0 → false',            () => expectEq(hasROI(100, 0), false, 'hasROI 0')],
  ['hasROI: custo > 0 → true',           () => expectEq(hasROI(0, 100), true, 'hasROI ok')],
  ['CTR: 100/1000 → 10%',                () => expectEq(calculateCTR(100, 1000), 10, 'CTR 10%')],
  ['CTR: 0 impressões → null',           () => expectEq(calculateCTR(10, 0), null, 'CTR div0')],
  ['CPC: 100/50 → 2',                    () => expectEq(calculateCPC(100, 50), 2, 'CPC 2')],
  ['CPC: 0 cliques → null',              () => expectEq(calculateCPC(100, 0), null, 'CPC div0')],
  ['CPM: 50/1000*1000 → 50',             () => expectEq(calculateCPM(50, 1000), 50, 'CPM 50')],
  ['Conversion: 10/100 → 10%',           () => expectEq(calculateConversion(10, 100), 10, 'Conv 10%')],
  ['distributeByClicks soma == total', () => {
    const sources = [{ cliques: 100 }, { cliques: 200 }, { cliques: 300 }]
    const dist = distributeByClicks(sources, 600)
    const sum = dist.reduce((a, b) => a + b, 0)
    expectEq(sum, 600, 'distribuição soma exata')
  }],
  ['distributeByClicks total 0 → tudo zero', () => {
    const dist = distributeByClicks([{ cliques: 1 }, { cliques: 2 }], 0)
    expectEq(dist.every(v => v === 0), true, 'tudo zero')
  }],
  ['ROAS: 200/100 → 2',                  () => expectEq(calculateROAS(200, 100), 2, 'ROAS 2')],
  ['ROAS: custo 0 → 0',                  () => expectEq(calculateROAS(500, 0), 0, 'ROAS custo zero')],
  ['Auditoria: total bate com fontes', () => {
    const issues = auditConsistency(
      { clicks: 300, spend: 150 },
      [{ clicks: 100, spend: 50 }, { clicks: 200, spend: 100 }],
    )
    expectEq(issues.length, 0, 'sem inconsistência')
  }],
  ['Auditoria: detecta divergência', () => {
    const issues = auditConsistency(
      { clicks: 500 },
      [{ clicks: 100 }, { clicks: 200 }],
    )
    expectEq(issues.length > 0, true, 'detectou divergência')
  }],
]

let pass = 0, fail = 0
for (const [name, fn] of tests) {
  try { fn(); console.log('✓', name); pass++ } catch (e) { console.error('✗', name, '—', (e as Error).message); fail++ }
}
console.log(`\n${pass}/${tests.length} OK${fail ? `, ${fail} FALHAS` : ''}`)
if (fail) process.exit(1)
