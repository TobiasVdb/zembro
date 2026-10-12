import type { Lang } from '../shared/types.js'
import type { SeedField } from './content.js'
import { legalSource } from './legal-source.js'

const localized = (
  path: string,
  values: Record<Lang, string>,
  type: SeedField['type'] = 'text',
): SeedField => ({ path, type, values })
const chunks = (body: string) => {
  const result: string[] = []
  for (const paragraph of body.split('\n\n')) {
    const last = result.length - 1
    if (last >= 0 && result[last].length + paragraph.length + 2 <= 7500)
      result[last] += '\n\n' + paragraph
    else result.push(paragraph)
  }
  if (result.some((value) => value.length > 10000))
    throw new Error('Legal paragraph exceeds CMS field limit')
  return result
}
const policy = (key: keyof typeof legalSource, title: Record<Lang, string>): SeedField[] => {
  const source = legalSource[key]
  const bodies = {
    nl: chunks(source.nl.body),
    en: chunks(source.en.body),
    fr: chunks(source.fr.body),
    de: chunks(source.nl.body),
  }
  return [
    localized('title', title),
    localized('eyebrow', {
      nl: 'JURIDISCH',
      en: 'LEGAL',
      fr: 'INFORMATIONS JURIDIQUES',
      de: 'RECHTLICHES',
    }),
    localized('notice', {
      nl: '',
      en: '',
      fr: '',
      de: 'Eine deutsche Fassung ist auf der ursprünglichen Website nicht verfügbar. Dieser Rechtstext wird in der niederländischen Originalfassung angezeigt.',
    }),
    localized('sourceLanguage', { nl: 'nl', en: 'en', fr: 'fr', de: 'nl' }),
    localized(
      'sourceUrl',
      { nl: source.nl.url, en: source.en.url, fr: source.fr.url, de: source.nl.url },
      'link',
    ),
    localized('sourceLabel', {
      nl: 'Bekijk de oorspronkelijke publicatie',
      en: 'View the original publication',
      fr: 'Voir la publication originale',
      de: 'Originalveröffentlichung ansehen',
    }),
    localized('contentsLabel', {
      nl: 'Op deze pagina',
      en: 'On this page',
      fr: 'Sur cette page',
      de: 'Auf dieser Seite',
    }),
    ...Array.from(
      { length: Math.max(...Object.values(bodies).map((body) => body.length)) },
      (_, i) =>
        localized(`body${i + 1}`, {
          nl: bodies.nl[i] ?? '',
          en: bodies.en[i] ?? '',
          fr: bodies.fr[i] ?? '',
          de: bodies.de[i] ?? '',
        }),
    ),
  ]
}
export const legalContent = {
  legalPrivacy: policy('privacy-policy', {
    nl: 'Privacybeleid',
    en: 'Privacy policy',
    fr: 'Politique de confidentialité',
    de: 'Datenschutzerklärung',
  }),
  legalTerms: policy('terms-of-service', {
    nl: 'Algemene voorwaarden',
    en: 'Terms and conditions',
    fr: 'Conditions générales',
    de: 'Allgemeine Geschäftsbedingungen',
  }),
}
