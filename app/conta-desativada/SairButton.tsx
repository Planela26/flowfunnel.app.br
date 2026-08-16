'use client'

import { signOut } from 'next-auth/react'
import { LogOut } from 'lucide-react'

export default function SairButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: '/login' })}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-5 py-3 text-sm font-medium text-gray-200 transition hover:bg-gray-700"
    >
      <LogOut className="h-4 w-4" />
      Sair da conta
    </button>
  )
}
