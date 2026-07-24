'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  addEdge,
  Handle,
  Position,
  BackgroundVariant,
  MarkerType,
  getBezierPath,
  EdgeLabelRenderer,
  BaseEdge,
  type NodeProps,
  type EdgeProps,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { CheckCircle, XCircle, DollarSign, Lightbulb, Plus, X } from 'lucide-react'
import Link from 'next/link'
import { AVAILABLE_INTEGRATIONS, type IntegrationCard } from '@/hooks/useFunnelView'

/* ─── Types ─────────────────────────────────────────────────────────── */
export interface FunnelFlowProps {
  visibleIds: string[]
  onAddCard: (id: string) => void
  onRemoveCard: (id: string) => void
  // Data per integration
  dataMap: Record<string, any>
  loadingMap: Record<string, boolean>
  onInsight: (cardType: string, data: any) => void
  planName?: string
}

/* ─── Color helpers for dynamic cards ───────────────────────────────── */
function getIntegrationMeta(id: string) {
  const card = AVAILABLE_INTEGRATIONS.find(i => i.id === id)
  if (!card) return null
  const c = card.color
  return {
    ...card,
    headerClass: `bg-[${c}]/10`,
    iconClass: `bg-[${c}] text-white`,
    spinnerClass: `border-[${c}]`,
    linkClass: `text-[${c}]`,
    labelColor: `text-[${c}]`,
    borderClass: `border-[${c}]/50`,
    handleClass: `!bg-[${c}] !border-[${c}]`,
    headerBg: `bg-[${c}]/10`,
    headerBorder: `border-[${c}]/20`,
    iconBg: `bg-[${c}]`,
    iconColor: `text-white`,
    dotClass: `bg-[${c}]`,
  }
}

/* ─── Deletable Bezier Edge ──────────────────────────────────────────── */
function DeletableEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, style, markerEnd,
}: EdgeProps) {
  const { setEdges } = useReactFlow()
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  return (
    <>
      <BaseEdge path={edgePath} markerEnd={markerEnd as any} style={style} />
      <EdgeLabelRenderer>
        <div
          style={{ transform: `translate(-50%,-50%) translate(${labelX}px,${labelY}px)` }}
          className="absolute nodrag nopan pointer-events-auto"
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setEdges(eds => eds.filter(ed => ed.id !== id))
            }}
            title="Desconectar"
            className="w-4 h-4 rounded-full bg-gray-800 border border-gray-600 text-gray-500 hover:bg-red-950 hover:border-red-600 hover:text-red-400 flex items-center justify-center transition-colors text-[8px] font-black leading-none"
          >
            &#10005;
          </button>
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

