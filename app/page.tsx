import Link from 'next/link'
import { Inter_Tight } from 'next/font/google'
import Hero from '@/components/landing/Hero'
import LandingSections from '@/components/landing/LandingSections'

// Display: Inter Tight — desenhada para títulos, encaixa com a Inter do corpo.
const display = Inter_Tight({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-display',
  display: 'swap',
})

export default function Home() {
  return (
    <main className={`${display.variable} bg-black text-white`}>
      {/* NAV — fixa, transparente sobre o herói. Hero.tsx reserva o espaço
          no topo (pt-36/44) para o conteúdo não ficar por baixo dela. */}
      <header className="fixed left-0 right-0 top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 overflow-hidden rounded-full ring-1 ring-white/15">
              <img src="/flowsara-logo.jpg" alt="FlowSara" className="h-full w-full object-cover" />
            </div>
            <span
              className="text-lg font-bold tracking-[-0.02em]"
              style={{ fontFamily: 'var(--font-display), Inter, sans-serif' }}
            >
              FlowSara
            </span>
          </div>
          <nav className="flex items-center gap-2">
            <Link
              href="/login"
              className="rounded-lg px-3 py-2 text-sm font-medium text-white/75 transition hover:bg-white/10 hover:text-white sm:px-4"
            >
              Entrar
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-white/90 sm:px-5"
            >
              Começar grátis
            </Link>
          </nav>
        </div>
      </header>

      <Hero />
      <LandingSections />
    </main>
  )
}
