'use client'

const SLIDES = [
  { src: '/showcase/dashboard.jpg', label: 'Dashboard geral', caption: 'Funil de conversão completo em um único painel' },
  { src: '/showcase/ia-gargalos.jpg', label: 'IA detectando gargalos', caption: 'Diagnóstico automático com sugestões de ação' },
  { src: '/showcase/funil.jpg', label: 'Funil visual', caption: 'Da campanha ao checkout em uma linha do tempo' },
  { src: '/showcase/alertas.jpg', label: 'Comparação & insights', caption: 'Compare períodos e receba sugestões da IA' },
  { src: '/showcase/origem.jpg', label: 'Origem das vendas', caption: 'Saiba qual campanha gerou cada venda' },
  { src: '/showcase/metas.jpg', label: 'Metas e objetivos', caption: 'Acompanhe o progresso das metas em tempo real' },
] as const

export default function ShowcaseSection() {
  return (
    <section className="relative bg-gradient-to-b from-gray-50 via-white to-gray-50 py-20 px-6 overflow-hidden">
      {/* subtle blue glow blobs in background */}
      <div className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[700px] h-[700px] rounded-full bg-blue-500/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-blue-400/10 blur-3xl" />

      <div className="relative max-w-6xl mx-auto">
        {/* Heading */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-gray-900 tracking-tight leading-[1.1]">
            Sua operação inteira,{' '}
            <span className="bg-gradient-to-r from-blue-700 via-blue-600 to-blue-500 bg-clip-text text-transparent">
              visível em um único painel
            </span>
          </h2>
          <p className="text-gray-500 text-base sm:text-lg mt-4 max-w-2xl mx-auto leading-relaxed">
            Veja anúncios, WhatsApp, funis e vendas conectados em tempo real — com uma IA que identifica gargalos automaticamente.
          </p>
        </div>

        {/* Grid de thumbnails médios */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 sm:gap-6">
          {SLIDES.map((slide) => (
            <figure
              key={slide.src}
              className="group relative rounded-2xl overflow-hidden bg-[#0c1426] ring-1 ring-gray-200 shadow-[0_15px_40px_-12px_rgba(30,64,175,0.18)] hover:ring-blue-300 hover:-translate-y-1 hover:shadow-[0_20px_50px_-12px_rgba(59,130,246,0.35)] transition-all duration-300"
            >
              <div className="aspect-[16/10] w-full">
                <img
                  src={slide.src}
                  alt={slide.label}
                  loading="lazy"
                  draggable={false}
                  className="w-full h-full object-contain"
                />
              </div>
              <figcaption className="px-3 py-2 bg-white">
                <div className="text-[11px] font-bold uppercase tracking-wider text-blue-600">
                  {slide.label}
                </div>
                <div className="text-xs text-gray-600 mt-0.5 leading-snug">
                  {slide.caption}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
