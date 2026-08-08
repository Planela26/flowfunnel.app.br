// Detecta a posição horizontal da TELA (azulada) em cada frame,
// para decidir de que lado colocar o texto.
const fs = require('fs')
const path = require('path')
const jpeg = require('jpeg-js')

const DIR = path.join(__dirname, '..', 'public', 'scroll-frames')
const TOTAL = 200
const STEP = 4

const rows = []
for (let n = 1; n <= TOTAL; n += STEP) {
  const img = jpeg.decode(
    fs.readFileSync(path.join(DIR, `frame_${String(n).padStart(4, '0')}.jpg`)),
    { useTArray: true }
  )
  const W = img.width
  const H = img.height
  let sx = 0
  let count = 0
  let minX = W
  let maxX = 0
  let minY = H
  let maxY = 0
  // amostra 1 a cada 4 px
  for (let y = 0; y < H; y += 4) {
    for (let x = 0; x < W; x += 4) {
      const i = (y * W + x) * 4
      const r = img.data[i]
      const g = img.data[i + 1]
      const b = img.data[i + 2]
      // tela: azul domina o vermelho (UI escura azulada), descarta preto puro
      const lum = (r + g + b) / 3
      if (b - r > 18 && lum > 22) {
        sx += x
        count++
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (count < 50) {
    rows.push({ n, pct: null, cover: 0 })
    continue
  }
  const cx = sx / count
  rows.push({
    n,
    pct: +((cx / W) * 100).toFixed(1),
    cover: +((count / ((W / 4) * (H / 4))) * 100).toFixed(1),
    x0: +((minX / W) * 100).toFixed(0),
    x1: +((maxX / W) * 100).toFixed(0),
  })
}

console.log('frame | progresso | centro-X% | area% | faixa X%')
for (const r of rows) {
  const p = (((r.n - 1) / (TOTAL - 1)) * 100).toFixed(0)
  const side = r.pct == null ? '—' : r.pct < 45 ? 'ESQ' : r.pct > 55 ? 'DIR' : 'centro'
  console.log(
    String(r.n).padStart(4),
    '|',
    String(p + '%').padStart(5),
    '|',
    String(r.pct ?? '-').padStart(6),
    '|',
    String(r.cover).padStart(5),
    '|',
    r.x0 != null ? `${r.x0}-${r.x1}` : '-',
    '|',
    side
  )
}
