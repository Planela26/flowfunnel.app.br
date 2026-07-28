/**
 * Storage — interface desacoplada de armazenamento de arquivos.
 *
 * Permite trocar o provedor (local, Supabase Storage, AWS S3, Cloudflare R2)
 * sem alterar o restante do código. Basta implementar IStorageProvider.
 *
 * Uso:
 *   import { storage } from '@/lib/storage'
 *   const { url } = await storage.upload(file, { folder: 'support' })
 */

export interface UploadOptions {
  folder?: string     // ex: 'support', 'avatars', 'exports'
  filename?: string   // força um nome específico
  public?: boolean    // arquivo público ou privado
}

export interface UploadResult {
  url:      string   // URL pública ou assinada
  key:      string   // identificador interno no provedor
  size:     number   // bytes
  mimeType: string
  name:     string
}

export interface IStorageProvider {
  upload(file: File | Buffer, options?: UploadOptions): Promise<UploadResult>
  delete(key: string): Promise<void>
  getSignedUrl(key: string, expiresInSeconds?: number): Promise<string>
}

// ── Local provider (placeholder para desenvolvimento) ─────────────────────────
// Em produção: substituir por SupabaseStorageProvider ou S3StorageProvider
class LocalStorageProvider implements IStorageProvider {
  async upload(_file: File | Buffer, options?: UploadOptions): Promise<UploadResult> {
    // TODO: implementar upload real (Supabase Storage ou S3)
    // Por ora retorna URL de placeholder para não bloquear o desenvolvimento
    const name = options?.filename ?? `file-${Date.now()}`
    console.warn('[Storage] LocalStorageProvider: upload não persistido. Configure um provedor real.')
    return {
      url:      `/uploads/${options?.folder ?? 'misc'}/${name}`,
      key:      `${options?.folder ?? 'misc'}/${name}`,
      size:     0,
      mimeType: 'application/octet-stream',
      name,
    }
  }

  async delete(key: string): Promise<void> {
    console.warn('[Storage] LocalStorageProvider: delete não implementado. key:', key)
  }

  async getSignedUrl(key: string, _expiresIn?: number): Promise<string> {
    return `/uploads/${key}`
  }
}

// ── Future providers (implementar quando necessário) ──────────────────────────

// class SupabaseStorageProvider implements IStorageProvider { ... }
// class S3StorageProvider implements IStorageProvider { ... }
// class CloudflareR2Provider implements IStorageProvider { ... }

// ── Accepted MIME types for support attachments ───────────────────────────────
export const ALLOWED_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'application/pdf',
  'video/mp4', 'video/quicktime', 'video/webm',
  'text/plain', 'text/csv',
  'application/json',
  'application/zip',
]

export const MAX_FILE_SIZE_MB = 20

export function validateFile(file: { size: number; type: string }): { ok: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return { ok: false, error: `Arquivo muito grande (máx. ${MAX_FILE_SIZE_MB}MB)` }
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return { ok: false, error: 'Tipo de arquivo não permitido' }
  }
  return { ok: true }
}

// ── Singleton export ──────────────────────────────────────────────────────────
export const storage: IStorageProvider = new LocalStorageProvider()
