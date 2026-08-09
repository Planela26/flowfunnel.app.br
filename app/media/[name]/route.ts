// Serve a mídia da landing (vídeo do herói e seu primeiro quadro).
//
// A Hostinger não serve `public/` — mesmo motivo pelo qual os logos e os frames
// deste projeto vivem em route handlers. Os arquivos vêm no próprio repositório
// (git clone → npm run build → next start), então estão em disco no servidor
// mesmo sem serem servidos como estáticos.
//
// Diferente dos frames, aqui o Range é OBRIGATÓRIO: o herói posiciona o vídeo
// em timestamps específicos, e sem resposta 206 o navegador não consegue buscar
// — a máquina de etapas simplesmente não funciona. Por isso servimos em stream,
// fatiando o arquivo, em vez de carregar os 16 MB na memória a cada requisição.
import { readFile } from 'fs/promises'
import path from 'path'

const DIR = path.join(process.cwd(), 'public')

// Lista fechada: impede path traversal e evita expor `public/` inteiro.
const TYPES: Record<string, string> = {
  'demo-video-web.mp4': 'video/mp4',
  'demo-poster.jpg': 'image/jpeg',
}

/**
 * O arquivo fica residente em memória (16 MB) e as fatias saem dele.
 *
 * Medido: abrindo um stream de disco por requisição, cada busca levava ~1,4s
 * contra ~0,8s servindo o estático direto — e o herói faz várias buscas por
 * transição, então o vídeo chegava atrasado a cada parada e o texto nem
 * aparecia. Servir de um buffer elimina a I/O por requisição.
 */
const cache = new Map<string, Buffer>()

async function load(name: string): Promise<Buffer | null> {
  const hit = cache.get(name)
  if (hit) return hit
  try {
    const buf = await readFile(path.join(DIR, name))
    cache.set(name, buf)
    return buf
  } catch {
    return null
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  const type = TYPES[name]
  if (!type) return new Response(null, { status: 404 })

  const buf = await load(name)
  if (!buf) return new Response(null, { status: 404 })
  const size = buf.length

  const base: Record<string, string> = {
    'Content-Type': type,
    'Cache-Control': 'public, max-age=31536000, immutable',
    // Sem este cabeçalho o navegador nem tenta pedir trechos.
    'Accept-Ranges': 'bytes',
  }

  const range = req.headers.get('range')
  const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null

  if (match) {
    const start = match[1] ? Number(match[1]) : 0
    const rawEnd = match[2] ? Number(match[2]) : size - 1

    if (!Number.isFinite(start) || !Number.isFinite(rawEnd) || start >= size) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` },
      })
    }

    const end = Math.min(rawEnd, size - 1)
    if (start > end) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${size}` },
      })
    }

    // Cópia da fatia, não uma janela sobre o buffer de 16 MB: além de o tipo
    // exigido por Response não aceitar view sobre ArrayBufferLike, entregar a
    // janela manteria o buffer inteiro preso a cada resposta.
    const slice = new Uint8Array(buf.subarray(start, end + 1))

    return new Response(slice, {
      status: 206,
      headers: {
        ...base,
        'Content-Range': `bytes ${start}-${end}/${size}`,
        'Content-Length': String(end - start + 1),
      },
    })
  }

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: { ...base, 'Content-Length': String(size) },
  })
}
