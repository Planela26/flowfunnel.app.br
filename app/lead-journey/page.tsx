'use client'

import LandingTracking from '@/components/LandingTracking'
import JourneyExplorer from '@/components/JourneyExplorer'

export default function LeadJourneyPage() {
  return (
    <main className="container mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
          📈 Jornada do Lead
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Rastreamento da Landing Page até a compra — com atribuição determinística.
        </p>
      </div>
      <div className="mb-8">
        <JourneyExplorer />
      </div>
      <LandingTracking />
    </main>
  )
}
