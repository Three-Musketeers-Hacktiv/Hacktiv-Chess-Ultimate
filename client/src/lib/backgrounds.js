/**
 * App wallpapers. `css` is a complete CSS `background-image` value, so an entry may be a gradient, a
 * `url("https://…")` photo, or — as here — an inline SVG, which needs no network and never breaks.
 */

const svgUrl = (svg) => `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' ').trim())}")`

/** Misty castle under a night moon. */
const GOTHIC_CASTLE = svgUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#070a18"/><stop offset=".65" stop-color="#16203d"/><stop offset="1" stop-color="#26335a"/>
      </linearGradient>
      <radialGradient id="moon" cx=".5" cy=".5" r=".5">
        <stop offset="0" stop-color="#f1f5ff" stop-opacity=".95"/><stop offset=".25" stop-color="#cfe0ff" stop-opacity=".35"/>
        <stop offset="1" stop-color="#9db8ff" stop-opacity="0"/>
      </radialGradient>
      <filter id="mist"><feGaussianBlur stdDeviation="38"/></filter>
    </defs>
    <rect width="1600" height="900" fill="url(#sky)"/>
    <circle cx="1180" cy="210" r="260" fill="url(#moon)"/>
    <circle cx="1180" cy="210" r="58" fill="#f4f7ff"/>
    <g fill="#04060d">
      <path d="M0 900V690l80-30 50 24 70-66 40 8 70-90 60 70 90-40 30 60 60-30v334z"/>
      <path d="M470 900V610h40v-58l16-30 16 30v58h58v-120h-26l26-40 26 40h-26v120h60v-70l22-40 22 40v70h46v-190l-14-24h28l32-96 32 96h28l-14 24v190h50v-84l18-34 18 34v84h64v-130l26-44 26 44v130h86V900z"/>
      <path d="M0 900V790c120-40 220-30 340 10s260 30 420-6 300-20 420 14 300 30 420-6V900z"/>
    </g>
    <g fill="#c7d6ff" filter="url(#mist)" opacity=".28">
      <ellipse cx="320" cy="780" rx="420" ry="60"/><ellipse cx="900" cy="820" rx="560" ry="70"/><ellipse cx="1420" cy="760" rx="380" ry="55"/>
    </g>
    <g fill="#ffd98a" opacity=".85">
      <rect x="1012" y="572" width="9" height="16" rx="3"/><rect x="1110" y="556" width="9" height="16" rx="3"/><rect x="1262" y="540" width="9" height="16" rx="3"/>
    </g>
  </svg>`)

/** Fine grain over a cool grey, like a matte felt tournament mat. */
const MATTE_GRAIN = svgUrl(`
  <svg xmlns="http://www.w3.org/2000/svg" width="240" height="240">
    <filter id="n"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .07 0"/></filter>
    <rect width="240" height="240" filter="url(#n)"/>
  </svg>`)

export const BACKGROUNDS = Object.freeze([
  Object.freeze({ id: 'gothic-castle', name: 'Gothic Castle', css: GOTHIC_CASTLE }),
  Object.freeze({
    id: 'matte-slate',
    name: 'Matte Slate',
    css: `${MATTE_GRAIN}, linear-gradient(145deg, #2a303c 0%, #1d222c 55%, #262c37 100%)`,
  }),
  Object.freeze({
    id: 'forest-glow',
    name: 'Forest Glow',
    css:
      'radial-gradient(ellipse 70% 55% at 50% 0%, rgba(16,185,129,0.22), transparent 70%), ' +
      'radial-gradient(ellipse 50% 40% at 85% 100%, rgba(52,211,153,0.10), transparent 70%), ' +
      'linear-gradient(165deg, #04150d 0%, #06241a 55%, #030d09 100%)',
  }),
  Object.freeze({
    id: 'obsidian-void',
    name: 'Obsidian Void',
    css:
      'radial-gradient(ellipse 60% 50% at 20% 0%, rgba(139,92,246,0.18), transparent 70%), ' +
      'linear-gradient(180deg, #0b0f19 0%, #0f1524 100%)',
  }),
])

export const DEFAULT_BACKGROUND = BACKGROUNDS[0]

export const findBackground = (id) => BACKGROUNDS.find((entry) => entry.id === id) ?? null
