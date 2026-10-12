import type { ReactNode } from 'react'
import type { SectionKey } from '../shared/types'

export function SilverShieldScene({
  theme,
  image,
  priority = false,
}: {
  theme: string
  image: (
    section: SectionKey,
    path: string,
    alt: string,
    className?: string,
    priority?: boolean,
  ) => ReactNode
  priority?: boolean
}) {
  return (
    <div className="ambient-scene">
      <div
        className="ambient-image-layer ambient-image-light"
        aria-hidden={theme === 'dark'}
        inert={theme === 'dark'}
      >
        {image('ambient', 'image', 'imageAlt', 'ambient-render', priority)}
      </div>
      <div
        className="ambient-image-layer ambient-image-dark"
        aria-hidden={theme !== 'dark'}
        inert={theme !== 'dark'}
      >
        {image('ambient', 'imageDark', 'imageDarkAlt', 'ambient-render', priority)}
      </div>
    </div>
  )
}
