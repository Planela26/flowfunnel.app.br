/**
 * Configurações de alertas automáticos por usuário.
 * Persistido em User.alertSettings (JSON string).
 */

export type AlertRuleKey =
  | 'sales_drop_7d'
  | 'conversion_below_goal'
  | 'campaign_no_leads_24h'
  | 'spend_no_return_48h'

export type AlertSettings = Record<AlertRuleKey, boolean>

export const ALERT_RULES: Array<{
  key: AlertRuleKey
  label: string
  description: string
}> = [
  {
    key: 'sales_drop_7d',
    label: 'Queda de vendas',
    description: 'Avisa quando vendas caírem >30% nos últimos 7 dias vs. 7 dias anteriores',
  },
  {
    key: 'conversion_below_goal',
    label: 'Conversão abaixo da meta',
    description: 'Avisa quando a taxa de conversão (vendas/leads) ficar abaixo de 5%',
  },
  {
    key: 'campaign_no_leads_24h',
    label: 'Campanha sem leads',
    description: 'Avisa quando uma campanha ativa ficar 24h sem gerar leads',
  },
  {
    key: 'spend_no_return_48h',
    label: 'Gasto sem retorno',
    description: 'Avisa quando uma campanha tiver gasto >0 nas últimas 48h sem nenhuma venda',
  },
]

export const DEFAULT_ALERT_SETTINGS: AlertSettings = {
  sales_drop_7d: true,
  conversion_below_goal: true,
  campaign_no_leads_24h: true,
  spend_no_return_48h: true,
}

export function parseAlertSettings(raw: string | null | undefined): AlertSettings {
  if (!raw) return { ...DEFAULT_ALERT_SETTINGS }
  try {
    const parsed = JSON.parse(raw)
    const result = { ...DEFAULT_ALERT_SETTINGS }
    for (const key of Object.keys(DEFAULT_ALERT_SETTINGS) as AlertRuleKey[]) {
      if (typeof parsed?.[key] === 'boolean') result[key] = parsed[key]
    }
    return result
  } catch {
    return { ...DEFAULT_ALERT_SETTINGS }
  }
}

export function serializeAlertSettings(settings: Partial<AlertSettings>): string {
  const merged = { ...DEFAULT_ALERT_SETTINGS, ...settings }
  return JSON.stringify(merged)
}
