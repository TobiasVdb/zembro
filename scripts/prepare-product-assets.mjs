import sharp from 'sharp'
import { writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'

const sources = []
for (const handle of ['comfort', 'wander-alert']) {
  const productUrl = `https://zembro.com/products/${handle}`
  const response = await fetch(`${productUrl}.js`)
  if (!response.ok) throw new Error(`Product lookup failed: ${handle}`)
  const product = await response.json()
  const imageUrl = new URL(product.featured_image, 'https://zembro.com').href
  if (new URL(imageUrl).hostname !== 'cdn.shopify.com') throw new Error('Unexpected image host')
  const imageResponse = await fetch(imageUrl)
  if (!imageResponse.ok) throw new Error(`Image download failed: ${handle}`)
  const original = Buffer.from(await imageResponse.arrayBuffer())
  const output = `${handle}.webp`
  await sharp(original)
    .resize({ width: 900, withoutEnlargement: true })
    .webp({ quality: 85 })
    .toFile(`public/assets/${output}`)
  sources.push({
    productUrl,
    imageUrl,
    output,
    originalSha256: createHash('sha256').update(original).digest('hex'),
  })
}
await writeFile(
  'public/assets/product-sources.json',
  JSON.stringify({ verified: '2026-10-12', sources }, null, 2),
)
console.log('Prepared official Comfort and Wander Alert web copies.')
