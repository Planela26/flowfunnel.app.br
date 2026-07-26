'use client'

// Root error boundary. Sem ele, quando um chunk falha em produção (Hash CDN
// stale / build mismatch no Hostinger HCDN), o byte cru do chunk
// (ex: "7("{{}}")n"")") vaza no DOM como texto visível. Aqui pegamos QUALQUER
// erro render — incluindo chunk-load errors que escapam do reloader —
// e mostramos uma tela amigável com botão de recarregar.

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  // Força um reload duro na primeira renderização de um erro de chunk.
  // O ChunkErrorReloader geralmente já tratou isso; este é o cinto-e-suspensório.
  if (typeof window !== 'undefined') {
    const msg = String(error?.message || '')
    const isChunk =
      error?.name === 'ChunkLoadError' ||
      /ChunkLoadError/i.test(msg) ||
      /Loading chunk [\w-]+ failed/i.test(msg) ||
      /Failed to load chunk/i.test(msg) ||
      /Importing a module script failed/i.test(msg)
    if (isChunk) {
      // Microtask adiado para evitar loop de render → throw → render.
      queueMicrotask(() => {
        try { window.location.reload() } catch {}
      })
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-center border border-gray-200 dark:border-gray-700">
        <div className="mx-auto w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <span className="text-red-600 dark:text-red-400 text-2xl">!</span>
        </div>
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          Algo deu errado ao carregar esta página
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-5">
          Pode ser uma atualização recente. Clique em <strong>Recarregar</strong>{' '}
          para puxar a versão mais nova.
        </p>
        <div className="flex gap-2 justify-center">
          <button
            onClick={() => {
              try { window.location.reload() } catch {}
            }}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
          >
            Recarregar
          </button>
          <button
            onClick={() => reset()}
            className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 text-sm font-medium transition"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  )
}
