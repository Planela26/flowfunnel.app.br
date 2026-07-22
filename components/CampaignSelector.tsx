'use client'

import { useEffect, useState, useCallback } from 'react'

interface Campaign {
  id: string
  campaignId: string
  name: string
  status: string
  isActive: boolean
  isDefault: boolean
  objective?: string
  budget?: number
  spend: number
}

interface CampaignSelectorProps {
  onSelectCampaign?: (campaignId: string | null, campaignName?: string) => void
}

export default function CampaignSelector({ onSelectCampaign }: CampaignSelectorProps) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all')
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)

  const fetchCampaigns = useCallback(async (forceSync = false) => {
    try {
      if (forceSync) setSyncing(true)
      else setLoading(true)

      const url = forceSync
        ? '/api/campaigns?sync=true'
        : '/api/campaigns'

      const response = await fetch(url)
      const data = await response.json()

      if (data.campaigns) {
        setCampaigns(data.campaigns)
        // Iniciar com "Todas as Campanhas" selecionado
        if (!forceSync && selectedCampaign === 'all') {
          if (onSelectCampaign) {
            onSelectCampaign(null, 'Todas as Campanhas')
          }
        } else {
          // Se foi um sync forçado, manter a seleção atual
          const current = data.campaigns.find((c: Campaign) => c.id === selectedCampaign)
          if (current && onSelectCampaign) {
            onSelectCampaign(current.campaignId, current.name)
          }
        }
      }
    } catch (error) {
      console.error('Erro ao buscar campanhas:', error)
    } finally {
      setLoading(false)
      setSyncing(false)
    }
  }, [onSelectCampaign, selectedCampaign])

  useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const handleSelectCampaign = async (campaignId: string, facebookCampaignId: string | null, campaignName: string) => {
    try {
      // Se for "Todas", não precisa definir como padrão
      if (campaignId !== 'all') {
        await fetch('/api/campaigns', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ campaignId }),
        })
      }

      setSelectedCampaign(campaignId)
      setShowDropdown(false)

      if (onSelectCampaign) {
        onSelectCampaign(facebookCampaignId, campaignName)
      }

      // Recarregar lista para atualizar flags (se não for "Todas")
      if (campaignId !== 'all') {
        fetchCampaigns()
      }
    } catch (error) {
      console.error('Erro ao selecionar campanha:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'text-green-600 bg-green-100'
      case 'PAUSED':
        return 'text-yellow-600 bg-yellow-100'
      case 'ARCHIVED':
        return 'text-gray-600 bg-gray-100'
      default:
        return 'text-gray-600 bg-gray-100'
    }
  }

  // ...existing code...

  // Renderização do componente
  return (
    <div>
      {/* Renderize aqui o dropdown, lista de campanhas, etc. */}
      {/* Exemplo de renderização simplificada: */}
      {campaigns.map((campaign) => (
        <button
          key={campaign.id}
          onClick={() => handleSelectCampaign(campaign.id, campaign.campaignId, campaign.name)}
        >
          {campaign.name}
        </button>
      ))}
    </div>
  )
}
