// Biblioteca de funções para WhatsApp Cloud API

interface SendMessageParams {
  phoneNumberId: string
  accessToken: string
  to: string
  message: string
  type?: 'text' | 'template'
}

interface SendTemplateParams {
  phoneNumberId: string
  accessToken: string
  to: string
  templateName: string
  languageCode?: string
  components?: any[]
}

// Enviar mensagem de texto
export async function sendWhatsAppMessage({
  phoneNumberId,
  accessToken,
  to,
  message,
  type = 'text',
}: SendMessageParams) {
  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''), // Remove caracteres não numéricos
      type: 'text',
      text: {
        preview_url: false,
        body: message,
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(`WhatsApp API Error: ${JSON.stringify(data)}`)
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      data,
    }
  } catch (error) {
    console.error('Erro ao enviar mensagem WhatsApp:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

// Enviar template (mensagens pré-aprovadas)
export async function sendWhatsAppTemplate({
  phoneNumberId,
  accessToken,
  to,
  templateName,
  languageCode = 'pt_BR',
  components = [],
}: SendTemplateParams) {
  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`

    const payload = {
      messaging_product: 'whatsapp',
      to: to.replace(/\D/g, ''),
      type: 'template',
      template: {
        name: templateName,
        language: {
          code: languageCode,
        },
        components,
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(`WhatsApp API Error: ${JSON.stringify(data)}`)
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      data,
    }
  } catch (error) {
    console.error('Erro ao enviar template WhatsApp:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

// Marcar mensagem como lida
export async function markMessageAsRead(
  phoneNumberId: string,
  accessToken: string,
  messageId: string
) {
  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`

    const payload = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    return {
      success: response.ok,
      data,
    }
  } catch (error) {
    console.error('Erro ao marcar mensagem como lida:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

// Buscar perfil de negócios
export async function getBusinessProfile(
  phoneNumberId: string,
  accessToken: string
) {
  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/whatsapp_business_profile?fields=about,address,description,email,profile_picture_url,websites,vertical`

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    const data = await response.json()

    return {
      success: response.ok,
      data: data.data?.[0] || data,
    }
  } catch (error) {
    console.error('Erro ao buscar perfil de negócios:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}

// Enviar mensagem interativa com botões
export async function sendInteractiveButtons(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>
) {
  try {
    const url = `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'interactive',
      interactive: {
        type: 'button',
        body: {
          text: bodyText,
        },
        action: {
          buttons: buttons.map(btn => ({
            type: 'reply',
            reply: {
              id: btn.id,
              title: btn.title.substring(0, 20), // Max 20 caracteres
            },
          })),
        },
      },
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(`WhatsApp API Error: ${JSON.stringify(data)}`)
    }

    return {
      success: true,
      messageId: data.messages?.[0]?.id,
      data,
    }
  } catch (error) {
    console.error('Erro ao enviar botões interativos:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro desconhecido',
    }
  }
}
