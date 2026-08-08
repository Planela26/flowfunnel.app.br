// Serve os frames da landing por scroll.
//
// A Hostinger não serve `public/` — é por isso que os logos deste projeto vivem
// em route handlers (`app/logos/[name]`, `app/flowsara-logo.jpg`). Os frames são
// 200 arquivos de ~80 KB: embutir em base64 como os logos inflaria o bundle em
// dezenas de MB, então aqui lemos do disco em runtime. Os arquivos vêm no
// próprio repositório (git clone → npm run build → next start), então
// `public/scroll-frames/` está presente no servidor mesmo sem ser servido.
import { readFile } from 'fs/promises'
import path from 'path'

const DIR = path.join(process.cwd(), 'public', 'scroll-frames')

// Só `frame_0001.jpg` … `frame_9999.jpg`. Impede path traversal.
const VALID = /^frame_\d{4}\.jpg$/

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params
  if (!VALID.test(name)) return new Response(null, { status: 404 })

  try {
    const buf = await readFile(path.join(DIR, name))
    return new Response(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'image/jpeg',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Content-Length': String(buf.length),
      },
    })
  } catch {
    return new Response(null, { status: 404 })
  }
}
