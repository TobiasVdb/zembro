import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'

// Isolate the supplied pin mark without redrawing or changing the brand artwork.
const logo = await readFile('public/assets/logo.png')
const mark = await sharp(logo).extract({ left: 0, top: 0, width: 64, height: 96 }).png().toBuffer()
const square = (size) => sharp(mark).resize(size, size, {
  fit: 'contain',
  background: { r: 0, g: 0, b: 0, alpha: 0 },
}).png().toBuffer()
await writeFile('public/favicon-32.png', await square(32))
await writeFile('public/apple-touch-icon.png', await square(180))
const png = await square(48)
const ico = Buffer.alloc(22)
ico.writeUInt16LE(1, 2)
ico.writeUInt16LE(1, 4)
ico[6] = 48
ico[7] = 48
ico.writeUInt16LE(1, 10)
ico.writeUInt16LE(32, 12)
ico.writeUInt32LE(png.length, 14)
ico.writeUInt32LE(22, 18)
await writeFile('public/favicon.ico', Buffer.concat([ico, png]))
console.log('Prepared favicon and touch icon from supplied Zembro mark.')
