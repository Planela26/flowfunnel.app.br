'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { useNavigation } from './NavigationContext'
import {
  Settings, LayoutDashboard, Phone, Megaphone, Webhook,
  BarChart2, Users2, UserCog, Users, FileText, CreditCard,
  Target, Gift, Route, Brain,
} from 'lucide-react'
import UserMenu from './UserMenu'
import PlanBadge from './PlanBadge'
import NotificationCenter from './NotificationCenter'
import UsageBar from './UsageBar'

type NavItem = {
  href: string
  label: string
  icon: React.ElementType
  exact?: boolean
  adminOnly?: boolean
}

type NavGroup = {
  title: string
  items: NavItem[]
  adminOnly?: boolean
}

const navGroups: NavGroup[] = [
  {
    title: 'Visão Geral',
    items: [
      { href: '/dashboard', label: 'Funil', icon: LayoutDashboard, exact: true },
    ],
  },
  {
    title: 'Análise',
    items: [
      { href: '/lead-journey', label: 'Jornada do Lead', icon: Route },
      { href: '/conversion-intelligence', label: 'Inteligência IA', icon: Brain },
      { href: '/analytics', label: 'Analytics', icon: BarChart2 },
      { href: '/reports', label: 'Relatórios', icon: FileText },
      { href: '/goals', label: 'Metas', icon: Target },
    ],
  },
  {
    title: 'Operação',
    items: [
      { href: '/whatsapp-numbers', label: 'Meus Números', icon: Phone },
      { href: '/campaigns', label: 'Campanhas', icon: Megaphone },
      { href: '/leads', label: 'Leads', icon: Users },
      { href: '/webhooks', label: 'Webhooks', icon: Webhook },
    ],
  },
  {
    title: 'Conta',
    items: [
      { href: '/billing', label: 'Assinatura', icon: CreditCard },
      { href: '/affiliate', label: 'Afiliados', icon: Gift },
      { href: '/settings/team', label: 'Time', icon: Users2 },
      { href: '/settings', label: 'Integrações', icon: Settings },
    ],
  },
  {
    title: 'Admin',
    adminOnly: true,
    items: [
      { href: '/admin/affiliates', label: 'Gerenciar Afiliados', icon: Users2, adminOnly: true },
      { href: '/admin/users', label: 'Usuários', icon: UserCog, adminOnly: true },
    ],
  },
]

export default function DashboardSidebar() {
  const { activePath, navigate } = useNavigation()
  const { data: session } = useSession()
  const isAdmin = (session?.user as any)?.role === 'ADMIN'

  const visibleGroups = navGroups.filter(g => !g.adminOnly || isAdmin)

  return (
    <aside className="hidden lg:flex flex-col fixed top-0 left-0 h-screen w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 z-40 shadow-sm">

      {/* Accent bar */}
      <div className="h-1 bg-gradient-to-r from-blue-900 via-blue-700 to-blue-500 flex-shrink-0" />

      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
        <div className="w-10 h-10 rounded-full overflow-hidden shadow-sm flex-shrink-0 ring-1 ring-blue-200 dark:ring-blue-700">
          <img src="/flowfunnel-logo.jpg" alt="FlowFunnel" className="w-full h-full object-cover" />
        </div>
        <span className="text-base font-extrabold text-blue-900 dark:text-white tracking-tight leading-none">FlowFunnel</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 overflow-y-auto space-y-4">
        {visibleGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items
                .filter(item => !item.adminOnly || isAdmin)
                .map(({ href, label, icon: Icon, exact }) => {
                  const isActive = exact ? activePath === href : activePath.startsWith(href)
                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return
                        e.preventDefault()
                        navigate(href)
                      }}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm'
                          : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      {label}
                    </Link>
                  )
                })}
            </div>
          </div>
        ))}
      </nav>

      {/* Usage bar */}
      <UsageBar />

      {/* Bottom: User + Actions */}
      <div className="border-t border-gray-100 dark:border-gray-800 px-3 pt-3 pb-3 flex-shrink-0 space-y-2">
        <UserMenu />
        {/* Actions row: notifications + plan + theme */}
        <div className="flex items-center justify-between px-0.5">
          <div className="flex items-center gap-1">
            <NotificationCenter />
          </div>
          <PlanBadge />
        </div>
      </div>
    </aside>
  )
}
