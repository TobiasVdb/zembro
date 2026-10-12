import { useContext, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { IntroComplete } from './Intro'

export function Reveal({
  children,
  className = '',
  delay = 0,
}: {
  children: ReactNode
  className?: string
  delay?: number
}) {
  const reduced = useReducedMotion()
  const introComplete = useContext(IntroComplete)
  return (
    <motion.div
      className={className}
      initial={reduced ? false : { opacity: 0, y: 24 }}
      whileInView={introComplete ? { opacity: 1, y: 0 } : undefined}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        duration: reduced ? 0 : 1,
        delay: reduced ? 0 : delay,
        ease: [0.16, 1, 0.3, 1],
        opacity: {
          duration: reduced ? 0 : 0.9,
          delay: reduced ? 0 : delay,
          ease: [0.4, 0, 0.2, 1],
        },
      }}
    >
      {children}
    </motion.div>
  )
}
