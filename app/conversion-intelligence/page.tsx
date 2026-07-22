'use client'

import { useEffect, useState } from 'react'
import LeadIntelligence from '@/components/LeadIntelligence'
import WastedTrafficCard from '@/components/WastedTrafficCard'
import PlanGate from '@/components/PlanGate'
import { usePlan } from '@/components/usePlan'

export default function ConversionIntelligencePage() {
  const { info: planInfo } = usePlan()
  const canScoreLeads = planInfo.features.lead_scoring
  const canSeeWastedTraffic = planInfo.features.wasted_traffic

  const [whatsappData, setWhatsappData] = useState<any>(null)
  const [facebookData, setFacebookData] = useState<any>(null)
  const [hotmartData, setHotmartData] = useState<any>(null)

  useEffect(() => {
    fetch('/api/whatsapp/metrics')
      .then(r => (r.ok ? r.json() : null))
      .then(setWhatsappData)
      .catch(() => setWhatsappData(null))

    fetch('/api/facebook/metrics?period=last_30d')
      .then(r => (r.ok ? r.json() : null))
      .then(setFacebookData)
      .catch(() => setFacebookData(null))

    fetch('/api/hotmart/metrics')
      .then(r => (r.ok ? r.json() : null))
      .then(setHotmartData)
      .catch(() => setHotmartData(null))
  }, [])

  return (
    <main className="container mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            🎯 Inteligência de Conversão
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Score de leads e desperdício de tráfego em um só lugar.
          </p>
        </div>
        {!canScoreLeads && (
          <span className="hidden sm:inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300 text-xs font-bold">
            🔒 Recursos PRO
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PlanGate
          unlocked={canScoreLeads}
          title="Descubra quais leads realmente convertem"
          message="Score automático de 0–100 e classificação quente / morno / frio para cada lead que chega."
          ctaLabel="Desbloquear Leads PRO"
        >
          <LeadIntelligence unlocked={canScoreLeads} />
        </PlanGate>

        <PlanGate
          unlocked={canSeeWastedTraffic}
          title="Você pode estar perdendo dinheiro"
          message="Veja quanto do seu investimento em tráfego está sendo desperdiçado e receba sugestões práticas: pause campanha X, invista em Y."
          ctaLabel="Ver desperdício (PRO)"
        >
          <WastedTrafficCard
            unlocked={canSeeWastedTraffic}
            data={{
              spend: facebookData?.raw?.spend,
              clicks: facebookData?.raw?.clicks,
              leads: whatsappData?.leadsQualificados,
              sales: hotmartData?.raw?.totalSales,
              cpc: facebookData?.cpc,
              roi: facebookData?.roi,
            }}
          />
        </PlanGate>
      </div>
    </main>
  )
}
