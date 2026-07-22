// Logo SVG paths — all centered at (0,0), stroke-only, white translucent
// sized ~18px radius for pattern tiles

const S = `rgba(255,255,255,0.11)`  // stroke color
const F = `rgba(255,255,255,0.09)`  // subtle fill for some logos
const sw = `stroke-width='1.4'`

// ─── FACEBOOK rounded-rect + "f" ─────────────────────────────────────────────
const facebook = `
  <g stroke='${S}' ${sw} fill='none'>
    <rect x='-9' y='-11' width='18' height='22' rx='4'/>
    <path d='M1,9 L1,-1.5 L-2,-1.5 L-2,-5 L1,-5 Q1,-10 7,-10 L9,-10 L9,-6.5 L6.5,-6.5 Q5,-6.5 5,-5 L5,-3.5' stroke-width='1.3'/>
    <path d='M5,-3.5 L8,-3.5 L7.5,-1.5 L5,-1.5 L5,9' stroke-width='1.3'/>
  </g>`

// ─── HOTMART flame ────────────────────────────────────────────────────────────
const hotmart = `
  <g stroke='${S}' ${sw} fill='none'>
    <path d='M0,10 Q-6,4 -3,-3 Q-1,0 2,-2 Q3,-6 1,-11 Q7,-6 5,1 Q8,-1 7,6 Q5,3 4,10 Q2,7 0,10Z'/>
  </g>`

// ─── WHATSAPP speech-bubble with tail ────────────────────────────────────────
const whatsapp = `
  <g stroke='${S}' ${sw} fill='none'>
    <path d='M0,-10 Q9,-10 9,-3 Q9,3 3,5.5 L0.5,11 L-2.5,5.5 Q-9,3 -9,-3 Q-9,-10 0,-10Z'/>
    <circle cx='-3.5' cy='-2' r='1.5' fill='${S}' stroke='none'/>
    <circle cx='0.5'  cy='-2' r='1.5' fill='${S}' stroke='none'/>
    <circle cx='4.5'  cy='-2' r='1.5' fill='${S}' stroke='none'/>
  </g>`

// ─── KIWIFY rounded-square + stylised K ──────────────────────────────────────
const kiwify = `
  <g stroke='${S}' ${sw} fill='none'>
    <rect x='-9' y='-10' width='18' height='20' rx='5'/>
    <path d='M-3,-7 L-3,7 M-3,0 L4,-7 M-3,-1 L4,7' stroke-width='1.4'/>
  </g>`

// ─── EDUZZ "e" circle arc + horizontal bar ───────────────────────────────────
// Eduzz's logo resembles a bold stylised "e" / arc with a cut
const eduzz = `
  <g stroke='${S}' ${sw} fill='none'>
    <path d='M7,-3 Q7,10 0,10 Q-8,10 -8,0 Q-8,-10 0,-10 Q7,-10 7,-3 L-8,-3'/>
  </g>`

// ─── MONETIZZE stylised "M" with rounded base ────────────────────────────────
const monetizze = `
  <g stroke='${S}' ${sw} fill='none'>
    <path d='M-8,-9 L-8,9 Q-8,11 -6,11 Q-4,11 -4,9 L-4,-1 L0,7 L4,-1 L4,9 Q4,11 6,11 Q8,11 8,9 L8,-9'/>
  </g>`

// ─── LEAF (WhatsApp default background motif) ─────────────────────────────────
const leaf = (r = 0) => `
  <g transform='rotate(${r})' stroke='${S}' ${sw} fill='none'>
    <path d='M0,-11 Q11,0 0,11 Q-11,0 0,-11Z'/>
    <path d='M0,-11 L0,11'/>
  </g>`

const leafSm = (r = 0) => `
  <g transform='rotate(${r})' stroke='${S}' stroke-width='1.1' fill='none'>
    <path d='M0,-9 Q9,0 0,9 Q-9,0 0,-9Z'/>
    <path d='M0,-9 L0,9'/>
  </g>`

// ─── DOTS ─────────────────────────────────────────────────────────────────────
const dot = (r: number) => `<circle r='${r}' fill='${F}' stroke='none'/>`

// ─── SMALL CURVE ──────────────────────────────────────────────────────────────
const curve = `<path d='M-6,4 Q0,-4 6,4' stroke='${S}' stroke-width='1' fill='none'/>`

// ─── TILE 240×240 — 5×5 grid of 48px cells ───────────────────────────────────
// Positions: cell centers at 24, 72, 120, 168, 216  (but we wrap at 240 = tile)
// We use a simpler 4×4 200px grid below for exact seamless tiling

const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'>
  <!-- Row 1 -->
  <g transform='translate(20,20)'>${leaf(0)}</g>
  <g transform='translate(80,18)'>${facebook}</g>
  <g transform='translate(140,20)'>${leafSm(45)}</g>
  <g transform='translate(200,18)'>${hotmart}</g>

  <!-- Row 2 -->
  <g transform='translate(20,80)'>${kiwify}</g>
  <g transform='translate(80,80)'>${leafSm(-20)}</g>
  <g transform='translate(140,78)'>${eduzz}</g>
  <g transform='translate(200,80)'>${leafSm(90)}</g>

  <!-- Row 3 -->
  <g transform='translate(20,140)'>${leafSm(120)}</g>
  <g transform='translate(80,138)'>${monetizze}</g>
  <g transform='translate(140,140)'>${whatsapp}</g>
  <g transform='translate(200,140)'>${leaf(-60)}</g>

  <!-- Row 4 -->
  <g transform='translate(20,200)'>${hotmart}</g>
  <g transform='translate(80,200)'>${leaf(30)}</g>
  <g transform='translate(140,200)'>${facebook}</g>
  <g transform='translate(200,200)'>${kiwify}</g>

  <!-- Dots -->
  <g transform='translate(50,50)'>${dot(2.5)}</g>
  <g transform='translate(110,50)'>${dot(2)}</g>
  <g transform='translate(170,50)'>${dot(2)}</g>
  <g transform='translate(50,110)'>${dot(2)}</g>
  <g transform='translate(170,110)'>${dot(2.5)}</g>
  <g transform='translate(50,170)'>${dot(2)}</g>
  <g transform='translate(110,170)'>${dot(2.5)}</g>
  <g transform='translate(170,170)'>${dot(2)}</g>
  <g transform='translate(110,110)'>${dot(1.5)}</g>
  <g transform='translate(230,50)'>${dot(2)}</g>
  <g transform='translate(230,170)'>${dot(2)}</g>
  <g transform='translate(50,230)'>${dot(2)}</g>
  <g transform='translate(170,230)'>${dot(2)}</g>

  <!-- Small curves -->
  <g transform='translate(50,50)'>${curve}</g>
  <g transform='translate(170,50)'>${curve}</g>
  <g transform='translate(50,170)'>${curve}</g>
  <g transform='translate(170,170)'>${curve}</g>
  <g transform='translate(230,110)'>${curve}</g>
  <g transform='translate(110,230)'>${curve}</g>
</svg>`

export const authPatternUrl = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
export const authPatternSize = '240px 240px'
