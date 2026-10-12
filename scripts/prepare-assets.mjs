import sharp from 'sharp'
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
const source = process.env.ARTWORK_DIR || '\\\\TOWER\\Work\\Zembro'
const target = path.resolve('public/assets')
await mkdir(target, { recursive: true })
const images = [
  ['ladywalking.png', 'hero.webp', 1900],
  ['EV12 Mini²_With charging base 3.png', 'mini.webp', 900],
  ['silvershield.png', 'sensor.webp', 900],
  ['hand_holding_phone.png', 'phone.webp', 1000],
  ['OKTAVE~3 2.png', 'watch.webp', 400],
]
const manifest = []
for (const [original, output, width] of images) {
  const input = path.join(source, original)
  await sharp(input)
    .rotate()
    .resize({ width: Number(width), withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(path.join(target, String(output)))
  manifest.push({ source: original, output })
}
// Use the supplied photograph's room area, avoiding text baked into campaign artwork.
await sharp(path.join(source, 'ladywalking.png'))
  .extract({ left: 0, top: 0, width: 2300, height: 3300 })
  .resize({ width: 1100 })
  .webp({ quality: 85 })
  .toFile(path.join(target, 'interior.webp'))
await sharp(path.join(source, 'Final.png'))
  .extract({ left: 0, top: 50, width: 640, height: 800 })
  .resize({ width: 1000 })
  .webp({ quality: 85 })
  .toFile(path.join(target, 'impact.webp'))
manifest.push(
  { source: 'ladywalking.png (left room crop)', output: 'interior.webp' },
  { source: 'Final.png (portrait crop without text)', output: 'impact.webp' },
)
await sharp(path.join(source, 'zembrologo.png'))
  .resize({ width: 450, withoutEnlargement: true })
  .png()
  .toFile(path.join(target, 'logo.png'))
await import('./prepare-favicon.mjs')
await copyFile(
  path.join(source, 'Zembro_Independent_Not_Alone_40s_v3.mp4'),
  path.join(target, 'story.mp4'),
)
await writeFile(
  path.join(target, 'sources.json'),
  JSON.stringify(
    {
      source: 'Supplied Zembro artwork',
      images: manifest,
      logo: 'zembrologo.png',
      video: 'Zembro_Independent_Not_Alone_40s_v3.mp4',
    },
    null,
    2,
  ),
)
console.log('Prepared web assets; originals unchanged.')
