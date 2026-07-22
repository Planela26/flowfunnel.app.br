'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Menu } from 'lucide-react'
import DashboardSidebar from './DashboardSidebar'
import MobileSidebar from './MobileSidebar'
import NotificationCenter from './NotificationCenter'
import OnboardingModal from './OnboardingModal'
import EmailVerificationBanner from './EmailVerificationBanner'
import TrialBanner from './TrialBanner'
import GracePeriodBanner from './GracePeriodBanner'
import PlanExpiredBanner from './PlanExpiredBanner'
import TrialSetupWall from './TrialSetupWall'
import { NavigationProvider } from './NavigationContext'
import RouteLoadingOverlay from './RouteLoadingOverlay'

const PREFETCH_ROUTES = [
  '/dashboard',
  '/lead-journey',
  '/conversion-intelligence',
  '/analytics',
  '/reports',
  '/goals',
  '/whatsapp-numbers',
  '/campaigns',
  '/leads',
  '/webhooks',
  '/billing',
  '/affiliate',
  '/settings',
  '/settings/team',
  '/account',
] as const

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { status } = useSession()
  const [mobileOpen, setMobileOpen] = useState(false)

  const hideSidebar =
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/activate-trial') ||
    pathname.startsWith('/invite') ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/verify-email' ||
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname === '/privacidade' ||
    pathname === '/termos' ||
    pathname === '/'

  useEffect(() => {
    // SÓ pré-carrega rotas autenticadas quando o usuário está mesmo logado.
    // Caso contrário, o middleware retornaria redirect-to-login e o Next.js
    // armazenaria esse redirect no cache do client, causando bounce-back após login.
    if (hideSidebar || status !== 'authenticated') return
    type IdleWindow = Window & {
      requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number
      cancelIdleCallback?: (id: number) => void
    }
    const w = window as IdleWindow
    let idleId: number | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    const run = () => {
      for (const route of PREFETCH_ROUTES) {
        if (route === pathname) continue
        try { router.prefetch(route) } catch {}
      }
    }
    if (typeof w.requestIdleCallback === 'function') {
      idleId = w.requestIdleCallback(run, { timeout: 2000 })
    } else {
      timeoutId = setTimeout(run, 200)
    }
    return () => {
      if (idleId !== null && typeof w.cancelIdleCallback === 'function') {
        w.cancelIdleCallback(idleId)
      }
      if (timeoutId !== null) clearTimeout(timeoutId)
    }
  }, [hideSidebar, pathname, router, status])

  if (hideSidebar) return <>{children}</>

  // Pages that have their own mobile header (dashboard)
  const hasDashboardHeader = pathname === '/dashboard'

  return (
    <NavigationProvider>
    <div className="lg:pl-64">
      {/* Onboarding — shown once for new users */}
      <OnboardingModal />

      {/* Trial setup wall — blocks app until user adds card to activate trial */}
      <TrialSetupWall />

      {/* Plano vencido — aviso discreto (modo somente leitura, sem bloqueio) */}
      <PlanExpiredBanner />

      {/* Trial countdown banner */}
      <TrialBanner />

      {/* Grace period payment warning banner */}
      <GracePeriodBanner />

      {/* Email verification reminder */}
      <EmailVerificationBanner />

      {/* Desktop sidebar */}
      <DashboardSidebar />

      {/* Mobile sidebar drawer */}
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Loading overlay enquanto a rota nova carrega */}
      <RouteLoadingOverlay />

      {/* Mobile top bar — shown on all app pages EXCEPT dashboard (which has its own) */}
      {!hasDashboardHeader && (
        <>
          <div className="h-1 bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500 lg:hidden" />
          <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 shadow-sm lg:hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <button
                onClick={() => setMobileOpen(true)}
                className="p-2 rounded-lg text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full overflow-hidden ring-1 ring-blue-200 dark:ring-blue-700">
                  <img src="/flowfunnel-logo.jpg" alt="FlowFunnel" className="w-full h-full object-cover" />
                </div>
                <span className="text-sm font-extrabold text-blue-900 dark:text-white tracking-tight">FlowFunnel</span>
              </div>
              <div className="flex items-center gap-1">
                <NotificationCenter />
              </div>
            </div>
          </header>
        </>
      )}

      {/* Dashboard mobile header gets the hamburger injected separately */}
      {hasDashboardHeader && (
        <button
          onClick={() => setMobileOpen(true)}
          className="fixed top-3 left-3 z-40 lg:hidden p-2 rounded-xl bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300"
        >
          <Menu className="w-5 h-5" />
        </button>
      )}

      {children}
    </div>
    </NavigationProvider>
  )
}
