'use client'

import Link from 'next/link'
import { signOut } from 'next-auth/react'
import { CreditCard, LogOut } from 'lucide-react'

export default function PagarButton({ plan }: { plan: string }) {
  return (
    <div className="space-y-2.5">
      <Link
        href={`/checkout?plan=${plan}`}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-blue-700"
      >
        <CreditCard className="h-4 w-4" />
        Atualizar forma de pagamento
      </Link>
      <button
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gray-700 bg-gray-800 px-5 py-2.5 text-xs font-medium text-gray-300 transition hover:bg-gray-700"
      >
        <LogOut className="h-3.5 w-3.5" />
        Sair da conta
      </button>
    </div>
  )
}
