const fs = require('fs')
const path = require('path')
const jpeg = require('jpeg-js')

const DIR = path.join(__dirname, '..', 'public', 'scroll-frames')

// [frame, x0%, x1%, y0%, y1%] — região da tela em cada ato
const SHOTS = [
  ['ato2', 61, 4, 66, 20, 78],
  ['ato3', 101, 55, 100, 8, 80],
  ['ato4', 149, 0, 58, 22, 88],
  ['ato5', 189, 47, 96, 5, 80],
]

for (const [name, n, x0, x1, y0, y1] of SHOTS) {
  const img = jpeg.decode(
    fs.readFileSync(path.join(DIR, `frame_${String(n).padStart(4, '0')}.jpg`)),
    { useTArray: true }
  )
  const sx = Math.round((x0 / 100) * img.width)
  const ex = Math.round((x1 / 100) * img.width)
  const sy = Math.round((y0 / 100) * img.height)
  const ey = Math.round((y1 / 100) * img.height)
  const cw = ex - sx
  const chh = ey - sy
  const S = 2
  const ow = cw * S
  const oh = chh * S
  const out = Buffer.alloc(ow * oh * 4)
  for (let y = 0; y < oh; y++) {
    for (let x = 0; x < ow; x++) {
      const si = ((sy + Math.floor(y / S)) * img.width + (sx + Math.floor(x / S))) * 4
      const di = (y * ow + x) * 4
      out[di] = img.data[si]
      out[di + 1] = img.data[si + 1]
      out[di + 2] = img.data[si + 2]
      out[di + 3] = 255
    }
  }
  const f = path.join(__dirname, `screen-${name}.jpg`)
  fs.writeFileSync(f, jpeg.encode({ data: out, width: ow, height: oh }, 90).data)
  console.log(name, 'frame', n, '->', ow + 'x' + oh)
}
