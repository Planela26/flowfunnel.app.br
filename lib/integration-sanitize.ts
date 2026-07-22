// Remove campos sensíveis de um registro Integration antes de devolvê-lo ao
// cliente. O accessToken/refreshToken são criptografados no banco, mas nem a
// versão cifrada deve trafegar para o frontend; e o `config` pode conter
// segredos (ex.: appSecret do Meta) que devem ser removidos.
const SECRET_CONFIG_KEYS = [
  'appSecret',
  'clientSecret',
  'secret',
  'verifyToken',
  'apiKey',
  'privateKey',
  'accessToken',
  'refreshToken',
]

export function safeIntegration<T extends Record<string, any>>(integration: T | null | undefined) {
  if (!integration) return integration
  const { accessToken, refreshToken, config, ...rest } = integration as Record<string, any>
  let safeConfig: Record<string, any> | undefined
  if (config) {
    try {
      const parsed = typeof config === 'string' ? JSON.parse(config) : config
      const cleaned: Record<string, any> = { ...parsed }
      for (const k of SECRET_CONFIG_KEYS) delete cleaned[k]
      safeConfig = cleaned
    } catch {
      safeConfig = undefined
    }
  }
  return { ...rest, hasAccessToken: Boolean(accessToken), config: safeConfig }
}
