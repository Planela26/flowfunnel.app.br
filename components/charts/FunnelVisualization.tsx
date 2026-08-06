'use client'

import { useEffect, useState } from 'react'

interface FunnelStage {
  name: string
  value: number
  color: string
  icon?: string
}

interface FunnelVisualizationProps {
  title: string
  stages: FunnelStage[]
}

const SVG_WIDTH = 460
const BAND_HEIGHT = 84
const TOP_RATIO = 0.98
const BOTTOM_RATIO = 0.1
const SAMPLES_PER_BAND = 14

// Posições fixas (não aleatórias de verdade) pra não gerar hydration mismatch
// entre server e client — só o efeito visual de faísca importa aqui.
const SPARKLES = [
  { x: 8, y: 6, size: 5, delay: 0 },
  { x: 88, y: 10, size: 3, delay: 300 },
  { x: 78, y: 26, size: 4, delay: 900 },
  { x: 14, y: 34, size: 3, delay: 600 },
  { x: 92, y: 46, size: 5, delay: 150 },
  { x: 6, y: 55, size: 3, delay: 1200 },
  { x: 82, y: 66, size: 4, delay: 450 },
  { x: 20, y: 74, size: 3, delay: 800 },
  { x: 70, y: 88, size: 4, delay: 1000 },
  { x: 30, y: 92, size: 3, delay: 250 },
]

// Clareia (percent > 0) ou escurece (percent < 0) uma cor hex.
function shade(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16)
  const clamp = (v: number) => Math.max(0, Math.min(255, v))
  const r = clamp(((num >> 16) & 0xff) + Math.round(255 * percent))
  const g = clamp(((num >> 8) & 0xff) + Math.round(255 * percent))
  const b = clamp((num & 0xff) + Math.round(255 * percent))
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

// Curva de afunilamento única e contínua (não depende dos valores reais) —
// garante um contorno sempre liso. Os números de verdade vão escritos em
// cada faixa, sempre a partir de `stages` (dados reais recebidos por prop).
function easeOutSoft(t: number): number {
  return 1 - Math.pow(1 - t, 1.5)
}

