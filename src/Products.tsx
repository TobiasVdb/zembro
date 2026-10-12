import type { ReactNode } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, Check } from '@phosphor-icons/react'
import { PRODUCTS, type Content, type SectionKey } from '../shared/types'
import { Reveal } from './Reveal'
import { Wave } from './Wave'
import { SilverShieldScene } from './SilverShieldScene'

export interface FieldMetadata {
  'data-section': SectionKey
  'data-field': string
  tabIndex?: number
  role?: 'button'
  'aria-label'?: string
}
interface Props {
  theme: string
  content: Content
  slug?: string
  href: (path: string) => string
  text: (section: SectionKey, path: string) => ReactNode
  image: (
    section: SectionKey,
    path: string,
    alt: string,
    className?: string,
    priority?: boolean,
  ) => ReactNode
  field: (section: SectionKey, path: string) => FieldMetadata
}
export default function Products({ theme, content, slug, href, text, image, field }: Props) {
  const product = PRODUCTS.find((item) => item.slug === slug)
  const t = (section: SectionKey, key: string) => content.sections[section][key] ?? ''
  const purchase = (section: SectionKey, enquiry = false) => (
    <>
      <a
        className="button purchase-button"
        href={t(section, 'shopLink')}
        {...field(section, 'shopLink')}
      >
        {text('catalog', enquiry ? 'enquire' : 'buy')} <ArrowUpRight size={19} />
      </a>
      {!enquiry && <p className="purchase-note">{text('catalog', 'purchaseNote')}</p>}
    </>
  )
  const features = (section: SectionKey) => (
    <div {...field(section, 'features')}>
      <ul className="product-features">
        {t(section, 'features')
          .split('\n')
          .filter(Boolean)
          .map((value, i) => (
            <li key={i}>
              <Check size={20} aria-hidden="true" />
              <span>{value}</span>
            </li>
          ))}
      </ul>
    </div>
  )
  const support = (
    <section className="catalog-support">
      <Reveal className="container">
        <p className="eyebrow">{text('header', 'contact')}</p>
        <h2>{text('catalog', 'supportTitle')}</h2>
        <p className="body-copy">{text('catalog', 'supportBody')}</p>
        <a className="button" href={t('header', 'contactLink')} {...field('header', 'contactLink')}>
          {text('header', 'contact')} <ArrowRight size={18} />
        </a>
      </Reveal>
      <Wave />
    </section>
  )

  if (slug && !product)
    return (
      <main id="main" className="catalog-intro container">
        <h1>{text('catalog', 'notFound')}</h1>
        <a className="text-link" href={href('/products')}>
          {text('catalog', 'all')} <ArrowRight size={18} />
        </a>
      </main>
    )

  if (product) {
    const section = product.section
    const enquiry = product.slug === 'silver-shield'
    return (
      <main id="main">
        <div className="container product-breadcrumb">
          <a className="text-link" href={href('/products')}>
            <ArrowLeft size={17} /> {text('catalog', 'all')}
          </a>
        </div>
        <section className={`product-detail-hero${enquiry ? ' catalog-silver-shield' : ''}`}>
          <Wave top />
          {enquiry && <SilverShieldScene theme={theme} image={image} priority />}
          <div className="container product-layout">
            {!enquiry && (
              <Reveal className={`catalog-visual ${product.slug}`}>
                {image(section, 'image', 'imageAlt', 'catalog-image', true)}
              </Reveal>
            )}
            <Reveal className="product-copy" delay={0.12}>
              <p className="eyebrow">{text(section, 'category')}</p>
              <h1>{text(section, 'name')}</h1>
              <p className="product-lead">{text(section, 'headline')}</p>
              <p className="body-copy">{text(section, 'body')}</p>
              {purchase(section, enquiry)}
            </Reveal>
          </div>
          <Wave />
        </section>
        <section className="product-information">
          <div className="container product-layout">
            <Reveal className="product-copy">
              <p className="eyebrow">{text(section, 'name')}</p>
              <h2>{text('catalog', 'details')}</h2>
              <p className="body-copy">{text(section, 'details')}</p>
            </Reveal>
            <Reveal className="product-facts" delay={0.12}>
              <h3>{text('catalog', 'features')}</h3>
              {features(section)}
            </Reveal>
          </div>
        </section>
        <section className="related-products">
          <Reveal className="container">
            <h2>{text('catalog', 'related')}</h2>
            <nav aria-label={t('catalog', 'related')}>
              {PRODUCTS.filter((item) => item.slug !== product.slug).map((item) => (
                <a className="text-link" key={item.slug} href={href(`/products/${item.slug}`)}>
                  {text(item.section, 'name')} <ArrowRight size={18} />
                </a>
              ))}
            </nav>
          </Reveal>
          <Wave fill="var(--tint)" />
        </section>
        {support}
      </main>
    )
  }

  return (
    <main id="main">
      <section className="catalog-intro container">
        <Reveal>
          <p className="eyebrow">{text('catalog', 'eyebrow')}</p>
          <h1>
            {text('catalog', 'title')}
            <br />
            <em>{text('catalog', 'accent')}</em>
          </h1>
          <p className="body-copy">{text('catalog', 'body')}</p>
        </Reveal>
        <Reveal className="catalog-hero-artwork" delay={0.1}>
          <div
            className="catalog-hero-layer catalog-hero-light"
            aria-hidden={theme === 'dark'}
            inert={theme === 'dark'}
          >
            {image('catalog', 'heroImage', 'heroImageAlt', 'catalog-hero-image', true)}
          </div>
          <div
            className="catalog-hero-layer catalog-hero-dark"
            aria-hidden={theme !== 'dark'}
            inert={theme !== 'dark'}
          >
            {image('catalog', 'heroImageDark', 'heroImageDarkAlt', 'catalog-hero-image', true)}
          </div>
        </Reveal>
        <Reveal delay={0.12}>
          <nav className="catalog-index" aria-label={t('catalog', 'all')}>
            {PRODUCTS.map((item) => (
              <a key={item.slug} href={`#${item.slug}`}>
                {text(item.section, 'name')}
              </a>
            ))}
          </nav>
        </Reveal>
      </section>
      {PRODUCTS.map((item, index) => (
        <section
          className={`catalog-section catalog-section-${index % 2}${item.slug === 'silver-shield' ? ' catalog-silver-shield' : ''}`}
          id={item.slug}
          key={item.slug}
        >
          {index === 0 && <Wave top />}
          {item.slug === 'silver-shield' && (
            <SilverShieldScene theme={theme} image={image} priority />
          )}
          <div className="container product-layout">
            <Reveal className="product-copy">
              <p className="eyebrow">{text(item.section, 'category')}</p>
              <p className="product-name">{text(item.section, 'name')}</p>
              <h2>{text(item.section, 'headline')}</h2>
              <p className="body-copy">{text(item.section, 'body')}</p>
              <a className="text-link" href={href(`/products/${item.slug}`)}>
                {text('catalog', 'discover')} <ArrowRight size={19} />
              </a>
            </Reveal>
            {item.slug !== 'silver-shield' && (
              <Reveal className={`catalog-visual ${item.slug}`} delay={0.12}>
                <a href={href(`/products/${item.slug}`)} aria-label={t(item.section, 'name')}>
                  {image(item.section, 'image', 'imageAlt', 'catalog-image')}
                </a>
              </Reveal>
            )}
          </div>
          <Wave
            fill={
              index === PRODUCTS.length - 1 || index % 2 === 0 ? 'var(--tint)' : 'var(--surface)'
            }
          />
        </section>
      ))}
      {support}
    </main>
  )
}
