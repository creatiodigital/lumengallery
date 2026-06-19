import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import sharp from 'sharp'

// Render the brand SVGs to PNG at 1x/2x for email clients (which strip SVG).
// Widths chosen to match the layout: monogram 36px, wordmark 140px.
const OUT = path.join(process.cwd(), 'public', 'email')
const JOBS = [
  { src: 'src/icons/monogram.svg', name: 'monogram', width: 36 },
  { src: 'src/icons/logo.svg', name: 'wordmark', width: 140 },
]

async function main() {
  await mkdir(OUT, { recursive: true })
  for (const job of JOBS) {
    for (const scale of [1, 2]) {
      const out = path.join(OUT, `${job.name}${scale === 2 ? '@2x' : ''}.png`)
      await sharp(job.src, { density: 300 })
        .resize({ width: job.width * scale })
        .png()
        .toFile(out)
      console.log('wrote', out)
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
