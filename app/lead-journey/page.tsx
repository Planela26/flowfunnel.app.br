'use client'

import { Route } from 'lucide-react'
import LandingTracking from '@/components/LandingTracking'
import JourneyExplorer from '@/components/JourneyExplorer'

export default function LeadJourneyPage() {
  return (
    <main className="container mx-auto px-4 py-6">
      <div className="mb-6 flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-11 h-11 rounded-xl bg-violet-500/10 text-violet-500 dark:text-violet-400 flex-shrink-0">
          <Route className="w-5 h-5" />
        </span>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white">
            Jornada do Lead
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            Rastreamento da Landing Page até a compra — com atribuição determinística.
          </p>
        </div>
      </div>
      <div className="mb-8">
        <JourneyExplorer />
      </div>
      <LandingTracking />
    </main>
  )
}
