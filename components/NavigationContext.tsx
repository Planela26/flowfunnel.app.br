'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'

type NavigationCtx = {
  activePath: string
  isPending: boolean
  navigate: (href: string) => void
}

const Ctx = createContext<NavigationCtx | null>(null)

export function NavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const [pendingPath, setPendingPath] = useState<string | null>(null)

  const norm = (p: string) => (p === '/' ? p : p.replace(/\/+$/, ''))

  useEffect(() => {
    if (!pendingPath) return
    if (norm(pathname) === norm(pendingPath)) {
      setPendingPath(null)
    }
  }, [pathname, pendingPath])

  useEffect(() => {
    if (!pendingPath) return
    const t = setTimeout(() => setPendingPath(null), 8000)
    return () => clearTimeout(t)
  }, [pendingPath])

  const navigate = useCallback(
    (href: string) => {
      const normalized = norm(href)
      if (normalized === norm(pathname) || normalized === pendingPath) return
      setPendingPath(normalized)
      router.push(href)
    },
    [pathname, pendingPath, router]
  )

  const value: NavigationCtx = {
    activePath: pendingPath ?? pathname,
    isPending: pendingPath !== null,
    navigate,
  }

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useNavigation(): NavigationCtx {
  const ctx = useContext(Ctx)
  if (!ctx) {
    return {
      activePath: typeof window !== 'undefined' ? window.location.pathname : '/',
      isPending: false,
      navigate: () => {},
    }
  }
  return ctx
}
