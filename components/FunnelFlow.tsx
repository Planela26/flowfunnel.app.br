'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  userId?: string
  /** Funil aberto. As posições são POR FUNIL — ver getPosKey. */
  workspaceId?: string | null
}

/* ─── Persistência de posições ────────────────────────────────────────
 * Fonte da verdade: banco de dados (via /api/funnel-layout) → sincroniza
 * entre navegadores e dispositivos. localStorage é só cache local para
 * o primeiro render ser instantâneo. */
// A chave inclui o FUNIL. Antes era só o usuário: dois funis liam e escreviam
// o mesmo cache, então arrastar um card num funil movia o card do outro.
const getPosKey = (userId: string, workspaceId?: string | null) =>
  `funnel_positions_${userId}_${workspaceId ?? 'conta'}`

type SavedPositions = Record<string, { x: number; y: number }>

function loadSavedPositions(userId: string, workspaceId?: string | null): SavedPositions | null {
  try {
    const raw = localStorage.getItem(getPosKey(userId, workspaceId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') return parsed
  } catch { /* ignore */ }
  return null
}

function cachePositionsLocally(userId: string, pos: SavedPositions, workspaceId?: string | null) {
  try {
    localStorage.setItem(getPosKey(userId, workspaceId), JSON.stringify(pos))
  } catch { /* ignore */ }
}

async function fetchServerPositions(workspaceId?: string | null): Promise<SavedPositions | null> {
  try {
    const res = await fetch(
      `/api/funnel-layout${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ''}`,
      { cache: 'no-store' },
    )
    if (!res.ok) return null
    const data = await res.json()
    if (data?.positions && typeof data.positions === 'object') return data.positions
  } catch { /* ignore */ }
  return null
}

async function saveServerPositions(pos: SavedPositions, workspaceId?: string | null): Promise<boolean> {
  try {
    const res = await fetch('/api/funnel-layout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ positions: pos, workspaceId }),
    })
    return res.ok
  } catch {
    return false
  }
}

function nodesToPositions(nodes: Node[]): SavedPositions {
  const pos: SavedPositions = {}
  for (const n of nodes) pos[n.id] = n.position
  return pos
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
  const isTracking = card.type === 'tracking'
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

  // Lê `d.metrics` — o array montado por buildMetrics() e injetado no node por
  // buildNodes(). Antes lia `d.data?.metrics`, ou seja, um campo `metrics`
  // DENTRO da resposta da API — que nenhuma rota devolve. O resultado era
  // sempre `undefined || []`, um array vazio (e portanto truthy): a grade
  // renderizava sem nenhuma célula e o rodapé aparecia como se houvesse dados.
  // Na prática, NENHUM card mostrava números, e buildMetrics() — 70 linhas —
  // nunca teve efeito.
  const metrics = (d.metrics as any[] | null) ?? null
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
            {isTraffic ? 'Tráfego' : isTracking ? 'Rastreamento' : isCheckout ? 'Checkout' : isPayment ? 'Pagamento' : isCrm ? 'CRM' : 'Integração'}
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
          <>
            <div className="grid grid-cols-2 gap-1.5">
              {metrics.map((m: any, i: number) => (
                <div key={i} className="bg-gray-800/60 rounded-lg p-1.5">
                  <div className="text-[9px] text-gray-500 uppercase tracking-wide">{m.label}</div>
                  <div className="text-xs font-bold text-white">{m.value}</div>
                </div>
              ))}
            </div>
            {/* Seis zeros podem significar "não vendeu nada" ou "nenhum evento
                chegou ainda" — e o card afirmava a primeira sempre. A rota agora
                distingue os dois casos, e aqui o card diz qual é. */}
            {d.data?.aguardandoPrimeiroEvento && (
              <p className="mt-2 text-[9px] leading-tight text-gray-500">
                Nenhum evento recebido nesta janela ainda. Webhook não é retroativo:
                só chegam vendas feitas depois de configurá-lo.
              </p>
            )}
            {/* Se o card está ou não filtrado por produto precisa ser visível
                AQUI. Sem isso, "mostra as vendas do outro funil" e "este funil
                não tem filtro" são a mesma tela, e a única forma de distinguir
                era abrir o DevTools. */}
            {d.data?.filtroDoFunil && (
              <p className="mt-2 text-[9px] leading-tight text-gray-500">
                {d.data.filtroDoFunil.por === 'link' ? (
                  <>Só quem chegou pelo link rastreável deste funil.</>
                ) : d.data.filtroDoFunil.por === 'campanha' ? (
                  <>Só os visitantes da campanha {d.data.filtroDoFunil.campanha}.</>
                ) : (
                  <span className="text-amber-500/90">
                    Sem link vinculado — mostrando os visitantes da conta inteira.
                    Marque o link rastreável em Editar Funil para separar.
                  </span>
                )}
              </p>
            )}
            {d.data?.filtroDeProdutos && (
              <p className="mt-2 text-[9px] leading-tight text-gray-500">
                {d.data.filtroDeProdutos.aplicado ? (
                  <>
                    Filtrado por {d.data.filtroDeProdutos.produtos.length}{' '}
                    {d.data.filtroDeProdutos.produtos.length === 1 ? 'produto' : 'produtos'}
                    {' '}({d.data.filtroDeProdutos.produtos.join(', ')}).
                  </>
                ) : (
                  <span className="text-amber-500/90">
                    Sem produto vinculado — mostrando a conta inteira. Abra Editar Funil
                    e cole o ID do produto deste funil.
                  </span>
                )}
              </p>
            )}
          </>
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
                {/* Conectado, mas a leitura falhou, é diferente de nunca ter
                    conectado. Dizer "nenhuma conta conectada" para quem tem a
                    conta ligada manda a pessoa refazer o que já está feito. */}
                {d.data?.erro
                  ? 'Não foi possível carregar'
                  : d.data?.error
                  ? 'Não foi possível ler na Meta'
                  : isTraffic ? 'Nenhuma conta conectada' : isTracking ? 'Sem dados disponíveis' : 'Integração não ativa'}
              </p>
              <p className="text-[9px] text-gray-500 leading-tight">
                {/* `erro` vem das rotas que respondem 200 descrevendo a falha —
                    convidar a pessoa a instalar um rastreamento que já existe é
                    pior do que admitir que a leitura falhou. */}
                {d.data?.erro
                  ? (d.data.mensagem || 'A leitura falhou. Tente recarregar a página.')
                  : d.data?.error
                  ? 'O token pode ter expirado. Reconecte a conta de anúncios.'
                  : isTraffic
                  ? 'Conecte para ver cliques, leads e gastos no funil'
                  : isTracking
                  ? 'Gere um link rastreável para ver visitantes e origem'
                  : card.type === 'funnel'
                  ? 'Conecte para ver conversas e qualificação'
                  : 'Conecte para ver checkouts e faturamento'}
              </p>
            </div>

            {/* CTA button */}
            {/* Com falha de leitura o CTA some: "Configurar rastreamento" numa
                conta que já rastreia manda refazer o que está feito. */}
            {card.connectHref && !d.data?.erro && (
              <Link
                href={card.connectHref}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-[10px] font-bold text-white transition hover:opacity-90 active:scale-95"
                style={{ backgroundColor: c }}
              >
                <Plus className="w-3 h-3" />
                {isTraffic
                  ? 'Adicionar conta'
                  : isTracking
                  ? 'Configurar rastreamento'
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

      {/* Saída: tráfego, rastreamento e funil. A Landing Page tem as DUAS
          pontas — recebe do anúncio e entrega ao WhatsApp ou ao checkout. */}
      {(isTraffic || isTracking || card.type === 'funnel') && (
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
// A Landing Page entra numa coluna própria entre o tráfego e o funil — é a
// ordem real da jornada (anúncio → página → WhatsApp → checkout). As colunas
// seguintes deslocam para abrir espaço.
const COL_X = {
  traffic: 20,
  tracking: 360,
  funnel: 700,
  checkout: 1040,
  payment: 1040,
  crm: 1380,
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
      // Falha de leitura NÃO vira "0 cliques". Com `error`, os zeros da resposta
      // são de preenchimento, não medição — mostrá-los faz o card afirmar que a
      // campanha não teve movimento quando na verdade ninguém conseguiu olhar.
      // Devolvendo null, o card cai no estado vazio, que explica o motivo.
      if (data.error) return null
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
      // Ordem pela pergunta que a pessoa faz ao olhar um card de checkout:
      // quantas vendas, quanto entrou, quanto vale cada uma. "Confirmados"
      // vinha em terceiro e não dizia confirmados DE QUÊ — o número que
      // importa não pode depender de interpretação.
      return [
        { label: 'Vendas', value: data.pagamentosConfirmados || 0 },
        { label: 'Faturamento', value: data.faturamento || '—' },
        { label: 'Ticket Médio', value: data.ticketMedio || '—' },
        { label: 'Taxa Conv.', value: data.taxaConversaoCheckout || '—' },
        { label: 'Checkouts', value: data.checkoutsIniciados || 0 },
        // Aguardando pagamento é diferente de abandonado — um ainda pode virar
        // venda, o outro já não vira — e os dois estavam somados num número só.
        // Só a Hotmart separa os dois hoje; Eduzz e Monetizze contam apenas
        // abandono, e para elas rotular "Aguardando: 0" seria afirmar algo que
        // a rota não mediu.
        data.checkoutsAguardando != null
          ? { label: 'Aguardando', value: data.checkoutsAguardando }
          : { label: 'Abandonados', value: data.checkoutsNaoTerminados ?? 0 },
      ]
    case 'stripe':
      return [
        { label: 'Transações', value: data.transactions || 0 },
        { label: 'Faturamento', value: data.revenue || '—' },
        { label: 'Reembolsos', value: data.refunds || 0 },
        { label: 'Taxa Reemb.', value: data.refundRate || '—' },
      ]
    case 'landing':
      // Compacto de propósito: seis números que respondem "está funcionando?".
      // O detalhe (origem por canal, cliques por tipo) aparece ao clicar.
      return [
        { label: 'Visitantes', value: (data.visitantes ?? 0).toLocaleString('pt-BR') },
        { label: 'Sessões', value: (data.sessoes ?? 0).toLocaleString('pt-BR') },
        { label: 'Leads', value: (data.leads ?? 0).toLocaleString('pt-BR') },
        { label: 'Conversões', value: (data.conversoes ?? 0).toLocaleString('pt-BR') },
        { label: 'Taxa Conv.', value: data.taxaConversao || '—' },
        { label: 'Origem', value: data.origemPrincipal || '—' },
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
  userId,
  workspaceId,
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

    const trafficIds = visibleIds.filter(id => {
      const card = AVAILABLE_INTEGRATIONS.find(i => i.id === id)
      return card?.type === 'traffic'
    })

    // A Landing Page, quando presente, ENTRA NO MEIO da cadeia: o anúncio leva
    // à página, e é a página que leva ao WhatsApp ou direto ao checkout. É a
    // ordem real da jornada — antes o tráfego apontava direto para o WhatsApp,
    // como se ninguém passasse por uma página.
    const temLanding = visibleIds.includes('landing')
    const temWhats = visibleIds.includes('whatsapp')

    // Tráfego → (Landing Page | WhatsApp)
    const alvoDoTrafego = temLanding ? 'landing' : temWhats ? 'whatsapp' : null
    if (alvoDoTrafego) {
      for (const src of trafficIds) {
        const card = AVAILABLE_INTEGRATIONS.find(i => i.id === src)
        const color = card?.color || '#60a5fa'
        const id = `${src}-${alvoDoTrafego}`
        edges.push(
          hasData(src)
            ? activeEdge(id, src, alvoDoTrafego, color)
            : inactiveEdge(id, src, alvoDoTrafego)
        )
      }
    }

    // Landing Page → WhatsApp
    if (temLanding && temWhats) {
      const cor = AVAILABLE_INTEGRATIONS.find(i => i.id === 'landing')?.color || '#06b6d4'
      edges.push(
        hasData('landing')
          ? activeEdge('landing-wa', 'landing', 'whatsapp', cor)
          : inactiveEdge('landing-wa', 'landing', 'whatsapp')
      )
    }

    // WhatsApp → Checkouts
    const checkoutIds = visibleIds.filter(id => {
      const card = AVAILABLE_INTEGRATIONS.find(i => i.id === id)
      return card?.type === 'checkout'
    })
    if (temWhats) {
      for (const tgt of checkoutIds) {
        const card = AVAILABLE_INTEGRATIONS.find(i => i.id === tgt)
        const color = card?.color || '#f97316'
        edges.push(
          hasData(tgt) || hasData('whatsapp')
            ? activeEdge(`wa-${tgt}`, 'whatsapp', tgt, color)
            : inactiveEdge(`wa-${tgt}`, 'whatsapp', tgt)
        )
      }
    } else if (temLanding) {
      // Sem WhatsApp na jornada, a página entrega direto ao checkout:
      // Meta Ads → Landing Page → Hotmart.
      for (const tgt of checkoutIds) {
        const card = AVAILABLE_INTEGRATIONS.find(i => i.id === tgt)
        const color = card?.color || '#f97316'
        edges.push(
          hasData(tgt) || hasData('landing')
            ? activeEdge(`landing-${tgt}`, 'landing', tgt, color)
            : inactiveEdge(`landing-${tgt}`, 'landing', tgt)
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

  // Monta nodes iniciais: usa posições salvas do usuário, senão usa layout padrão
  const initialNodes = useCallback(() => {
    const fresh = buildNodes()
    const saved = userId ? loadSavedPositions(userId, workspaceId) : null
    if (!saved) return fresh
    return fresh.map(n => saved[n.id] ? { ...n, position: saved[n.id] } : n)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes())
  const [edges, setEdgesLocal, onEdgesChange] = useEdgesState(buildEdges())
  const { fitView } = useReactFlow()
  const isMountedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'pending' | 'saved' | 'error'>('idle')
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hasLocalEditsRef = useRef(false)   // usuário moveu algo nesta sessão
  const nodesRef = useRef<Node[]>([])      // snapshot p/ flush no unmount
  // A atribuição acontecia direto no corpo do componente, durante o render.
  // Escrever em ref no render quebra com renderização concorrente: renders
  // descartados também gravavam, e o snapshot podia refletir um estado que
  // nunca chegou à tela. No efeito, só render que foi de fato aplicado grava —
  // e para o flush no unmount isso é o que se quer.
  useEffect(() => { nodesRef.current = nodes }, [nodes])

  // Centraliza a visão no primeiro render
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.12 }), 100)
    return () => clearTimeout(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Busca posições do servidor (fonte da verdade) e aplica — sincroniza entre navegadores.
  // Se o usuário já começou a mover cards antes da resposta chegar, NÃO sobrescreve.
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetchServerPositions(workspaceId).then(serverPos => {
      if (cancelled || !serverPos || Object.keys(serverPos).length === 0) return
      if (hasLocalEditsRef.current) return // usuário já mexeu → local vence
      cachePositionsLocally(userId, serverPos, workspaceId)
      setNodes(prev => prev.map(n => serverPos[n.id] ? { ...n, position: serverPos[n.id] } : n))
      setTimeout(() => fitView({ padding: 0.12 }), 50)
    })
    return () => { cancelled = true }
  }, [userId, workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Flush: se sair da página com save pendente, salva imediatamente
  useEffect(() => {
    if (!userId) return
    const flush = () => {
      if (!hasLocalEditsRef.current) return
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      const pos = nodesToPositions(nodesRef.current)
      cachePositionsLocally(userId, pos, workspaceId)
      // Usa fetch keepalive em vez de sendBeacon com application/json,
      // porque sendBeacon ignora o Content-Type no Opera/Firefox e o servidor
      // não consegue fazer req.json() — o fetch keepalive funciona em todos os browsers.
      try {
        fetch('/api/funnel-layout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ positions: pos, workspaceId }),
          keepalive: true,
        }).catch(() => {})
      } catch { /* ignore */ }
    }
    window.addEventListener('pagehide', flush)
    return () => {
      window.removeEventListener('pagehide', flush)
      flush() // unmount (navegação interna Next.js) também salva
    }
  }, [userId, workspaceId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Quando dados mudam (loading/data), reconstrói nodes preservando posições atuais
  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true
      return
    }
    setNodes(prev => {
      const fresh = buildNodes()
      return fresh.map(n => {
        const old = prev.find(p => p.id === n.id)
        return old ? { ...n, position: old.position } : n
      })
    })
  }, [dataMap, loadingMap]) // eslint-disable-line react-hooks/exhaustive-deps

  // Quando cards são adicionados/removidos, aplica posição salva (ou padrão para novos)
  useEffect(() => {
    setNodes(prev => {
      const fresh = buildNodes()
      const saved = userId ? loadSavedPositions(userId, workspaceId) : null
      return fresh.map(n => {
        // Card já estava na tela: mantém posição atual (onde o usuário deixou)
        const existing = prev.find(p => p.id === n.id)
        if (existing) return { ...n, position: existing.position }
        // Card novo: usa posição salva ou calcula padrão
        if (saved?.[n.id]) return { ...n, position: saved[n.id] }
        return n
      })
    })
  }, [visibleIds]) // eslint-disable-line react-hooks/exhaustive-deps

  // Detecta início de drag para mostrar indicador "salvando…"
  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes)
    const startedDrag = changes.some((c: any) => c.type === 'position' && c.dragging === true)
    if (!startedDrag || !userId) return
    hasLocalEditsRef.current = true
    setSaveStatus('pending')
  }, [onNodesChange, userId])

  // Salva imediatamente ao soltar o card — mais confiável que debounce e funciona
  // em todos os browsers (Chrome, Firefox, Opera, Safari) sem depender de timers.
  const handleNodeDragStop = useCallback((_event: React.MouseEvent, _node: Node) => {
    if (!userId) return
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }
    if (savedTimerRef.current) { clearTimeout(savedTimerRef.current); savedTimerRef.current = null }

    setNodes(current => {
      const pos = nodesToPositions(current)
      cachePositionsLocally(userId, pos, workspaceId)
      saveServerPositions(pos, workspaceId).then(ok => {
        setSaveStatus(ok ? 'saved' : 'error')
        savedTimerRef.current = setTimeout(() => setSaveStatus('idle'), ok ? 3000 : 5000)
      })
      return current
    })
  }, [userId, setNodes])

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
    <div className="relative w-full h-[360px] sm:h-[520px] lg:h-[620px] rounded-2xl overflow-hidden border border-gray-700/50 shadow-2xl">

      {/* Indicador de auto-save */}
      {saveStatus !== 'idle' && (
        <div className={`
          absolute top-3 right-3 z-50 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
          shadow-lg border transition-all duration-300
          ${saveStatus === 'pending'
            ? 'bg-gray-800/90 border-gray-600 text-gray-400'
            : saveStatus === 'error'
              ? 'bg-red-900/90 border-red-600 text-red-300'
              : 'bg-emerald-900/90 border-emerald-600 text-emerald-300'}
        `}>
          {saveStatus === 'pending' ? (
            <>
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z"/>
              </svg>
              Salvando…
            </>
          ) : saveStatus === 'error' ? (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
              Erro ao salvar — tente de novo
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/>
              </svg>
              Layout salvo
            </>
          )}
        </div>
      )}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onNodeDragStop={handleNodeDragStop}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
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

/* fb-rebuild-trigger 1784939961 */
