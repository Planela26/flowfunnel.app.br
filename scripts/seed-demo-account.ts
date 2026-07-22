import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const EMAIL = process.env.SEED_EMAIL || 'atriosouza13@gmail.com'
const DEMO_TAG = 'DEMO'

const NAMES = [
  'Lucas Almeida','Mariana Silva','Pedro Santos','Carla Souza','Rafael Lima',
  'Beatriz Costa','Gustavo Oliveira','Juliana Pereira','Felipe Rocha','Camila Ribeiro',
  'Bruno Martins','Ana Paula Mendes','Thiago Carvalho','Larissa Gomes','Diego Fernandes',
  'Patricia Araújo','Rodrigo Cardoso','Vanessa Teixeira','Marcelo Barros','Aline Ferreira',
  'Eduardo Vieira','Renata Castro','Fernando Dias','Letícia Moraes','André Cavalcanti',
  'Priscila Nogueira','Vinícius Pinto','Tatiane Moreira','Ricardo Machado','Daniela Freitas',
]

const PRODUCTS = [
  { name: 'Mentoria Funil de Alta Conversão', price: 497 },
  { name: 'Curso WhatsApp Vendas Pro', price: 297 },
  { name: 'Pacote Tráfego para Infoprodutores', price: 197 },
  { name: 'Aceleração Scale 30 dias', price: 997 },
]

const CITIES = ['São Paulo','Rio de Janeiro','Belo Horizonte','Curitiba','Porto Alegre','Recife','Salvador','Fortaleza','Goiânia','Manaus']

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function pick<T>(arr: T[]): T {
  return arr[rand(0, arr.length - 1)]
}
function phone(i: number) {
  const ddd = pick(['11','21','31','41','47','51','62','71','81','85'])
  const base = String(900000000 + ((i * 9173) % 99999999)).padStart(9, '0').slice(0, 9)
  return `55${ddd}${base}`
}

async function clearDemoData(userId: string) {
  // Apaga apenas dados marcados como DEMO; integrações DEMO levam por cascade os relacionamentos por config
  // Notifications/Goals/Campaigns/Workspaces/LeadStatus marcados via convenção
  await prisma.notification.deleteMany({ where: { userId, message: { contains: '[DEMO]' } } })
  await prisma.goal.deleteMany({ where: { userId, description: { contains: '[DEMO]' } } })
  await prisma.campaign.deleteMany({ where: { userId, name: { contains: '[DEMO]' } } })
  await prisma.workspace.deleteMany({ where: { userId, name: { contains: '[DEMO]' } } })
  await prisma.leadStatus.deleteMany({ where: { userId, notes: { contains: '[DEMO]' } } })
  await prisma.webhookLog.deleteMany({ where: { userId, endpoint: { contains: '/demo' } } })

  // Funnels DEMO -> apaga em cascata stages e events
  await prisma.funnel.deleteMany({ where: { userId, description: { contains: '[DEMO]' } } })

  // Integrations DEMO
  await prisma.integration.deleteMany({ where: { userId, nickname: DEMO_TAG } })
}

