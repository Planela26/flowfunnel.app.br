'use client'

// Fallback absoluto: se nem o layout raiz consegue renderizar, este fallback
// assume a página inteira. Tipicamente chamado quando o próprio chunk do
// layout falha — sem ele, o usuário vê código TS bruto renderizado no DOM.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="pt-BR">
      <body>
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b1220',
          color: '#e5e7eb',
          fontFamily: 'system-ui, sans-serif',
          padding: '1.5rem',
        }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
              Não foi possível carregar o app
            </h1>
            <p style={{ fontSize: 14, opacity: 0.8, marginBottom: 16 }}>
              Tentando recarregar automaticamente&hellip;
            </p>
            <button
              onClick={() => { try { window.location.reload() } catch {} }}
              style={{
                padding: '8px 16px',
                background: '#2563eb',
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                cursor: 'pointer',
                fontSize: 14,
              }}
            >
              Recarregar agora
            </button>
            <script
              // Reload automático silencioso para chunks quebrados (Hostinger HCDN stale).
              dangerouslySetInnerHTML={{
                __html: `setTimeout(function(){try{window.location.reload()}catch(e){}},1500)`,
              }}
            />
          </div>
        </div>
      </body>
    </html>
  )
}
