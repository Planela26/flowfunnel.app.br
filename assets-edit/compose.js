const fs = require('fs');
const jpeg = require('jpeg-js');
const { PNG } = require('pngjs');

// ── Cantos da TELA do monitor na imagem setup.jpg (em px, ordem: TL,TR,BR,BL) ──
// Ajuste estes 4 pontos até o encaixe ficar perfeito.
const CORNERS = {
  TL: [340, 548],
  TR: [523, 540],
  BR: [523, 690],
  BL: [340, 682],
};

const SETUP = 'setup.jpg';
const TELA = 'tela.jpg';
const OUT = 'composite.png';

// Brilho/vinheta pra dar cara de "tela ligada"
const SCREEN_BRIGHTNESS = 1.06; // >1 clareia levemente
const EDGE_DARKEN = 0.12;       // vinheta sutil nas bordas

function decode(path) {
  const buf = fs.readFileSync(path);
  return jpeg.decode(buf, { useTArray: true }); // {width,height,data:RGBA}
}

// Resolve sistema linear NxN por eliminação de Gauss
function solve(A, b) {
  const n = b.length;
  for (let i = 0; i < n; i++) {
    let p = i;
    for (let r = i + 1; r < n; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]];
    [b[i], b[p]] = [b[p], b[i]];
    const piv = A[i][i];
    for (let c = i; c < n; c++) A[i][c] /= piv;
    b[i] /= piv;
    for (let r = 0; r < n; r++) {
      if (r === i) continue;
      const f = A[r][i];
      for (let c = i; c < n; c++) A[r][c] -= f * A[i][c];
      b[r] -= f * b[i];
    }
  }
  return b;
}

// Homografia que mapeia pontos DEST (setup) -> SRC (tela)
function homography(dst, src) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = dst[i];
    const [u, v] = src[i];
    A.push([x, y, 1, 0, 0, 0, -x * u, -y * u]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -x * v, -y * v]); b.push(v);
  }
  const h = solve(A, b);
  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

function inside(px, py, poly) {
  // point in convex quad via consistent cross-product signs
  let sign = 0;
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = poly[i];
    const [bx, by] = poly[(i + 1) % 4];
    const cross = (bx - ax) * (py - ay) - (by - ay) * (px - ax);
    const s = Math.sign(cross);
    if (s !== 0) { if (sign === 0) sign = s; else if (s !== sign) return false; }
  }
  return true;
}

function bilinear(img, u, v) {
  const { width: w, height: h, data } = img;
  if (u < 0 || v < 0 || u > w - 1 || v > h - 1) return null;
  const x0 = Math.floor(u), y0 = Math.floor(v);
  const x1 = Math.min(x0 + 1, w - 1), y1 = Math.min(y0 + 1, h - 1);
  const fx = u - x0, fy = v - y0;
  const px = (xx, yy) => (yy * w + xx) * 4;
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const a = data[px(x0, y0) + c] * (1 - fx) + data[px(x1, y0) + c] * fx;
    const b = data[px(x0, y1) + c] * (1 - fx) + data[px(x1, y1) + c] * fx;
    out[c] = a * (1 - fy) + b * fy;
  }
  return out;
}

const setup = decode(SETUP);
const tela = decode(TELA);
const poly = [CORNERS.TL, CORNERS.TR, CORNERS.BR, CORNERS.BL];
const src = [[0, 0], [tela.width - 1, 0], [tela.width - 1, tela.height - 1], [0, tela.height - 1]];
const H = homography(poly, src);

// bounding box do quad
const xs = poly.map(p => p[0]), ys = poly.map(p => p[1]);
const minX = Math.max(0, Math.floor(Math.min(...xs)));
const maxX = Math.min(setup.width - 1, Math.ceil(Math.max(...xs)));
const minY = Math.max(0, Math.floor(Math.min(...ys)));
const maxY = Math.min(setup.height - 1, Math.ceil(Math.max(...ys)));

const out = new PNG({ width: setup.width, height: setup.height });
out.data.set(setup.data); // começa com a foto original

// centro do quad p/ vinheta
const cx = (xs[0] + xs[1] + xs[2] + xs[3]) / 4;
const cy = (ys[0] + ys[1] + ys[2] + ys[3]) / 4;
const halfW = (Math.abs(xs[1] - xs[0]) + Math.abs(xs[2] - xs[3])) / 4 || 1;
const halfH = (Math.abs(ys[3] - ys[0]) + Math.abs(ys[2] - ys[1])) / 4 || 1;

let painted = 0;
for (let y = minY; y <= maxY; y++) {
  for (let x = minX; x <= maxX; x++) {
    if (!inside(x + 0.5, y + 0.5, poly)) continue;
    const d = H[6] * x + H[7] * y + H[8];
    const u = (H[0] * x + H[1] * y + H[2]) / d;
    const v = (H[3] * x + H[4] * y + H[5]) / d;
    const s = bilinear(tela, u, v);
    if (!s) continue;
    // vinheta radial suave
    const nx = (x - cx) / halfW, ny = (y - cy) / halfH;
    const edge = Math.min(1, (nx * nx + ny * ny));
    const dark = 1 - EDGE_DARKEN * edge;
    const idx = (y * setup.width + x) * 4;
    for (let c = 0; c < 3; c++) {
      let val = s[c] * SCREEN_BRIGHTNESS * dark;
      out.data[idx + c] = Math.max(0, Math.min(255, val));
    }
    out.data[idx + 3] = 255;
    painted++;
  }
}

out.pack().pipe(fs.createWriteStream(OUT)).on('finish', () => {
  console.log(`OK -> ${OUT} | pixels pintados: ${painted} | setup ${setup.width}x${setup.height}`);
});
