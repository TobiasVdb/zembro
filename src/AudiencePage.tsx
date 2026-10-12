import type { ReactNode } from 'react'
import {
  ArrowRight,
  BellRinging,
  ChartLineUp,
  Heart,
  MapPin,
  UsersThree,
  ShieldCheck,
} from '@phosphor-icons/react'
import type { Content, SectionKey } from '../shared/types'
import { PUBLIC_PATHS } from '../shared/routes'
import type { FieldMetadata } from './Products'
import { Reveal } from './Reveal'
import { Wave } from './Wave'

export default function AudiencePage({
  section,
  content,
  href,
  text,
  image,
  field,
}: {
  section: 'lovedOnes' | 'careProviders'
  content: Content
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
}) {
  const professional = section === 'careProviders'
  const values = content.sections[section]
  const destination = (key: string) =>
    PUBLIC_PATHS.includes(values[key]) ? href(values[key]) : values[key]
  const icons = professional ? [UsersThree, BellRinging, ChartLineUp] : [Heart, MapPin, ShieldCheck]
  const responses = [
    { key: 'immediate', Icon: BellRinging },
    { key: 'proactive', Icon: ChartLineUp },
  ]
  const solutions = [
    { section: 'productMini', slug: 'mini' },
    { section: 'productOktave', slug: 'oktave' },
    { section: 'productSilverShield', slug: 'silver-shield' },
  ] as const
  return (
    <main
      id="main"
      className={`audience-page ${professional ? 'audience-professional' : 'audience-family'}`}
    >
      <section className="audience-hero">
        <div className="container audience-hero-layout">
          <Reveal className="audience-hero-copy">
            <p className="eyebrow">{text(section, 'eyebrow')}</p>
            <h1>
              {text(section, 'title')}
              <br />
              <em>{text(section, 'accent')}</em>
            </h1>
            <p className="body-copy">{text(section, 'body')}</p>
            <div className="audience-actions">
              <a
                className="button"
                href={destination('primaryLink')}
                {...field(section, 'primaryLink')}
              >
                {text(section, 'primaryLabel')} <ArrowRight size={19} />
              </a>
              <a
                className="text-link"
                href={professional ? href('/products') : destination('contactLink')}
                {...(!professional ? field(section, 'contactLink') : {})}
              >
                {text(section, 'secondaryLabel')} <ArrowRight size={19} />
              </a>
            </div>
          </Reveal>
          <Reveal className="audience-hero-visual" delay={0.12}>
            {image(section, 'image', 'imageAlt', 'audience-hero-image', true)}
            {values.imageCaption && (
              <p className="audience-caption">{text(section, 'imageCaption')}</p>
            )}
          </Reveal>
        </div>
        <Wave fill="var(--surface)" />
      </section>
      <section className="audience-questions">
        <div className="container">
          <Reveal>
            <h2>{text(section, 'questionsTitle')}</h2>
          </Reveal>
          <div className="audience-question-grid">
            {icons.map((Icon, i) => (
              <Reveal key={i} delay={i * 0.08}>
                <Icon size={29} weight="light" aria-hidden="true" />
                <h3>{text(section, `question${i + 1}Title`)}</h3>
                <p>{text(section, `question${i + 1}Body`)}</p>
              </Reveal>
            ))}
          </div>
        </div>
        <Wave fill="var(--tint)" />
      </section>
      <section className="audience-response">
        <div className="container">
          <Reveal>
            <p className="eyebrow">{text(section, 'responseEyebrow')}</p>
            <h2>{text(section, 'responseTitle')}</h2>
          </Reveal>
          <div className="audience-response-grid">
            {responses.map(({ key, Icon }) => {
              return (
                <Reveal key={key} delay={key === 'proactive' ? 0.1 : 0}>
                  <Icon size={30} weight="light" aria-hidden="true" />
                  <h3>{text(section, `${key}Title`)}</h3>
                  <p className="body-copy">{text(section, `${key}Body`)}</p>
                </Reveal>
              )
            })}
          </div>
          <Reveal>
            <p className="audience-setup-note">{text(section, 'setupNote')}</p>
          </Reveal>
        </div>
        <Wave />
      </section>
      <section className="audience-solutions">
        <div className="container">
          <Reveal>
            <h2>{text(section, 'solutionsTitle')}</h2>
          </Reveal>
          <div className="audience-solution-grid">
            {solutions.map((solution, i) => (
              <Reveal key={solution.slug} delay={i * 0.08}>
                {image(solution.section, 'image', 'imageAlt', 'audience-product-image')}
                <h3>{text(solution.section, 'name')}</h3>
                <p>{text(solution.section, 'headline')}</p>
                <a className="text-link" href={href(`/products/${solution.slug}`)}>
                  {text(section, 'explore')} <ArrowRight size={19} />
                </a>
              </Reveal>
            ))}
          </div>
        </div>
        <Wave fill="var(--surface)" />
      </section>
      <section className="audience-closing">
        <Reveal className="container">
          <h2>{text(section, 'closingTitle')}</h2>
          <p className="body-copy">{text(section, 'closingBody')}</p>
          <a
            className="button"
            href={destination('contactLink')}
            {...field(section, 'contactLink')}
          >
            {text(section, professional ? 'primaryLabel' : 'secondaryLabel')}{' '}
            <ArrowRight size={19} />
          </a>
        </Reveal>
        <Wave />
      </section>
    </main>
  )
}
