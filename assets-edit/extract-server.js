// Servidor local que recebe os frames extraídos pelo navegador e salva em disco.
const http = require('http')
const fs = require('fs')
const path = require('path')

const OUT_DIR = path.join(__dirname, '..', 'public', 'scroll-frames')
fs.mkdirSync(OUT_DIR, { recursive: true })

const PORT = 4600

http
  .createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Headers', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
    if (req.method === 'OPTIONS') return res.end()

    if (req.method === 'POST' && req.url.startsWith('/frame/')) {
      const idx = req.url.split('/frame/')[1]
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString()
        const b64 = body.replace(/^data:image\/jpeg;base64,/, '')
        const name = `frame_${String(idx).padStart(4, '0')}.jpg`
        fs.writeFileSync(path.join(OUT_DIR, name), Buffer.from(b64, 'base64'))
        res.writeHead(200)
        res.end('ok')
      })
      return
    }

    // Serve o vídeo e a página do extrator na MESMA origem,
    // senão o canvas fica "tainted" e toDataURL falha.
    if (req.url === '/video.mp4') {
      // Lê o original direto do Desktop — evita 143MB duplicados em public/.
      const vp =
        'C:\\Users\\gabriel\\Desktop\\fotos da plataforma\\funil\\New folder\\0807.mp4'
      const stat = fs.statSync(vp)
      const range = req.headers.range
      if (range) {
        const m = /bytes=(\d+)-(\d*)/.exec(range)
        const start = parseInt(m[1], 10)
        const end = m[2] ? parseInt(m[2], 10) : stat.size - 1
        res.writeHead(206, {
          'Content-Range': `bytes ${start}-${end}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Type': 'video/mp4',
        })
        return fs.createReadStream(vp, { start, end }).pipe(res)
      }
      res.writeHead(200, { 'Content-Length': stat.size, 'Content-Type': 'video/mp4', 'Accept-Ranges': 'bytes' })
      return fs.createReadStream(vp).pipe(res)
    }

    if (req.url === '/' || req.url === '/extract.html') {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      return res.end(fs.readFileSync(path.join(__dirname, 'extract.html')))
    }

    if (req.url === '/status') {
      const files = fs.readdirSync(OUT_DIR).filter((f) => f.endsWith('.jpg'))
      let bytes = 0
      for (const f of files) bytes += fs.statSync(path.join(OUT_DIR, f)).size
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ count: files.length, mb: +(bytes / 1048576).toFixed(1) }))
      return
    }

    res.writeHead(404)
    res.end('nf')
  })
  .listen(PORT, () => console.log('extract-server em http://localhost:' + PORT))
