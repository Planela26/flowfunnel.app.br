const fs = require('fs')
const path = require('path')
const jpeg = require('jpeg-js')

const DIR = path.join(__dirname, '..', 'public', 'scroll-frames')
const N = 12
const COLS = 4
const CW = 430
const CH = 242

const OW = COLS * CW
const OH = Math.ceil(N / COLS) * CH
const out = Buffer.alloc(OW * OH * 4, 0)

for (let k = 0; k < N; k++) {
  const n = k + 1
  const img = jpeg.decode(
    fs.readFileSync(path.join(DIR, `frame_${String(n).padStart(4, '0')}.jpg`)),
    { useTArray: true }
  )
  const cx = (k % COLS) * CW
  const cy = Math.floor(k / COLS) * CH
  for (let y = 0; y < CH; y++) {
    for (let x = 0; x < CW; x++) {
      const si =
        (Math.min(img.height - 1, ((y / CH) * img.height) | 0) * img.width +
          Math.min(img.width - 1, ((x / CW) * img.width) | 0)) * 4
      const di = ((cy + y) * OW + (cx + x)) * 4
      out[di] = img.data[si]
      out[di + 1] = img.data[si + 1]
      out[di + 2] = img.data[si + 2]
      out[di + 3] = 255
    }
  }
}

fs.writeFileSync(
  path.join(__dirname, 'first-frames.jpg'),
  jpeg.encode({ data: out, width: OW, height: OH }, 88).data
)
console.log('first-frames.jpg', OW + 'x' + OH, '- frames 1..' + N)
