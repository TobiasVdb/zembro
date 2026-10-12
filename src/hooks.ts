import { useEffect, useState } from 'react'
import { isLang, type Lang } from '../shared/types'
export function useScrollNavigation() {
  const [floating, setFloating] = useState(() => window.scrollY > 80)
  const [showBackToTop, setShowBackToTop] = useState(() => window.scrollY > 360)
  useEffect(() => {
    const update = () => {
      setFloating(window.scrollY > 80)
      setShowBackToTop(window.scrollY > 360)
    }
    window.addEventListener('scroll', update, { passive: true })
    update()
    return () => window.removeEventListener('scroll', update)
  }, [])
  return { floating, showBackToTop }
}
export function useLanguage() {
  const read = (): Lang => {
    const param = new URLSearchParams(location.search).get('lang')
    if (isLang(param)) return param
    try {
      const saved = localStorage.getItem('zembro.language')
      if (isLang(saved)) return saved
    } catch {
      /* URL still works */
    }
    return 'nl'
  }
  const [lang, setLang] = useState<Lang>(read)
  useEffect(() => {
    const onPop = () => setLang(read())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const change = (next: Lang) => {
    const url = new URL(location.href)
    url.searchParams.set('lang', next)
    history.replaceState(null, '', url)
    setLang(next)
  }
  return [lang, change] as const
}
export function useTheme() {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light')
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)')
    const change = () => {
      try {
        if (localStorage.getItem('zembro.theme')) return
      } catch {
        /* follow OS */
      }
      const next = query.matches ? 'dark' : 'light'
      document.documentElement.dataset.theme = next
      setTheme(next)
    }
    query.addEventListener('change', change)
    return () => query.removeEventListener('change', change)
  }, [])
  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    setTheme(next)
    try {
      localStorage.setItem('zembro.theme', next)
    } catch {
      /* in-memory selection still works */
    }
  }
  return [theme, toggle] as const
}
