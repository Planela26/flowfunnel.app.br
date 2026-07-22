'use client'

import { useEffect, useState } from 'react'
import { useNavigation } from './NavigationContext'

export default function RouteLoadingOverlay() {
  const { isPending } = useNavigation()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!isPending) {
      setShow(false)
      return
    }
    const t = setTimeout(() => setShow(true), 30)
    return () => clearTimeout(t)
  }, [isPending])

  if (!show) return null

  return (
    <div
      className="fixed inset-0 z-[100] lg:left-64 bg-white/75 dark:bg-gray-950/75 backdrop-blur-[2px] flex items-center justify-center pointer-events-none animate-in fade-in duration-150"
      aria-hidden="true"
    >
      <div className="flex flex-col items-center gap-3">
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#3b82f6,#8b5cf6,#06b6d4,#3b82f6)] animate-spin [animation-duration:1.6s] blur-[2px] opacity-90" />
          <div className="absolute inset-[3px] rounded-full bg-white dark:bg-gray-950" />
          <div className="absolute inset-[6px] rounded-full overflow-hidden shadow-inner ring-1 ring-blue-100 dark:ring-blue-900">
            <img
              src="/flowfunnel-logo.jpg"
              alt=""
              className="w-full h-full object-cover"
            />
          </div>
          <div className="absolute -inset-1 rounded-full border border-blue-400/40 dark:border-blue-300/30 animate-ping [animation-duration:1.8s]" />
        </div>
        <div className="text-xs font-bold text-blue-900 dark:text-white tracking-wide">
          Carregando...
        </div>
      </div>
    </div>
  )
}
