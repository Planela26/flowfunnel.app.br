"use client"
import Link from 'next/link'
import { usePlan } from './usePlan'

const PLAN_STYLES: Record<string, string> = {
  FREE:  'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
  START: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300',
  PRO:   'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
  SCALE: 'bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300',
}

export default function PlanBadge() {
  const { info, loading } = usePlan()

  if (loading) return null

  const plan = info.plan ?? 'FREE'

  return (
    <Link
      href="/settings"
      title="Gerenciar assinatura"
      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition hover:opacity-80 ${PLAN_STYLES[plan] ?? PLAN_STYLES.FREE}`}
    >
      {plan}
    </Link>
  )
}
