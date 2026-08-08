const fs = require('fs')
const path = require('path')
const jpeg = require('jpeg-js')

const DIR = path.join(__dirname, '..', 'public', 'scroll-frames')
const COLS = 4
const ROWS = 5
const CW = 440
const CH = 248

const picks = []
const total = 200
for (let i = 0; i < COLS * ROWS; i++) {
  picks.push(1 + Math.round((i / (COLS * ROWS - 1)) * (total - 1)))
}

const OW = COLS * CW
const OH = ROWS * CH
const out = Buffer.alloc(OW * OH * 4, 0)

function sample(img, sx, sy) {
  const x = Math.min(img.width - 1, Math.max(0, sx | 0))
  const y = Math.min(img.height - 1, Math.max(0, sy | 0))
  return (y * img.width + x) * 4
}

picks.forEach((n, k) => {
  const file = path.join(DIR, `frame_${String(n).padStart(4, '0')}.jpg`)
  const img = jpeg.decode(fs.readFileSync(file), { useTArray: true })
  const cx = (k % COLS) * CW
  const cy = Math.floor(k / COLS) * CH
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      const si = sample(img, (x / CW) * img.width, (y / CH) * img.height)
      const di = ((cy + y) * OW + (cx + x)) * 4
      out[di] = img.data[si]
      out[di + 1] = img.data[si + 1]
      out[di + 2] = img.data[si + 2]
      out[di + 3] = 255
    }
  }
})

fs.writeFileSync(
  path.join(__dirname, 'contact-sheet.jpg'),
  jpeg.encode({ data: out, width: OW, height: OH }, 82).data
)
console.log('contact-sheet.jpg', OW + 'x' + OH, 'frames:', picks.join(','))