export default function FunnelVisualization({ title, stages = [] }: FunnelVisualizationProps) {
  const [mounted, setMounted] = useState(false)
  const [hovered, setHovered] = useState<number | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  const maxValue = stages[0]?.value || 0
  const hasData = stages.length >= 2 && maxValue > 0
  const n = Math.max(stages.length, 1)
  const topY = 10
  const bodyHeight = n * BAND_HEIGHT
  const svgHeight = topY + bodyHeight + 10

  const ratioAtT = (t: number) => TOP_RATIO - (TOP_RATIO - BOTTOM_RATIO) * easeOutSoft(t)
  const xLeftAtRatio = (ratio: number) => (SVG_WIDTH - SVG_WIDTH * ratio) / 2
  const xRightAtRatio = (ratio: number) => xLeftAtRatio(ratio) + SVG_WIDTH * ratio

  const totalSamples = n * SAMPLES_PER_BAND
  const leftPts: [number, number][] = []
  const rightPts: [number, number][] = []
  for (let s = 0; s <= totalSamples; s++) {
    const t = s / totalSamples
    const y = topY + t * bodyHeight
    const ratio = ratioAtT(t)
    leftPts.push([xLeftAtRatio(ratio), y])
    rightPts.push([xRightAtRatio(ratio), y])
  }
  const outlinePath =
    `M ${leftPts.map(p => p.join(',')).join(' L ')} ` +
    `L ${rightPts.slice().reverse().map(p => p.join(',')).join(' L ')} Z`

  const yAt = (k: number) => topY + k * BAND_HEIGHT
  const topWidth = SVG_WIDTH * ratioAtT(0)
  const bottomWidth = SVG_WIDTH * ratioAtT(1)
  const lastColor = stages[n - 1]?.color || '#888'

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">{title}</h3>

      {/* Palco escuro — dá contraste pro brilho "gema" das faixas */}
      <div className="relative rounded-2xl overflow-hidden bg-gradient-to-b from-[#12141c] to-[#020203] py-6">
        {/* Faíscas */}
        {SPARKLES.map((s, idx) => (
          <span
            key={idx}
            className="absolute rounded-full bg-white animate-pulse"
            style={{
              left: `${s.x}%`,
              top: `${s.y}%`,
              width: s.size,
              height: s.size,
              boxShadow: `0 0 ${s.size * 2.5}px ${s.size}px rgba(255,255,255,0.55)`,
              opacity: mounted ? undefined : 0,
              animationDelay: `${s.delay}ms`,
              animationDuration: '2200ms',
              transition: 'opacity 600ms ease',
            }}
          />
        ))}

        {/* Brilho ambiente atrás do topo e da ponta */}
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            left: '50%', top: -40, width: topWidth * 1.1, height: 120,
            transform: 'translateX(-50%)',
            background: `radial-gradient(ellipse at center, ${shade(stages[0]?.color || '#888', 0.25)}55, transparent 70%)`,
          }}
        />
        <div
          className="absolute rounded-full blur-3xl"
          style={{
            left: '50%', bottom: -30, width: 160, height: 100,
            transform: 'translateX(-50%)',
            background: `radial-gradient(ellipse at center, ${shade(lastColor, 0.2)}66, transparent 70%)`,
          }}
        />

        <svg
          width="100%"
          height={svgHeight}
          viewBox={`0 0 ${SVG_WIDTH} ${svgHeight}`}
          preserveAspectRatio="xMidYMin meet"
          className="relative block mx-auto max-w-[460px]"
        >
          <defs>
            {stages.map((stage, i) => (
              <linearGradient key={i} id={`funnel-grad-${i}`} x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor={shade(stage.color, -0.45)} />
                <stop offset="18%" stopColor={shade(stage.color, -0.1)} />
                <stop offset="38%" stopColor={shade(stage.color, 0.4)} />
                <stop offset="52%" stopColor={shade(stage.color, 0.08)} />
                <stop offset="100%" stopColor={shade(stage.color, -0.45)} />
              </linearGradient>
            ))}
            {stages.map((_, i) => (
              <clipPath key={i} id={`funnel-band-${i}`}>
                <rect x={0} y={yAt(i)} width={SVG_WIDTH} height={BAND_HEIGHT + 0.5} />
              </clipPath>
            ))}
          </defs>

          {/* Elipse escura no topo — efeito de "olhar para dentro" da abertura */}
          <ellipse
            cx={SVG_WIDTH / 2}
            cy={topY}
            rx={topWidth / 2}
            ry={12}
            fill="#000000"
            opacity={mounted ? 0.6 : 0}
            style={{ transition: 'opacity 500ms ease' }}
          />

          {/* Faixas do funil com degradê "gema" */}
          {stages.map((stage, i) => {
            const isHovered = hovered === i
            return (
              <path
                key={i}
                d={outlinePath}
                clipPath={`url(#funnel-band-${i})`}
                fill={`url(#funnel-grad-${i})`}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  opacity: mounted ? 1 : 0,
                  filter: isHovered ? 'brightness(1.15)' : 'brightness(1)',
                  transform: mounted ? 'scale(1)' : 'scale(0.9)',
                  transformOrigin: `${SVG_WIDTH / 2}px ${yAt(i) + BAND_HEIGHT / 2}px`,
                  transition: `opacity 520ms ease ${i * 100}ms, transform 520ms cubic-bezier(0.34,1.15,0.64,1) ${i * 100}ms, filter 200ms ease`,
                  cursor: 'default',
                }}
              />
            )
          })}

          {/* Anéis de profundidade entre as faixas */}
          {Array.from({ length: n - 1 }).map((_, idx) => {
            const k = idx + 1
            const ratio = ratioAtT(k / n)
            const width = SVG_WIDTH * ratio
            return (
              <ellipse
                key={`rim-${k}`}
                cx={SVG_WIDTH / 2}
                cy={yAt(k)}
                rx={width / 2}
                ry={6}
                fill={shade(stages[k - 1]?.color || '#888', -0.5)}
                opacity={mounted ? 0.9 : 0}
                style={{ transition: `opacity 400ms ease ${k * 100}ms` }}
              />
            )
          })}

          {/* Ponta na base */}
          <ellipse
            cx={SVG_WIDTH / 2}
            cy={yAt(n)}
            rx={bottomWidth / 2}
            ry={4}
            fill={shade(lastColor, -0.35)}
            opacity={mounted ? 1 : 0}
            style={{ transition: 'opacity 500ms ease 500ms' }}
          />

          {/* Rótulos — sempre a partir dos dados reais recebidos via props */}
          {stages.map((stage, i) => {
            const percentage = maxValue > 0 ? ((stage.value / maxValue) * 100).toFixed(1) : '0.0'
            const centerY = yAt(i) + BAND_HEIGHT / 2
            return (
              <g
                key={i}
                style={{
                  opacity: mounted ? 1 : 0,
                  transition: `opacity 400ms ease ${i * 100 + 250}ms`,
                  pointerEvents: 'none',
                }}
              >
                <text
                  x={SVG_WIDTH / 2}
                  y={centerY - 10}
                  textAnchor="middle"
                  fill="#ffffff"
                  style={{ fontSize: 15, fontWeight: 700, letterSpacing: '0.01em', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                >
                  {stage.name}
                </text>
                <text
                  x={SVG_WIDTH / 2}
                  y={centerY + 18}
                  textAnchor="middle"
                  fill="#ffffff"
                  style={{ fontSize: 20, fontWeight: 800, textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}
                >
                  {stage.value.toLocaleString('pt-BR')}
                  <tspan fillOpacity={0.8} style={{ fontSize: 14, fontWeight: 600 }}> · {percentage}%</tspan>
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* Resumo */}
      {hasData ? (
        <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Taxa Geral</div>
              <div className="text-xl font-bold text-gray-900 dark:text-white">
                {((stages[stages.length - 1].value / stages[0].value) * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Drop-off Total</div>
              <div className="text-xl font-bold text-red-600 dark:text-red-400">
                {(stages[0].value - stages[stages.length - 1].value).toLocaleString('pt-BR')}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Convertidos</div>
              <div className="text-xl font-bold text-green-600 dark:text-green-400">
                {stages[stages.length - 1].value.toLocaleString('pt-BR')}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700 text-center text-sm text-gray-500 dark:text-gray-400">
          Nenhum dado de funil disponível
        </div>
      )}
    </div>
  )
}
