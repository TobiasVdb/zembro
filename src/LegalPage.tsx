import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { LayoutGroup, motion, useReducedMotion } from 'motion/react'
import { isLang, type Content, type SectionKey } from '../shared/types'
import { parseLegalBody, parseLegalInline } from '../shared/legal'
import type { FieldMetadata } from './Products'
import { Reveal } from './Reveal'
import { Wave } from './Wave'

export default function LegalPage({
  section,
  content,
  href,
  text,
  field,
}: {
  section: 'legalPrivacy' | 'legalTerms'
  content: Content
  href: (path: string) => string
  text: (section: SectionKey, path: string) => ReactNode
  field: (section: SectionKey, path: string) => FieldMetadata
}) {
  const values = content.sections[section]
  const bodies = useMemo(
    () =>
      Object.keys(values)
        .filter((key) => /^body\d+$/.test(key))
        .sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)))
        .map((key) => ({ key, blocks: parseLegalBody(values[key]) })),
    [values],
  )
  const headings = useMemo(
    () =>
      bodies.flatMap(({ key, blocks }) =>
        blocks.flatMap((block, i) =>
          block.kind === 'heading' ? [{ id: `${key}-${i}`, text: block.text }] : [],
        ),
      ),
    [bodies],
  )
  const [activeId, setActiveId] = useState('')
  const pendingScroll = useRef(false)
  const navRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()
  const groupId = useId()
  const selectedId = headings.some(({ id }) => id === activeId) ? activeId : headings[0]?.id
  const pillTransition = { duration: reduced ? 0 : 0.55, ease: [0.22, 1, 0.36, 1] as const }

  useEffect(() => {
    let frame = 0
    let settleTimer: ReturnType<typeof setTimeout>
    pendingScroll.current = false
    const update = () => {
      if (pendingScroll.current) return
      let current = headings[0]?.id ?? ''
      for (const heading of headings) {
        const element = document.getElementById(heading.id)
        if (element && element.getBoundingClientRect().top <= 160) current = heading.id
      }
      setActiveId(current)
    }
    const settle = () => {
      pendingScroll.current = false
    }
    const onScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
      clearTimeout(settleTimer)
      // Keeps a clicked destination selected while native smooth scrolling passes other headings.
      settleTimer = setTimeout(settle, 180)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(settleTimer)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [headings])

  useEffect(() => {
    const nav = navRef.current
    const selected = nav?.querySelector<HTMLElement>('[aria-current="location"]')
    if (!nav || !selected) return
    const parent = nav.getBoundingClientRect()
    const item = selected.getBoundingClientRect()
    if (item.top < parent.top || item.bottom > parent.bottom) {
      nav.scrollTo({
        top: nav.scrollTop + item.top - parent.top - (nav.clientHeight - item.height) / 2,
        behavior: reduced ? 'instant' : 'smooth',
      })
    }
  }, [selectedId, reduced])

  const selectHeading = (id: string) => {
    const heading = document.getElementById(id)
    if (!heading) return
    pendingScroll.current = !reduced
    setActiveId(id)
    window.history.replaceState(null, '', `#${id}`)
    heading.focus({ preventScroll: true })
    heading.scrollIntoView({ behavior: reduced ? 'instant' : 'smooth', block: 'start' })
  }
  const localLink = (destination: string) => {
    try {
      const url = new URL(destination)
      if (['zembro.com', 'www.zembro.com'].includes(url.hostname)) {
        if (/\/policies\/privacy-policy\/?$/.test(url.pathname)) return href('/privacy')
        if (/\/policies\/terms-of-service\/?$/.test(url.pathname)) return href('/terms')
      }
    } catch {
      /* Section, email and telephone destinations remain unchanged. */
    }
    return destination
  }
  const inline = (value: string) =>
    parseLegalInline(value).map((part, i) =>
      part.kind === 'link' ? (
        <a key={i} href={localLink(part.href)}>
          {part.text}
        </a>
      ) : part.kind === 'strong' ? (
        <strong key={i}>{part.text}</strong>
      ) : (
        part.text
      ),
    )
  return (
    <main id="main" className="legal-page">
      <section className="legal-hero">
        <Reveal className="container">
          <p className="eyebrow">{text(section, 'eyebrow')}</p>
          <h1>{text(section, 'title')}</h1>
          <nav className="legal-tabs" aria-label={values.eyebrow}>
            <a
              href={href('/privacy')}
              aria-current={section === 'legalPrivacy' ? 'page' : undefined}
            >
              {text('footer', 'privacy')}
            </a>
            <a href={href('/terms')} aria-current={section === 'legalTerms' ? 'page' : undefined}>
              {text('footer', 'terms')}
            </a>
          </nav>
        </Reveal>
        <Wave />
      </section>
      <LayoutGroup id={groupId}>
        <div className="container legal-layout">
          <motion.aside layoutRoot className="legal-contents">
            <p>{text(section, 'contentsLabel')}</p>
            <motion.nav ref={navRef} layoutScroll aria-label={values.contentsLabel}>
              {headings.map((heading) => (
                <a
                  key={heading.id}
                  href={`#${heading.id}`}
                  aria-current={selectedId === heading.id ? 'location' : undefined}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
                    event.preventDefault()
                    selectHeading(heading.id)
                  }}
                >
                  {selectedId === heading.id && (
                    <motion.span
                      className="legal-nav-pill"
                      layoutId="legal-nav-pill"
                      transition={pillTransition}
                      style={{ borderRadius: 14 }}
                      aria-hidden="true"
                    />
                  )}
                  <span>
                    {parseLegalInline(heading.text)
                      .map((part) => part.text)
                      .join('')}
                  </span>
                </a>
              ))}
            </motion.nav>
          </motion.aside>
          <div className="legal-reading">
            {values.notice && <p className="legal-notice">{text(section, 'notice')}</p>}
            <article
              className="legal-copy"
              lang={isLang(values.sourceLanguage) ? values.sourceLanguage : 'nl'}
              aria-label={values.title}
            >
              {bodies.map(({ key, blocks }) => (
                <div key={key} {...field(section, key)}>
                  {blocks.map((block, i) => {
                    if (block.kind === 'heading')
                      return (
                        <h2
                          key={i}
                          id={`${key}-${i}`}
                          tabIndex={-1}
                          data-active={selectedId === `${key}-${i}` || undefined}
                        >
                          {selectedId === `${key}-${i}` && (
                            <motion.span
                              className="legal-heading-pill"
                              layoutId="legal-heading-pill"
                              transition={pillTransition}
                              style={{ borderRadius: 18 }}
                              aria-hidden="true"
                            />
                          )}
                          <span>{inline(block.text)}</span>
                        </h2>
                      )
                    if (block.kind === 'paragraph') return <p key={i}>{inline(block.text)}</p>
                    if (block.kind === 'list') {
                      const List = block.ordered ? 'ol' : 'ul'
                      return (
                        <List key={i}>
                          {block.items.map((item, index) => (
                            <li key={index}>{inline(item)}</li>
                          ))}
                        </List>
                      )
                    }
                    return (
                      <div className="legal-table" key={i}>
                        <table>
                          <thead>
                            <tr>
                              {block.headers.map((cell, index) => (
                                <th key={index} scope="col">
                                  {inline(cell)}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {block.rows.map((row, index) => (
                              <tr key={index}>
                                {row.map((cell, cellIndex) => (
                                  <td key={cellIndex}>{inline(cell)}</td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )
                  })}
                </div>
              ))}
            </article>
          </div>
        </div>
      </LayoutGroup>
    </main>
  )
}