/* ─── Generic Integration Card Node ─────────────────────────────────── */
function IntegrationCardNode({ data }: NodeProps) {
  const d = data as any
  const card = d.card as IntegrationCard
  const isTraffic = card.type === 'traffic'
  const isCheckout = card.type === 'checkout'
  const isPayment = card.type === 'payment'
  const isCrm = card.type === 'crm'

  const c = card.color
  const headerBg = { backgroundColor: `${c}10` }
  const headerBorderStyle = { borderBottomColor: `${c}30` }
  const iconBg = { backgroundColor: c }
  const borderColor = { borderColor: `${c}80` }
  const labelColor = { color: c }
  const dotColor = { backgroundColor: c }

  const metrics = d.data?.connected ? d.data?.metrics || [] : null
  const connected = !!d.data?.connected
  const loading = d.loading

  const onRemove = d.onRemove
  const onInsight = d.onInsight

  return (
    <div
      className="w-52 bg-gray-900 border-2 rounded-2xl shadow-2xl overflow-hidden select-none relative"
      style={borderColor}
    >
      {/* Remove button */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="absolute top-2 right-2 z-10 w-5 h-5 rounded-full bg-gray-800 border border-gray-600 text-gray-500 hover:bg-red-950 hover:border-red-600 hover:text-red-400 flex items-center justify-center transition-colors text-[9px] font-black leading-none"
          title="Remover do visual"
        >
          <X className="w-3 h-3" />
        </button>
      )}

      {/* Left handle for non-traffic cards */}
      {!isTraffic && (
        <Handle type="target" position={Position.Left} className="!w-3 !h-3" style={{ backgroundColor: c, borderColor: c }} />
      )}

      {/* Header */}
      <div className="px-3 py-2 flex items-center gap-2 pr-8" style={{ ...headerBg, ...headerBorderStyle, borderBottomWidth: 1 }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm font-black" style={iconBg}>
          <span className="text-white">{card.icon}</span>
        </div>
        <div>
          <div className="text-[9px] text-gray-500 uppercase tracking-widest">
            {isTraffic ? 'Tráfego' : isCheckout ? 'Checkout' : isPayment ? 'Pagamento' : isCrm ? 'CRM' : 'Integração'}
          </div>
          <div className="text-xs font-bold text-white">{card.label}</div>
        </div>
        {connected && (
          <div className="ml-auto">
            <div className="w-2 h-2 rounded-full animate-pulse" style={dotColor} />
          </div>
        )}
        {loading && (
          <div className="ml-auto w-4 h-4 border-2 rounded-full animate-spin" style={{ borderColor: c, borderTopColor: 'transparent' }} />
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        {loading ? (
          <div className="flex flex-col items-center py-3 gap-2">
            <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: c, borderTopColor: 'transparent' }} />
            <span className="text-[10px] text-gray-500">Carregando...</span>
          </div>
        ) : metrics ? (
          <div className="grid grid-cols-2 gap-1.5">
            {metrics.map((m: any, i: number) => (
              <div key={i} className="bg-gray-800/60 rounded-lg p-1.5">
                <div className="text-[9px] text-gray-500 uppercase tracking-wide">{m.label}</div>
                <div className="text-xs font-bold text-white">{m.value}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-4 gap-3">
            {/* Dashed ring with icon — signals "empty slot" */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black border-2 border-dashed"
              style={{ borderColor: `${c}60`, backgroundColor: `${c}12` }}
            >
              <span style={{ color: c }}>{card.icon}</span>
            </div>

            {/* Context-aware message */}
            <div className="text-center space-y-0.5">
              <p className="text-[11px] font-semibold text-gray-300">
                {isTraffic ? 'Nenhuma conta conectada' : 'Integração não ativa'}
              </p>
              <p className="text-[9px] text-gray-500 leading-tight">
                {isTraffic
                  ? 'Conecte para ver cliques, leads e gastos no funil'
                  : card.type === 'funnel'
                  ? 'Conecte para ver conversas e qualificação'
                  : 'Conecte para ver checkouts e faturamento'}
              </p>
            </div>

            {/* CTA button */}
            {card.connectHref && (
              <Link
                href={card.connectHref}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold text-white transition hover:opacity-90 active:scale-95"
                style={{ backgroundColor: c }}
              >
                <Plus className="w-3 h-3" />
                {isTraffic
                  ? 'Adicionar conta'
                  : card.type === 'payment'
                  ? 'Configurar pagamento'
                  : 'Adicionar integração'}
              </Link>
            )}
          </div>
        )}
      </div>

      {/* Footer with insight */}
      {metrics && onInsight && (
        <div className="border-t border-gray-800 px-3 py-1.5 flex items-center gap-1">
          <Lightbulb className="w-3 h-3 text-yellow-500 flex-shrink-0" />
          <button onClick={onInsight} className="text-[9px] hover:underline truncate" style={labelColor}>
            Ver análise do funil →
          </button>
        </div>
      )}

      {/* Right handle for traffic and funnel cards */}
      {(isTraffic || card.type === 'funnel') && (
        <Handle type="source" position={Position.Right} className="!w-3 !h-3" style={{ backgroundColor: c, borderColor: c }} />
      )}
    </div>
  )
}

const nodeTypes = { integration: IntegrationCardNode }
const edgeTypes = { deletable: DeletableEdge }

/* ─── Edge helpers ────────────────────────────────────────────────────── */
const activeEdge = (id: string, source: string, target: string, color: string): Edge => ({
  id, source, target, type: 'deletable', animated: true,
  style: { stroke: color, strokeWidth: 2 },
  markerEnd: { type: MarkerType.ArrowClosed, color },
})

const inactiveEdge = (id: string, source: string, target: string): Edge => ({
  id, source, target, type: 'deletable', animated: false,
  style: { stroke: '#374151', strokeWidth: 1.5, strokeDasharray: '5 4' },
  markerEnd: { type: MarkerType.ArrowClosed, color: '#374151' },
})

/* ─── Position calculator ───────────────────────────────────────────── */
const COL_X = {
  traffic: 20,
  funnel: 360,
  checkout: 720,
  payment: 720,
  crm: 1080,
}

const COL_GAP_Y = 260

function computePositions(visibleIds: string[]): Record<string, { x: number; y: number }> {
  const cols: Record<string, number> = { traffic: 0, funnel: 0, checkout: 0, payment: 0, crm: 0 }
  const positions: Record<string, { x: number; y: number }> = {}

  for (const id of visibleIds) {
    const card = AVAILABLE_INTEGRATIONS.find(i => i.id === id)
    if (!card) continue
    const col = card.type
    const x = COL_X[col] ?? 720
    const idx = cols[col] || 0
    const y = 100 + idx * COL_GAP_Y
    positions[id] = { x, y }
    cols[col] = idx + 1
  }

  return positions
}

/* ─── Add Integration Modal ──────────────────────────────────────────── */
function AddCardModal({
  open,
  onClose,
  available,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  available: IntegrationCard[]
  onSelect: (id: string) => void
}) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="text-sm font-bold text-white">Adicionar integração ao funil</h3>
          <button onClick={onClose} className="w-7 h-7 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-1">
          {available.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Todas as integrações já estão no funil.</p>
          ) : (
            available.map(card => (
              <button
                key={card.id}
                onClick={() => { onSelect(card.id); onClose() }}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-gray-800/50 hover:bg-gray-800 border border-transparent hover:border-gray-600 transition text-left"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-sm font-black flex-shrink-0" style={{ backgroundColor: card.color }}>
                  <span className="text-white">{card.icon}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{card.label}</div>
                  <div className="text-[10px] text-gray-500 capitalize">{card.type}</div>
                </div>
                <Plus className="w-4 h-4 ml-auto text-gray-500" />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Plus Button Overlay ───────────────────────────────────────────── */
function PlusButton({ onClick }: { onClick: () => void }) {
  return (
    <div className="absolute bottom-4 right-4 z-10">
      <button
        onClick={onClick}
        className="w-12 h-12 rounded-full bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/30 flex items-center justify-center transition hover:scale-105"
        title="Adicionar integração"
      >
        <Plus className="w-6 h-6" />
      </button>
    </div>
  )
}

/* ─── Build metrics from data ────────────────────────────────────────── */
function buildMetrics(id: string, data: any): any[] | null {
  if (!data?.connected) return null

  switch (id) {
    case 'facebook':
      return [
        { label: 'Cliques', value: data.cliques || 0 },
        { label: 'Impressões', value: data.impressoes || 0 },
        { label: 'CPC', value: data.cpc || '—' },
        { label: 'CPM', value: data.cpm || '—' },
        { label: 'CTR', value: data.ctr || '—' },
        { label: 'Leads', value: data.raw?.leads != null ? String(data.raw.leads) : '—' },
      ]
    case 'google':
      return [
        { label: 'Cliques', value: String(data.cliques ?? 0) },
        { label: 'Impressões', value: data.impressoes || 0 },
        { label: 'CPC', value: data.cpc || '—' },
        { label: 'CPM', value: data.cpm || '—' },
        { label: 'CTR', value: data.ctr || '—' },
        { label: 'Gastos', value: data.gastos || '—' },
      ]
    case 'tiktok':
      return [
        { label: 'Cliques', value: String(data.cliques ?? 0) },
        { label: 'Impressões', value: data.impressoes || 0 },
        { label: 'CPC', value: data.cpc || '—' },
        { label: 'CPM', value: data.cpm || '—' },
        { label: 'CTR', value: data.ctr || '—' },
        { label: 'Gastos', value: data.gastos || '—' },
      ]
    case 'whatsapp':
      return [
        { label: 'Conversas', value: data.conversasIniciadas || 0 },
        { label: 'Não term.', value: data.conversasNaoTerminadas || 0 },
        { label: 'Qualificados', value: data.leadsQualificados || 0 },
        { label: 'Média/Dia', value: data.mediaConversasDia || '—' },
        { label: 'Taxa Resp.', value: data.taxaResposta || '—' },
        { label: 'Estimativa', value: data.conversasEstimadas ?? '—' },
      ]
    case 'hotmart':
    case 'kiwify':
    case 'eduzz':
    case 'monetizze':
      return [
        { label: 'Checkouts', value: data.checkoutsIniciados || 0 },
        { label: 'Abandonados', value: data.checkoutsNaoTerminados || 0 },
        { label: 'Confirmados', value: data.pagamentosConfirmados || 0 },
        { label: 'Taxa Conv.', value: data.taxaConversaoCheckout || '—' },
        { label: 'Ticket Médio', value: data.ticketMedio || '—' },
        { label: 'Faturamento', value: data.faturamento || '—' },
      ]
    case 'stripe':
    case 'mercadopago':
      return [
        { label: 'Transações', value: data.transactions || 0 },
        { label: 'Faturamento', value: data.revenue || '—' },
        { label: 'Reembolsos', value: data.refunds || 0 },
        { label: 'Taxa Reemb.', value: data.refundRate || '—' },
      ]
    case 'crm':
      return [
        { label: 'Leads', value: data.leads || 0 },
        { label: 'Oportunidades', value: data.opportunities || 0 },
        { label: 'Conversões', value: data.conversions || 0 },
        { label: 'Taxa Conv.', value: data.conversionRate || '—' },
      ]
    default:
      return null
  }
}

/* ─── Inner canvas ───────────────────────────────────────────────────── */
function FunnelCanvas({
  visibleIds,
  onAddCard,
  onRemoveCard,
  dataMap,
  loadingMap,
  onInsight,
  planName,
}: FunnelFlowProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const { setEdges } = useReactFlow()

  /* Build nodes from visibleIds */
  const buildNodes = useCallback((): Node[] => {
    const positions = computePositions(visibleIds)
    return visibleIds.map(id => {
      const card = AVAILABLE_INTEGRATIONS.find(i => i.id === id)
      if (!card) return null
      const pos = positions[id] || { x: 20, y: 100 }
      const data = dataMap[id] || null
      const loading = loadingMap[id] || false
      const metrics = buildMetrics(id, data)
      return {
        id,
        type: 'integration',
        position: pos,
        data: {
          card,
          data,
          loading,
          metrics,
          planName,
          onRemove: () => onRemoveCard(id),
          onInsight: () => onInsight(id, data),
        },
      } as Node
    }).filter(Boolean) as Node[]
  }, [visibleIds, dataMap, loadingMap, onRemoveCard, onInsight, planName])

  /* Build edges between connected cards */
  const buildEdges = useCallback((): Edge[] => {
    const edges: Edge[] = []
    const hasData = (id: string) => !!dataMap[id]?.connected

    // Traffic → WhatsApp
    const trafficIds = visibleIds.filter(id => {
      const card = AVAILABLE_INTEGRATIONS.find(i => i.id === id)
      return card?.type === 'traffic'
    })
    if (visibleIds.includes('whatsapp')) {
      for (const src of trafficIds) {
        const card = AVAILABLE_INTEGRATIONS.find(i => i.id === src)
        const color = card?.color || '#60a5fa'
        edges.push(
          hasData(src)
            ? activeEdge(`${src}-wa`, src, 'whatsapp', color)
            : inactiveEdge(`${src}-wa`, src, 'whatsapp')
        )
      }
    }

    // WhatsApp → Checkouts
    const checkoutIds = visibleIds.filter(id => {
      const card = AVAILABLE_INTEGRATIONS.find(i => i.id === id)
      return card?.type === 'checkout'
    })
    if (visibleIds.includes('whatsapp')) {
      for (const tgt of checkoutIds) {
        const card = AVAILABLE_INTEGRATIONS.find(i => i.id === tgt)
        const color = card?.color || '#f97316'
        edges.push(
          hasData(tgt) || hasData('whatsapp')
            ? activeEdge(`wa-${tgt}`, 'whatsapp', tgt, color)
            : inactiveEdge(`wa-${tgt}`, 'whatsapp', tgt)
        )
      }
    }

    // Checkouts → Payments
    const paymentIds = visibleIds.filter(id => {
      const card = AVAILABLE_INTEGRATIONS.find(i => i.id === id)
      return card?.type === 'payment'
    })
    for (const checkout of checkoutIds) {
      for (const payment of paymentIds) {
        edges.push(
          activeEdge(`${checkout}-${payment}`, checkout, payment, '#10b981')
        )
      }
    }

    return edges
  }, [visibleIds, dataMap])

  const [nodes, setNodes, onNodesChange] = useNodesState(buildNodes())
  const [edges, setEdgesLocal, onEdgesChange] = useEdgesState(buildEdges())
  const { fitView } = useReactFlow()

  // Sync nodes when visibleIds or data changes
  useEffect(() => {
    setNodes(prev => {
      const fresh = buildNodes()
      // Preserve positions for existing nodes
      const freshMap = new Map(fresh.map(n => [n.id, n]))
      return fresh.map(n => {
        const old = prev.find(p => p.id === n.id)
        return old ? { ...n, position: old.position } : n
      })
    })
  }, [visibleIds, dataMap, loadingMap, buildNodes, setNodes])

  // Sempre que o conjunto de cards muda (inclusive no primeiro load),
  // reaplica o layout padrão e centraliza a visão — garante que o
  // dashboard abre sempre com os cards na mesma posição.
  useEffect(() => {
    const positions = computePositions(visibleIds)
    setNodes(prev => prev.map(n => (
      positions[n.id] ? { ...n, position: positions[n.id] } : n
    )))
    const t = setTimeout(() => fitView({ padding: 0.12 }), 60)
    return () => clearTimeout(t)
  }, [visibleIds, setNodes, fitView])

  // Sync edges
  useEffect(() => {
    setEdgesLocal(buildEdges())
  }, [visibleIds, dataMap, buildEdges, setEdgesLocal])

  const onConnect = useCallback(
    (connection: Connection) =>
      setEdgesLocal(eds => addEdge({
        ...connection,
        id: `${connection.source}-${connection.target}`,
        type: 'deletable',
        animated: true,
        style: { stroke: '#60a5fa', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#60a5fa' },
      }, eds)),
    [setEdgesLocal],
  )

  // Available integrations to add
  const available = AVAILABLE_INTEGRATIONS.filter(i => !visibleIds.includes(i.id))

  return (
    <div className="relative w-full h-[420px] sm:h-[520px] lg:h-[620px] rounded-2xl overflow-hidden border border-gray-700/50 shadow-2xl">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        minZoom={0.25}
        maxZoom={2}
        colorMode="dark"
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1.5}
          color="#4b5563"
        />
        <Controls
          className="!bg-gray-800 !border-gray-700 !shadow-xl [&>button]:!bg-gray-800 [&>button]:!border-gray-700 [&>button]:!text-gray-300 [&>button:hover]:!bg-gray-700"
          showInteractive={false}
        />
      </ReactFlow>

      <PlusButton onClick={() => setModalOpen(true)} />
      <AddCardModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        available={available}
        onSelect={onAddCard}
      />
    </div>
  )
}

export default function FunnelFlow(props: FunnelFlowProps) {
  return (
    <ReactFlowProvider>
      <FunnelCanvas {...props} />
    </ReactFlowProvider>
  )
}
