import { createContext, useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { Content } from '../shared/types'

export const IntroComplete = createContext(true)

// Entrances overlap on one timeline; opacity eases gently while movement settles slowly.
export function entrance(delay: number, reduced: boolean, fadeOnly = false) {
  return {
    initial: reduced
      ? (false as const)
      : { opacity: 0, y: fadeOnly ? 0 : 14, visibility: 'hidden' as const },
    animate: { opacity: 1, y: 0, visibility: 'visible' as const },
    transition: {
      duration: reduced ? 0 : fadeOnly ? 1.6 : 1.1,
      delay: reduced ? 0 : delay,
      ease: [0.16, 1, 0.3, 1] as const,
      opacity: {
        duration: reduced ? 0 : fadeOnly ? 1.6 : 0.95,
        delay: reduced ? 0 : delay,
        ease: [0.4, 0, 0.2, 1] as const,
      },
    },
  }
}

export function useIntro(content: Content | null, bypass: boolean) {
  const reduced = Boolean(useReducedMotion())
  const [ready, setReady] = useState(bypass)
  const [complete, setComplete] = useState(bypass)
  const [progress, setProgress] = useState(0)
  const hero = content?.sections.hero.image
  const logo = content?.sections.header.logo

  useEffect(() => {
    if (ready || !content) return
    let cancelled = false
    let finished = 1 // The content request is the first of four critical resources.
    setProgress(25)
    const report = () => {
      finished += 1
      if (!cancelled) setProgress(finished * 25)
    }
    const loadImage = async (src: string | undefined) => {
      if (!src) return
      const image = new Image()
      image.src = src
      await image.decode().catch(() => undefined)
    }
    let minimumTimer: ReturnType<typeof setTimeout>
    let timeout: ReturnType<typeof setTimeout>
    let finishTimer: ReturnType<typeof setTimeout> | undefined
    const minimum = new Promise<void>((resolve) => {
      minimumTimer = setTimeout(resolve, reduced ? 0 : 900)
    })
    // A failed or stalled asset must never leave the visitor behind a loader.
    const deadline = new Promise<void>((resolve) => {
      timeout = setTimeout(resolve, 8000)
    })
    const resources = Promise.all([
      loadImage(hero).then(report),
      loadImage(logo).then(report),
      document.fonts.ready.then(report, report),
    ])
    void Promise.all([Promise.race([resources, deadline]), minimum]).then(() => {
      if (!cancelled) {
        setProgress(100)
        finishTimer = setTimeout(() => setReady(true), reduced ? 0 : 350)
      }
    })
    return () => {
      cancelled = true
      clearTimeout(minimumTimer)
      clearTimeout(timeout)
      clearTimeout(finishTimer)
    }
  }, [content, hero, logo, ready, reduced])

  useEffect(() => {
    if (!ready) return
    if (reduced || bypass) {
      setComplete(true)
      return
    }
    const timer = setTimeout(() => setComplete(true), 2250)
    return () => clearTimeout(timer)
  }, [ready, reduced, bypass])

  return { ready, complete, progress, reduced: reduced || bypass }
}

export function LoadingScreen({
  label,
  progress,
  reduced,
}: {
  label: string
  progress: number
  reduced: boolean
}) {
  return (
    <motion.div
      className="intro-loader"
      role="status"
      aria-label={label}
      exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : 0.5, ease: 'easeInOut' }}
    >
      <motion.div
        className="intro-loader-content"
        initial={reduced ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: reduced ? 0 : 0.15, duration: 0.25 }}
      >
        <p>{label}</p>
        <div
          className="intro-progress"
          role="progressbar"
          aria-label={label}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progress}
        >
          <motion.span
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progress / 100 }}
            transition={{ duration: reduced ? 0 : 0.3, ease: 'easeOut' }}
          />
        </div>
      </motion.div>
    </motion.div>
  )
}
