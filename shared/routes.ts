import { PRODUCTS } from './types.js'

export const PRODUCT_PATHS = [
  '/products',
  ...PRODUCTS.map((product) => `/products/${product.slug}`),
]
export const LEGAL_PATHS = ['/privacy', '/terms']
export const AUDIENCE_PATHS = ['/for-loved-ones', '/for-care-providers']
export const PUBLIC_PATHS = [...PRODUCT_PATHS, ...LEGAL_PATHS, ...AUDIENCE_PATHS]
export function localHref(path: string, base: string, search: string, lang: string) {
  const url = new URL(path, 'https://local.invalid')
  const params = new URLSearchParams(search)
  params.set('lang', lang)
  return `${base}${url.pathname}?${params}${url.hash}`
}
