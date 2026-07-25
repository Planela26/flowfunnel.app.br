'use client'

import DashboardSidebar from '@/components/DashboardSidebar'
import SubscriptionCard from '@/components/SubscriptionCard'
import { SlidersHorizontal } from 'lucide-react'

export default function ConfiguracoesPage() {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-gray-950">
      <DashboardSidebar />
      <main className="flex-1 lg:ml-64 p-4 sm:p-6 lg:p-8 overflow-auto">
        <div className="max-w-2xl mx-auto">

          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-1">
              <SlidersHorizontal className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Configurações</h1>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Gerencie sua assinatura e preferências da conta.
            </p>
          </div>

          {/* Assinatura */}
          <section className="mb-6">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
              Assinatura
            </h2>
            <SubscriptionCard />
          </section>

        </div>
      </main>
    </div>
  )
}
