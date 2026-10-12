import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { LANGUAGES, type Lang } from '../shared/types'

const names: Record<Lang, string> = {
  nl: 'Nederlands',
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
}

export default function LanguagePicker({
  lang,
  label,
  onChange,
}: {
  lang: Lang
  label: string
  onChange: (lang: Lang) => void
}) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const options = useRef<Array<HTMLButtonElement | null>>([])
  const reduced = useReducedMotion()

  useEffect(() => {
    if (!open) return
    options.current[LANGUAGES.indexOf(lang)]?.focus()
    const dismiss = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open, lang])

  function onKeyDown(event: KeyboardEvent, index: number) {
    let next: number | undefined
    if (event.key === 'ArrowDown') next = (index + 1) % LANGUAGES.length
    if (event.key === 'ArrowUp') next = (index + LANGUAGES.length - 1) % LANGUAGES.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = LANGUAGES.length - 1
    if (next !== undefined) {
      event.preventDefault()
      options.current[next]?.focus()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setOpen(false)
      trigger.current?.focus()
    }
  }

  return (
    <div
      className="language-picker"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false)
      }}
    >
      <button
        ref={trigger}
        className="language-trigger"
        aria-label={`${label}: ${names[lang]}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="language-menu"
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        {lang.toUpperCase()}
        <CaretDown size={12} weight="bold" className={open ? 'is-open' : ''} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            id="language-menu"
            className="language-menu"
            role="menu"
            aria-label={label}
            initial={{ opacity: 0, y: reduced ? 0 : -6, scale: reduced ? 1 : 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: reduced ? 0 : -3 }}
            transition={{ duration: reduced ? 0 : 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {LANGUAGES.map((value, index) => (
              <button
                key={value}
                ref={(element) => { options.current[index] = element }}
                role="menuitemradio"
                aria-checked={lang === value}
                tabIndex={-1}
                onKeyDown={(event) => onKeyDown(event, index)}
                onClick={() => {
                  setOpen(false)
                  trigger.current?.focus()
                  onChange(value)
                }}
              >
                <span className="language-code">{value.toUpperCase()}</span>
                <span lang={value}>{names[value]}</span>
                {value === lang && <Check size={15} weight="bold" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
