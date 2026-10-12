import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type MouseEvent,
  type KeyboardEvent,
} from 'react'
import { AnimatePresence, motion, MotionConfig } from 'motion/react'
import {
  ArrowRight,
  ArrowUp,
  Play,
  Sun,
  Moon,
  List,
  X,
  PhoneCall,
  MapPin,
  HandHeart,
  Feather,
  ShieldCheck,
} from '@phosphor-icons/react'
import { PRODUCTS, type Content, type SectionKey } from '../shared/types'
import { localHref } from '../shared/routes'
import { PRODUCT_PATHS, PUBLIC_PATHS } from '../shared/routes'
import { api, base } from './api'
import { useLanguage, useScrollNavigation, useTheme } from './hooks'
import { entrance, IntroComplete, LoadingScreen, useIntro } from './Intro'
import { Reveal } from './Reveal'
import { Wave } from './Wave'
import { SilverShieldScene } from './SilverShieldScene'
import Products from './Products'
import LegalPage from './LegalPage'
import AudiencePage from './AudiencePage'
import LanguagePicker from './LanguagePicker'
const Editor = lazy(() => import('./Editor'))
export interface Selection {
  section: SectionKey
  path: string
}
const initialUi = {
  nl: {
    loading: 'Even geduld…',
    error: 'De inhoud kon niet worden geladen.',
    retry: 'Opnieuw proberen',
  },
  en: { loading: 'Loading…', error: 'The content could not be loaded.', retry: 'Try again' },
  fr: { loading: 'Chargement…', error: 'Le contenu n’a pas pu être chargé.', retry: 'Réessayer' },
  de: {
    loading: 'Wird geladen…',
    error: 'Der Inhalt konnte nicht geladen werden.',
    retry: 'Erneut versuchen',
  },
}
function Film({
  src,
  title,
  closeLabel,
  onClose,
}: {
  src: string
  title: string
  closeLabel: string
  onClose: () => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const previous = document.activeElement
    const dialog = ref.current
    dialog?.showModal()
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      dialog?.close()
      document.body.style.overflow = overflow
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className="film-dialog"
      aria-label={title}
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="film-inner">
        <div className="film-head">
          <span>{title}</span>
          <button className="icon-button" onClick={onClose} autoFocus aria-label={closeLabel}>
            <X size={24} />
          </button>
        </div>
        <video src={src} controls autoPlay playsInline preload="metadata" />
      </div>
    </dialog>
  )
}
export default function App() {
  const [lang, changeLanguage] = useLanguage()
  const [theme, toggleTheme] = useTheme()
  const { floating, showBackToTop } = useScrollNavigation()
  const homeLink = useRef<HTMLAnchorElement>(null)
  const [content, setContent] = useState<Content | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [menu, setMenu] = useState(false)
  const [film, setFilm] = useState(false)
  const [authenticated, setAuthenticated] = useState(false)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [selection, setSelection] = useState<Selection | null>(null)
  const admin = location.pathname.replace(/\/$/, '').endsWith('/admin')
  const pathname = location.pathname.slice(base.length).replace(/\/$/, '')
  const productPage = pathname === '/products' || pathname.startsWith('/products/')
  const legalSection =
    pathname === '/privacy' ? 'legalPrivacy' : pathname === '/terms' ? 'legalTerms' : undefined
  const audienceSection =
    pathname === '/for-loved-ones'
      ? 'lovedOnes'
      : pathname === '/for-care-providers'
        ? 'careProviders'
        : undefined
  const innerPage = productPage || !!legalSection || !!audienceSection
  const slug = pathname.startsWith('/products/') ? pathname.slice('/products/'.length) : undefined
  const intro = useIntro(content, admin || innerPage)
  const href = (path: string) => localHref(path, base, location.search, lang)
  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(false)
    api<Content>(`/sites/zembro/content?lang=${lang}`, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return
        setContent(data)
        setLoading(false)
        try {
          localStorage.setItem('zembro.language', lang)
        } catch {
          /* URL remains authoritative */
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setError(true)
          setLoading(false)
        }
      })
    return () => controller.abort()
  }, [lang, revision])
  useEffect(() => {
    api<{ authenticated: boolean }>('/auth/session')
      .then((data) => setAuthenticated(data.authenticated))
      .catch(() => setAuthenticated(false))
      .finally(() => setSessionLoading(false))
  }, [])
  useEffect(() => {
    if (!content) return
    document.documentElement.lang = content.lang
    const product = PRODUCTS.find((item) => item.slug === slug)
    document.title = productPage
      ? `${product ? content.sections[product.section].name : content.sections.catalog.nav} — Zembro`
      : `Zembro — ${content.sections.footer.tagline}`
    if (legalSection) document.title = `${content.sections[legalSection].title} — Zembro`
    if (audienceSection)
      document.title = `${content.sections.header[audienceSection === 'lovedOnes' ? 'lovedOnes' : 'professionals']} — Zembro`
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute(
        'content',
        productPage
          ? product
            ? content.sections[product.section].body
            : content.sections.catalog.body
          : content.sections.ui.description,
      )
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#102b30' : '#faf9f6')
    if (legalSection)
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute('content', `${content.sections[legalSection].title} — Zembro`)
    if (audienceSection)
      document
        .querySelector('meta[name="description"]')
        ?.setAttribute('content', content.sections[audienceSection].body)
  }, [content, theme, productPage, slug, legalSection, audienceSection])
  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setMenu(false)
    }
    window.addEventListener('keydown', escape)
    return () => window.removeEventListener('keydown', escape)
  }, [])
  const chooseField = (target: EventTarget | null) => {
    if (!(target instanceof Element)) return false
    const element = target.closest<HTMLElement>('[data-field]')
    const section = element?.dataset.section
    const field = element?.dataset.field
    if (!section || !field) return false
    setSelection({ section: section as SectionKey, path: field })
    return true
  }
  const capture = (event: MouseEvent) => {
    if (editing && chooseField(event.target)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
  const keyCapture = (event: KeyboardEvent) => {
    if (editing && (event.key === 'Enter' || event.key === ' ') && chooseField(event.target)) {
      event.preventDefault()
      event.stopPropagation()
    }
  }
  const metadata = (section: SectionKey, path: string) => ({
    'data-section': section,
    'data-field': path,
    ...(editing
      ? { tabIndex: 0, role: 'button' as const, 'aria-label': `Edit ${section}.${path}` }
      : {}),
  })
  const t = (section: SectionKey, path: string) => content?.sections[section][path] ?? ''
  const publicDestination = (value: string) => (PUBLIC_PATHS.includes(value) ? href(value) : value)
  const text = (section: SectionKey, path: string) => (
    <span {...metadata(section, path)}>{t(section, path)}</span>
  )
  const image = (
    section: SectionKey,
    path: string,
    alt: string,
    className = '',
    priority = false,
  ) =>
    t(section, path) ? (
      <motion.img
        {...(section === 'hero' ? entrance(0.7, intro.reduced, true) : {})}
        {...metadata(section, path)}
        className={className}
        src={t(section, path)}
        alt={t(section, alt)}
        loading={priority ? 'eager' : 'lazy'}
        fetchPriority={priority ? 'high' : 'auto'}
        decoding="async"
      />
    ) : editing ? (
      <span {...metadata(section, path)}>Choose image</span>
    ) : null
  const link = (section: SectionKey, label: string, href: string, button = false) => (
    <a
      className={button ? 'button' : 'text-link'}
      href={
        PUBLIC_PATHS.includes(t(section, href))
          ? localHref(t(section, href), base, location.search, lang)
          : t(section, href)
      }
      {...metadata(section, href)}
    >
      {text(section, label)}
      {!button && <ArrowRight size={19} />}
    </a>
  )
  const ui = content?.sections.ui ?? initialUi[lang]
  const sectionBackground = (key?: string) =>
    key === 'ambient' ? 'var(--surface)' : key === 'impact' ? 'var(--tint)' : 'var(--paper)'
  const sectionEdge = (key: SectionKey) => {
    const order = content?.order ?? []
    const next = order[order.indexOf(key) + 1]
    // The photographic impact section shapes its own incoming edge.
    return next === 'impact' ? null : <Wave fill={sectionBackground(next)} />
  }
  const sections: Record<string, ReactNode> = {
    wearable: (
      <section className="section wearable" id="solutions" key="wearable">
        <div className="container wearable-grid">
          <Reveal className="section-copy">
            <p className="eyebrow">{text('wearable', 'eyebrow')}</p>
            <h2>{text('wearable', 'title')}</h2>
            <p className="body-copy">{text('wearable', 'body')}</p>
            {link('wearable', 'cta', 'link')}
          </Reveal>
          <Reveal className="product-visual" delay={0.1}>
            {image('wearable', 'image', 'imageAlt', 'mini-image')}
            <a
              className="text-link watch-link"
              href={
                PRODUCT_PATHS.includes(t('wearable', 'watchLink'))
                  ? href(t('wearable', 'watchLink'))
                  : t('wearable', 'watchLink')
              }
              {...metadata('wearable', 'watchLink')}
            >
              {image('wearable', 'watch', 'watchAlt', 'watch-card-image')}
              <span className="watch-card-copy">{text('wearable', 'watchText')}</span>
              <ArrowRight size={21} aria-hidden="true" />
            </a>
          </Reveal>
          <Reveal className="features" delay={0.2}>
            {[PhoneCall, MapPin, HandHeart, Feather].map((Icon, i) => (
              <div className="feature" key={i}>
                <span className="feature-icon">
                  <Icon size={26} weight="duotone" />
                </span>
                {text('wearable', `feature${i + 1}`)}
              </div>
            ))}
          </Reveal>
        </div>
        {sectionEdge('wearable')}
      </section>
    ),
    ambient: (
      <section className="section ambient" id="technology" key="ambient">
        <SilverShieldScene theme={theme} image={image} />
        <div className="container ambient-layout">
          <Reveal className="section-copy">
            <p className="eyebrow">{text('ambient', 'eyebrow')}</p>
            <h2>{text('ambient', 'title')}</h2>
            <p className="body-copy">{text('ambient', 'body')}</p>
            {link('ambient', 'cta', 'link')}
            <p className="privacy-note">
              <ShieldCheck size={20} />
              {text('ambient', 'privacy')}
            </p>
          </Reveal>
        </div>
        {sectionEdge('ambient')}
      </section>
    ),
    platform: (
      <section className="section platform" id="platform" key="platform">
        <div className="container platform-grid">
          <Reveal className="section-copy">
            <p className="eyebrow">{text('platform', 'eyebrow')}</p>
            <h2>{text('platform', 'title')}</h2>
            <p className="body-copy">{text('platform', 'body')}</p>
            {link('platform', 'cta', 'link')}
          </Reveal>
          <Reveal className="phone-visual" delay={0.12}>
            {image('platform', 'image', 'imageAlt', 'phone-image')}
          </Reveal>
          <Reveal className="handwritten platform-note" delay={0.2}>
            {text('platform', 'note')}
            <span className="note-rule" />
          </Reveal>
        </div>
        {sectionEdge('platform')}
      </section>
    ),
    impact: (
      <section className="section impact" id="about" key="impact">
        {image('impact', 'image', 'imageAlt', 'impact-image')}
        {(content?.order.indexOf('impact') ?? 0) > 0 && (
          <Wave
            top
            fill={sectionBackground(content?.order[(content?.order.indexOf('impact') ?? 0) - 1])}
          />
        )}
        <div className="container impact-layout">
          <Reveal className="section-copy">
            <p className="eyebrow">{text('impact', 'eyebrow')}</p>
            <h2>{text('impact', 'title')}</h2>
            <p className="body-copy">{text('impact', 'body')}</p>
            {link('impact', 'cta', 'link', true)}
          </Reveal>
          <Reveal className="handwritten impact-note" delay={0.15}>
            {text('impact', 'note')}
            <span className="note-rule" />
          </Reveal>
        </div>
        {sectionEdge('impact')}
      </section>
    ),
  }
  return (
    <MotionConfig reducedMotion="user">
      {admin && sessionLoading && (
        <p className="page-status" role="status">
          {ui.loading}
        </p>
      )}
      {admin && !sessionLoading && !authenticated ? (
        <Suspense fallback={<p className="page-status">{ui.loading}</p>}>
          <Editor
            lang={lang}
            authenticated={false}
            onAuth={setAuthenticated}
            editing={editing}
            onEditing={setEditing}
            selection={selection}
            onSelection={setSelection}
            onSaved={refresh}
          />
        </Suspense>
      ) : null}
      {(!admin || authenticated) && (
        <>
          <a className="skip-link" href="#main">
            {content?.sections.ui.skip || 'Ga naar inhoud'}
          </a>
          <AnimatePresence>
            {!intro.ready && !error && (
              <LoadingScreen label={ui.loading} progress={intro.progress} reduced={intro.reduced} />
            )}
          </AnimatePresence>
          {error ? (
            <div className="page-status" role="alert">
              <p>{ui.error}</p>
              <button className="button" onClick={refresh}>
                {ui.retry}
              </button>
            </div>
          ) : null}
          {content && !error && intro.ready && (
            <div
              className={`site ${editing ? 'is-editing' : ''} ${innerPage ? 'product-site' : ''}`}
              onClickCapture={capture}
              onKeyDownCapture={keyCapture}
              aria-busy={loading}
            >
              <header className={`header container${floating ? ' header-floating' : ''}`}>
                <motion.a
                  ref={homeLink}
                  {...entrance(0.08, intro.reduced)}
                  className="brand"
                  href={href('/')}
                  aria-label={t('header', 'logoAlt')}
                >
                  {image('header', 'logo', 'logoAlt', 'logo', true)}
                </motion.a>
                <nav
                  className={menu ? 'navigation open' : 'navigation'}
                  aria-label={t('ui', 'menu')}
                >
                  <motion.a
                    {...entrance(0.28, intro.reduced)}
                    href={href('/products')}
                    aria-current={productPage ? 'page' : undefined}
                    onClick={() => setMenu(false)}
                  >
                    {text('catalog', 'nav')}
                  </motion.a>
                  <motion.a
                    {...entrance(0.36, intro.reduced)}
                    href={innerPage ? href('/#technology') : '#technology'}
                    onClick={() => setMenu(false)}
                  >
                    {text('header', 'technology')}
                  </motion.a>
                  <motion.a
                    {...entrance(0.44, intro.reduced)}
                    href={publicDestination(t('header', 'lovedOnesLink'))}
                    aria-current={audienceSection === 'lovedOnes' ? 'page' : undefined}
                    onClick={() => setMenu(false)}
                    {...metadata('header', 'lovedOnesLink')}
                  >
                    {text('header', 'lovedOnes')}
                  </motion.a>
                  <motion.a
                    {...entrance(0.48, intro.reduced)}
                    href={publicDestination(t('header', 'professionalLink'))}
                    aria-current={audienceSection === 'careProviders' ? 'page' : undefined}
                    onClick={() => setMenu(false)}
                    {...metadata('header', 'professionalLink')}
                  >
                    {text('header', 'professionals')}
                  </motion.a>
                  <motion.a
                    {...entrance(0.52, intro.reduced)}
                    href={innerPage ? href('/#about') : '#about'}
                    onClick={() => setMenu(false)}
                  >
                    {text('header', 'about')}
                  </motion.a>
                </nav>
                <motion.div {...entrance(0.6, intro.reduced)} className="header-tools">
                  <a
                    className="button header-contact"
                    href={t('header', 'contactLink')}
                    {...metadata('header', 'contactLink')}
                  >
                    {text('header', 'contact')}
                  </a>
                  <LanguagePicker
                    lang={lang}
                    label={t('ui', 'language')}
                    onChange={(value) => {
                      changeLanguage(value)
                      setMenu(false)
                    }}
                  />
                  <button
                    className="icon-button theme-toggle"
                    onClick={toggleTheme}
                    aria-label={theme === 'dark' ? t('ui', 'light') : t('ui', 'dark')}
                  >
                    {theme === 'dark' ? <Sun size={21} /> : <Moon size={20} />}
                  </button>
                  <button
                    className="icon-button menu-toggle"
                    aria-label={menu ? t('ui', 'close') : t('ui', 'menu')}
                    aria-expanded={menu}
                    onClick={() => setMenu(!menu)}
                  >
                    {menu ? <X size={25} /> : <List size={25} />}
                  </button>
                </motion.div>
              </header>
              {audienceSection ? (
                <AudiencePage
                  section={audienceSection}
                  content={content}
                  href={href}
                  text={text}
                  image={image}
                  field={metadata}
                />
              ) : legalSection ? (
                <LegalPage
                  section={legalSection}
                  content={content}
                  href={href}
                  text={text}
                  field={metadata}
                />
              ) : productPage ? (
                <Products
                  theme={theme}
                  content={content}
                  slug={slug}
                  href={href}
                  text={text}
                  image={image}
                  field={metadata}
                />
              ) : (
                <main id="main">
                  <section className="hero">
                    {image('hero', 'image', 'imageAlt', 'hero-image', true)}
                    <div className="hero-wash" />
                    <div className="container hero-content">
                      <div className="hero-copy">
                        <motion.p {...entrance(1.1, intro.reduced)} className="eyebrow">
                          {text('hero', 'eyebrow')}
                        </motion.p>
                        <h1>
                          <motion.span className="intro-line" {...entrance(1.24, intro.reduced)}>
                            {text('hero', 'title')}
                          </motion.span>
                          <br />
                          <motion.em className="intro-line" {...entrance(1.38, intro.reduced)}>
                            {text('hero', 'accent')}
                          </motion.em>
                        </h1>
                        <motion.p {...entrance(1.55, intro.reduced)} className="body-copy">
                          {text('hero', 'body')}
                        </motion.p>
                        <motion.button
                          {...entrance(1.72, intro.reduced)}
                          className="button film-button"
                          onClick={() => setFilm(true)}
                        >
                          <Play size={17} weight="fill" />
                          {text('hero', 'cta')}
                        </motion.button>
                      </div>
                      <motion.div
                        {...entrance(1.85, intro.reduced)}
                        className="handwritten hero-note"
                      >
                        {text('hero', 'note')}
                        <span className="note-rule" />
                      </motion.div>
                    </div>
                    <Wave fill={sectionBackground(content.order[0])} />
                  </section>
                  <IntroComplete.Provider value={intro.complete}>
                    <motion.div
                      className="following-sections"
                      initial={intro.reduced ? false : { opacity: 0 }}
                      animate={{ opacity: intro.complete ? 1 : 0 }}
                      transition={{ duration: intro.reduced ? 0 : 1, ease: 'easeInOut' }}
                      style={{ visibility: intro.complete ? 'visible' : 'hidden' }}
                      inert={!intro.complete}
                    >
                      {content.order.map((key) => sections[key])}
                    </motion.div>
                  </IntroComplete.Provider>
                </main>
              )}
              <footer
                className="footer"
                style={{ visibility: intro.complete ? 'visible' : 'hidden' }}
                inert={!intro.complete}
              >
                <div className="container">
                  <div className="footer-main">
                    <div className="footer-brand">
                      <a className="brand" href={href('/')}>
                        {image('header', 'logo', 'logoAlt', 'logo')}
                      </a>
                      <p>{text('footer', 'tagline')}</p>
                    </div>
                    <nav aria-label={t('ui', 'menu')}>
                      <div className="footer-link-group">
                        <a href={href('/products')}>{text('catalog', 'nav')}</a>
                        <a href={innerPage ? href('/#technology') : '#technology'}>
                          {text('header', 'technology')}
                        </a>
                        <a href={innerPage ? href('/#about') : '#about'}>
                          {text('header', 'about')}
                        </a>
                      </div>
                      <div className="footer-link-group">
                        <a href={publicDestination(t('header', 'lovedOnesLink'))}>
                          {text('header', 'lovedOnes')}
                        </a>
                        <a href={publicDestination(t('header', 'professionalLink'))}>
                          {text('header', 'professionals')}
                        </a>
                        <a className="footer-contact-link" href={t('header', 'contactLink')}>
                          {text('header', 'contact')} <ArrowRight size={19} aria-hidden="true" />
                        </a>
                      </div>
                    </nav>
                  </div>
                  <div className="footer-bottom">
                    <small>
                      © {new Date().getFullYear()} Zembro. {text('footer', 'rights')}
                    </small>
                    <div>
                      {link('footer', 'privacy', 'privacyLink')}
                      {link('footer', 'terms', 'termsLink')}
                    </div>
                  </div>
                </div>
              </footer>
              <AnimatePresence>
                {intro.complete && showBackToTop && (
                  <motion.button
                    className="back-to-top"
                    initial={{ opacity: 0, y: intro.reduced ? 0 : 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: intro.reduced ? 0 : 12 }}
                    transition={{ duration: intro.reduced ? 0 : 0.3, ease: 'easeOut' }}
                    aria-label={
                      {
                        nl: 'Terug naar boven',
                        en: 'Back to top',
                        fr: 'Retour en haut',
                        de: 'Nach oben',
                      }[lang]
                    }
                    onClick={() => {
                      setMenu(false)
                      window.scrollTo({ top: 0, behavior: intro.reduced ? 'instant' : 'smooth' })
                      homeLink.current?.focus({ preventScroll: true })
                    }}
                  >
                    <ArrowUp size={22} aria-hidden="true" />
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          )}
          {film && content && (
            <Film
              src={t('hero', 'video')}
              title={t('hero', 'cta')}
              closeLabel={t('ui', 'close')}
              onClose={() => setFilm(false)}
            />
          )}
          {authenticated && (
            <Suspense fallback={null}>
              <Editor
                lang={lang}
                authenticated
                onAuth={setAuthenticated}
                editing={editing}
                onEditing={setEditing}
                selection={selection}
                onSelection={setSelection}
                onSaved={refresh}
              />
            </Suspense>
          )}
        </>
      )}
    </MotionConfig>
  )
}
