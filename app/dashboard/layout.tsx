// Força renderização dinâmica: impede Next.js de pré-renderizar o dashboard
// como página estática (o que causava "chunk not found" após novos deploys).
export const dynamic = 'force-dynamic'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