async function main() {
  const user = await prisma.user.findUnique({ where: { email: EMAIL } })
  if (!user) {
    console.error(`Usuário ${EMAIL} não encontrado. Crie a conta antes de rodar o seed.`)
    process.exit(1)
  }
  console.log(`Seedando dados DEMO para ${user.email} (id=${user.id})`)

  // Garante plano SCALE para liberar todas as visualizações
  await prisma.user.update({
    where: { id: user.id },
    data: { plan: 'SCALE', name: user.name || 'Atrio Souza' },
  })

  await clearDemoData(user.id)

  // ===== Integrations =====
  const metaIntegration = await prisma.integration.create({
    data: {
      userId: user.id,
      platform: 'META_ADS',
      nickname: DEMO_TAG,
      accessToken: 'DEMO_FB_TOKEN',
      isActive: true,
      isDefault: true,
      config: JSON.stringify({ adAccountId: '1234567890', demo: true, businessName: 'Atrio Souza Marketing' }),
    },
  })

  const waIntegration = await prisma.integration.create({
    data: {
      userId: user.id,
      platform: 'WHATSAPP',
      nickname: DEMO_TAG,
      accessToken: 'DEMO_WA_TOKEN',
      isActive: true,
      isDefault: true,
      config: JSON.stringify({
        phoneNumberId: '108912345678901',
        businessAccountId: 'BA_DEMO_ATRIO',
        displayName: 'Atrio Vendas',
        verifiedName: 'Atrio Souza',
        connected: true,
        demo: true,
      }),
    },
  })

  await prisma.integration.create({
    data: {
      userId: user.id,
      platform: 'KIWIFY',
      nickname: DEMO_TAG,
      accessToken: 'DEMO_KIWIFY_TOKEN',
      isActive: true,
      isDefault: true,
      config: JSON.stringify({ shop: 'atriosouza', demo: true }),
    },
  })

  await prisma.integration.create({
    data: {
      userId: user.id,
      platform: 'HOTMART',
      nickname: DEMO_TAG,
      accessToken: 'DEMO_HOTMART_TOKEN',
      isActive: true,
      isDefault: true,
      config: JSON.stringify({ producerId: 'atriosouza', demo: true }),
    },
  })

  await prisma.integration.create({
    data: {
      userId: user.id,
      platform: 'GOOGLE_ADS',
      nickname: DEMO_TAG,
      accessToken: 'DEMO_GADS_TOKEN',
      isActive: true,
      isDefault: true,
      config: JSON.stringify({ customerId: '987-654-3210', demo: true, businessName: 'Atrio Souza Marketing' }),
    },
  })

  await prisma.integration.create({
    data: {
      userId: user.id,
      platform: 'TIKTOK_ADS',
      nickname: DEMO_TAG,
      accessToken: 'DEMO_TT_TOKEN',
      isActive: true,
      isDefault: true,
      config: JSON.stringify({ advertiserId: 'TT_ADV_98765', demo: true, businessName: 'Atrio Souza Marketing' }),
    },
  })

  // ===== Campaign =====
  const campaign = await prisma.campaign.create({
    data: {
      userId: user.id,
      platform: 'META_ADS',
      campaignId: 'demo_camp_001',
      name: 'Campanha Lançamento Mentoria [DEMO]',
      status: 'ACTIVE',
      isActive: true,
      isDefault: true,
      objective: 'CONVERSIONS',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      budget: 5000,
      spend: 0, // será atualizado abaixo
    },
  })

  // ===== Workspace =====
  await prisma.workspace.create({
    data: {
      userId: user.id,
      name: 'Workspace Principal [DEMO]',
      emoji: '🚀',
      isDefault: true,
      whatsappIntegrationId: waIntegration.id,
      facebookCampaignId: campaign.id,
    },
  })

  // ===== Funnel & Stages =====
  const funnel = await prisma.funnel.create({
    data: {
      userId: user.id,
      name: 'Funil Mentoria Atrio',
      description: 'Funil completo Meta Ads → WhatsApp → Kiwify [DEMO]',
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      isActive: true,
      stages: {
        create: [
          { name: 'Clique no Anúncio', order: 1 },
          { name: 'Abriu WhatsApp', order: 2 },
          { name: 'Primeira Mensagem', order: 3 },
          { name: 'Conversa Qualificada', order: 4 },
          { name: 'Pediu Link', order: 5 },
          { name: 'Checkout Iniciado', order: 6 },
          { name: 'Pagamento Aprovado', order: 7 },
        ],
      },
    },
    include: { stages: true },
  })

  const stageByOrder = new Map(funnel.stages.map((s) => [s.order, s]))

  // ===== Eventos diários por 30 dias =====
  const events: any[] = []
  const webhookLogs: any[] = []
  const leadStatuses: { phone: string; name: string; email: string; stage: string; notes: string }[] = []

  let totalSpend = 0
  let totalRevenue = 0
  let totalSales = 0
  let leadCounter = 0

  for (let d = 30; d >= 0; d--) {
    const date = new Date(Date.now() - d * 24 * 60 * 60 * 1000)
    // Variação por dia (final de semana mais fraco)
    const weekend = [0, 6].includes(date.getDay())
    const dailyClicks = weekend ? rand(60, 110) : rand(110, 180)
    const dailyWhatsAppOpeners = weekend ? rand(18, 42) : rand(35, 68)
    const dailyHotmartCheckouts = weekend ? rand(6, 14) : rand(12, 28)

    // Cliques de Google e TikTok (independentes — alimentam apenas KPIs por fonte)
    const googleClicks = weekend ? rand(35, 65) : rand(70, 120)
    const tiktokClicks = weekend ? rand(45, 80) : rand(90, 150)

    for (let c = 0; c < googleClicks; c++) {
      const cost = +(Math.random() * 1.6 + 0.6).toFixed(2)
      const ts = new Date(date.getTime() + rand(0, 23) * 3600 * 1000 + rand(0, 59) * 60 * 1000)
      events.push({
        funnelId: funnel.id,
        stageId: stageByOrder.get(1)!.id,
        eventType: 'google_click',
        metadata: JSON.stringify({ cost, spend: cost, impressions: rand(15, 28), source: 'google_ads' }),
        timestamp: ts,
      })
      if (Math.random() < 0.3) {
        webhookLogs.push({
          userId: user.id,
          platform: 'GOOGLE_ADS',
          event: 'click',
          method: 'POST',
          endpoint: '/api/webhooks/google/demo',
          payload: JSON.stringify({ customerId: '987-654-3210', cost }),
          statusCode: 200,
          createdAt: ts,
        })
      }
    }

    for (let c = 0; c < tiktokClicks; c++) {
      const cost = +(Math.random() * 0.9 + 0.3).toFixed(2)
      const ts = new Date(date.getTime() + rand(0, 23) * 3600 * 1000 + rand(0, 59) * 60 * 1000)
      events.push({
        funnelId: funnel.id,
        stageId: stageByOrder.get(1)!.id,
        eventType: 'tiktok_click',
        metadata: JSON.stringify({ cost, spend: cost, impressions: rand(20, 40), source: 'tiktok_ads' }),
        timestamp: ts,
      })
      if (Math.random() < 0.3) {
        webhookLogs.push({
          userId: user.id,
          platform: 'TIKTOK_ADS',
          event: 'click',
          method: 'POST',
          endpoint: '/api/webhooks/tiktok/demo',
          payload: JSON.stringify({ advertiserId: 'TT_ADV_98765', cost }),
          statusCode: 200,
          createdAt: ts,
        })
      }
    }

    let dayClicks = 0
    let dayWaOpens = 0
    let dayConversations = 0
    let dayQualified = 0
    let dayLinks = 0
    let dayCheckouts = 0
    let daySales = 0

    for (let c = 0; c < dailyClicks; c++) {
      const cost = +(Math.random() * 1.2 + 0.4).toFixed(2)
      const ts = new Date(date.getTime() + rand(0, 23) * 3600 * 1000 + rand(0, 59) * 60 * 1000)
      totalSpend += cost
      dayClicks++
      events.push({
        funnelId: funnel.id,
        stageId: stageByOrder.get(1)!.id,
        eventType: 'facebook_click',
        metadata: JSON.stringify({ cost, spend: cost, impressions: rand(12, 22), campaignId: campaign.campaignId }),
        timestamp: ts,
      })

      // WebhookLog Meta
      if (Math.random() < 0.6) {
        webhookLogs.push({
          userId: user.id,
          platform: 'META_ADS',
          event: 'click',
          method: 'POST',
          endpoint: '/api/webhooks/meta/demo',
          payload: JSON.stringify({ campaignId: campaign.campaignId, cost }),
          statusCode: 200,
          createdAt: ts,
        })
      }

      // ~28% abrem WhatsApp
      if (Math.random() < 0.28 || dayWaOpens < dailyWhatsAppOpeners) {
        dayWaOpens++
        events.push({
          funnelId: funnel.id,
          stageId: stageByOrder.get(2)!.id,
          eventType: 'whatsapp_click',
          metadata: JSON.stringify({}),
          timestamp: new Date(ts.getTime() + rand(1, 30) * 60000),
        })

        // ~70% iniciam conversa
        if (Math.random() < 0.7) {
          leadCounter++
          dayConversations++
          const leadPhone = phone(leadCounter)
          const leadName = pick(NAMES)
          const interactionsCount = rand(2, 8)
          const interactions = Array.from({ length: interactionsCount }).map((_, i) => {
            const isInbound = i % 2 === 0
            const at = new Date(ts.getTime() + (i + 1) * (isInbound ? 5 : rand(1, 8)) * 60000).toISOString()
            return {
              direction: isInbound ? 'inbound' : 'outbound',
              from: isInbound ? 'lead' : 'agent',
              text: isInbound ? 'mensagem do lead' : 'resposta',
              timestamp: at,
              at,
            }
          })
          const lastInteraction = interactions[interactions.length - 1].timestamp

          events.push({
            funnelId: funnel.id,
            stageId: stageByOrder.get(3)!.id,
            eventType: 'whatsapp_conversation_started',
            metadata: JSON.stringify({
              phoneNumberId: '108912345678901',
              from: leadPhone,
              name: leadName,
              interactions,
              lastInteraction,
            }),
            timestamp: new Date(ts.getTime() + rand(2, 60) * 60000),
          })

          webhookLogs.push({
            userId: user.id,
            platform: 'WHATSAPP',
            event: 'message',
            method: 'POST',
            endpoint: '/api/webhooks/whatsapp/demo',
            payload: JSON.stringify({ phone: leadPhone, name: leadName, contact: { profile: { name: leadName } }, city: pick(CITIES) }),
            statusCode: 200,
            createdAt: new Date(ts.getTime() + rand(2, 60) * 60000),
          })

          let leadFinalStage = 'NOVO'

          // ~50% qualificadas
          if (interactionsCount >= 4) {
            dayQualified++
            leadFinalStage = 'QUALIFICADO'
            events.push({
              funnelId: funnel.id,
              stageId: stageByOrder.get(4)!.id,
              eventType: 'whatsapp_qualified',
              metadata: JSON.stringify({ phone: leadPhone }),
              timestamp: new Date(ts.getTime() + rand(60, 180) * 60000),
            })

            // ~40% pediram link
            if (Math.random() < 0.4) {
              dayLinks++
              leadFinalStage = 'INTERESSADO'
              events.push({
                funnelId: funnel.id,
                stageId: stageByOrder.get(5)!.id,
                eventType: 'link_requested',
                metadata: JSON.stringify({ phone: leadPhone }),
                timestamp: new Date(ts.getTime() + rand(120, 240) * 60000),
              })

              // ~75% iniciaram checkout
              if (Math.random() < 0.75 || dayCheckouts < dailyHotmartCheckouts) {
                dayCheckouts++
                const product = pick(PRODUCTS)
                const isHotmart = Math.random() < 0.5
                const platform = isHotmart ? 'HOTMART' : 'KIWIFY'
                const checkoutEv = isHotmart ? 'hotmart_checkout_started' : 'kiwify_checkout_started'
                const purchaseEv = isHotmart ? 'hotmart_purchase_complete' : 'kiwify_purchase_complete'
                const checkoutAt = new Date(ts.getTime() + rand(180, 360) * 60000)
                events.push({
                  funnelId: funnel.id,
                  stageId: stageByOrder.get(6)!.id,
                  eventType: checkoutEv,
                  metadata: JSON.stringify({ product: product.name, amount: product.price, price: product.price, phone: leadPhone }),
                  timestamp: checkoutAt,
                })
                const buyerEmail = `${leadName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`
                webhookLogs.push({
                  userId: user.id,
                  platform,
                  event: 'checkout_started',
                  method: 'POST',
                  endpoint: `/api/webhooks/${platform.toLowerCase()}/demo`,
                  payload: JSON.stringify(
                    isHotmart
                      ? {
                          buyer: { name: leadName, phone: leadPhone, email: buyerEmail },
                          product: { name: product.name },
                          purchase: { price: { value: product.price } },
                        }
                      : {
                          Customer: { full_name: leadName, mobile: leadPhone, email: buyerEmail },
                          Product: { name: product.name },
                          Order: { charge_amount: product.price },
                        },
                  ),
                  statusCode: 200,
                  createdAt: checkoutAt,
                })
                leadFinalStage = 'CHECKOUT'

                // ~55% concluíram pagamento
                if (Math.random() < 0.55) {
                  daySales++
                  totalSales++
                  totalRevenue += product.price
                  const paidAt = new Date(checkoutAt.getTime() + rand(2, 30) * 60000)
                  events.push({
                    funnelId: funnel.id,
                    stageId: stageByOrder.get(7)!.id,
                    eventType: purchaseEv,
                    metadata: JSON.stringify({
                      product: product.name,
                      amount: product.price,
                      price: product.price,
                      phone: leadPhone,
                      name: leadName,
                      status: 'paid',
                    }),
                    timestamp: paidAt,
                  })
                  webhookLogs.push({
                    userId: user.id,
                    platform,
                    event: 'purchase_complete',
                    method: 'POST',
                    endpoint: `/api/webhooks/${platform.toLowerCase()}/demo`,
                    payload: JSON.stringify(
                      isHotmart
                        ? {
                            buyer: { name: leadName, phone: leadPhone, email: buyerEmail },
                            product: { name: product.name },
                            purchase: { price: { value: product.price }, status: 'APPROVED' },
                          }
                        : {
                            Customer: { full_name: leadName, mobile: leadPhone, email: buyerEmail },
                            Product: { name: product.name },
                            Order: { charge_amount: product.price, status: 'paid' },
                          },
                    ),
                    statusCode: 200,
                    createdAt: paidAt,
                  })
                  leadFinalStage = 'CLIENTE'
                }
              }
            }
          }

          leadStatuses.push({
            phone: leadPhone,
            name: leadName,
            email: `${leadName.toLowerCase().replace(/\s+/g, '.')}@gmail.com`,
            stage: leadFinalStage,
            notes: `[DEMO] Cidade: ${pick(CITIES)} • Origem: ${pick(['Meta Ads','Meta Ads','Meta Ads','Meta Ads','Google Ads','Google Ads','TikTok Ads','TikTok Ads','Direto'])}`,
          })
        }
      }
    }
    // Log resumo do dia (apenas no console)
    if (d <= 7) {
      console.log(
        `D-${d}: clicks=${dayClicks} wa=${dayWaOpens} conv=${dayConversations} quali=${dayQualified} link=${dayLinks} chk=${dayCheckouts} vendas=${daySales}`
      )
    }
  }

  // Inserir em chunks (Postgres tem limite de parâmetros)
  const chunk = <T,>(arr: T[], size: number) =>
    Array.from({ length: Math.ceil(arr.length / size) }, (_, i) => arr.slice(i * size, i * size + size))

  for (const part of chunk(events, 1000)) {
    await prisma.funnelEvent.createMany({ data: part })
  }
  for (const part of chunk(webhookLogs, 1000)) {
    await prisma.webhookLog.createMany({ data: part })
  }

  // LeadStatus únicos por phone (já é unique por userId+phone)
  const seen = new Set<string>()
  const dedupLeads = leadStatuses.filter((l) => {
    if (seen.has(l.phone)) return false
    seen.add(l.phone)
    return true
  })
  for (const part of chunk(dedupLeads, 500)) {
    await prisma.leadStatus.createMany({
      data: part.map((l) => ({ ...l, userId: user.id })),
      skipDuplicates: true,
    })
  }

  // Atualiza spend da campanha
  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { spend: +totalSpend.toFixed(2), lastSyncedAt: new Date() },
  })

  // ===== Goals =====
  const monthEnd = new Date()
  monthEnd.setMonth(monthEnd.getMonth() + 1)
  await prisma.goal.createMany({
    data: [
      {
        userId: user.id,
        title: 'Faturar R$ 50.000 no mês',
        description: '[DEMO] Meta de receita mensal de mentorias',
        targetValue: 50000,
        currentValue: Math.min(50000, +totalRevenue.toFixed(2)),
        metric: 'revenue',
        platform: 'ALL',
        endDate: monthEnd,
      },
      {
        userId: user.id,
        title: '500 leads qualificados no mês',
        description: '[DEMO] Leads vindos do funil WhatsApp',
        targetValue: 500,
        currentValue: Math.min(500, dedupLeads.length),
        metric: 'leads',
        platform: 'WHATSAPP',
        endDate: monthEnd,
      },
      {
        userId: user.id,
        title: '80 vendas Kiwify',
        description: '[DEMO] Vendas confirmadas via Kiwify',
        targetValue: 80,
        currentValue: Math.min(80, totalSales),
        metric: 'sales',
        platform: 'ALL',
        endDate: monthEnd,
      },
    ],
  })

  // ===== Notifications =====
  await prisma.notification.createMany({
    data: [
      {
        userId: user.id,
        type: 'info',
        title: 'Bem-vindo ao FlowFunnel',
        message: '[DEMO] Sua conta está populada com dados de demonstração.',
      },
      {
        userId: user.id,
        type: 'goal_completed',
        title: 'Meta diária batida',
        message: `[DEMO] Você bateu sua meta diária de leads hoje (${dedupLeads.length} leads no período).`,
        link: '/goals',
      },
      {
        userId: user.id,
        type: 'warning',
        title: 'Conversa parada há mais de 24h',
        message: '[DEMO] Você tem leads quentes sem resposta há mais de 24 horas.',
        link: '/leads',
      },
      {
        userId: user.id,
        type: 'info',
        title: 'Nova venda Kiwify',
        message: `[DEMO] R$ ${totalRevenue.toFixed(2)} faturados nos últimos 30 dias.`,
        link: '/reports',
      },
    ],
  })

  console.log('\n=== Resumo ===')
  console.log(`Eventos do funil: ${events.length}`)
  console.log(`Webhook logs:     ${webhookLogs.length}`)
  console.log(`Leads únicos:     ${dedupLeads.length}`)
  console.log(`Vendas:           ${totalSales}`)
  console.log(`Receita:          R$ ${totalRevenue.toFixed(2)}`)
  console.log(`Gasto Meta:       R$ ${totalSpend.toFixed(2)}`)
  console.log(`ROI:              ${(((totalRevenue - totalSpend) / Math.max(totalSpend, 1)) * 100).toFixed(1)}%`)
  console.log('Pronto. Login com', EMAIL, 'para visualizar.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
