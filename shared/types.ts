export const LANGUAGES = ['nl', 'en', 'fr', 'de'] as const
export type Lang = (typeof LANGUAGES)[number]
export const SECTION_KEYS = [
  'header',
  'hero',
  'wearable',
  'ambient',
  'platform',
  'impact',
  'footer',
  'ui',
  'catalog',
  'productMini',
  'productOktave',
  'productComfort',
  'productWander',
  'productSilverShield',
  'legalPrivacy',
  'legalTerms',
  'lovedOnes',
  'careProviders',
] as const
export type SectionKey = (typeof SECTION_KEYS)[number]
export const PRODUCTS = [
  { slug: 'silver-shield', section: 'productSilverShield' },
  { slug: 'mini', section: 'productMini' },
  { slug: 'oktave', section: 'productOktave' },
  { slug: 'comfort', section: 'productComfort' },
  { slug: 'wander-alert', section: 'productWander' },
] as const satisfies readonly { slug: string; section: SectionKey }[]
export type FieldType = 'text' | 'link' | 'image' | 'video'
export interface Field {
  path: string
  type: FieldType
  values: Partial<Record<Lang, string>>
}
export interface Section {
  key: SectionKey
  position: number
  reorderable: boolean
  fields: Field[]
}
export interface Content {
  lang: Lang
  sections: Record<SectionKey, Record<string, string>>
  order: SectionKey[]
}
export interface MediaItem {
  id: number
  filename: string
  mimeType: string
  url: string
}
export function isLang(value: unknown): value is Lang {
  return typeof value === 'string' && LANGUAGES.some((lang) => lang === value)
}
export function isSectionKey(value: string): value is SectionKey {
  return SECTION_KEYS.some((key) => key === value)
}
