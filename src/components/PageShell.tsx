import type { ReactNode } from 'react'

/**
 * Shared page frame — consistent horizontal padding, bottom clearance for
 * fixed nav, and a readable max width on desktop.
 */
export default function PageShell({
  children,
  className = '',
  wide = false,
  testId,
}: {
  children: ReactNode
  className?: string
  /** Wider feed-style pages (Home) */
  wide?: boolean
  testId?: string
}) {
  return (
    <div
      data-testid={testId}
      className={`w-full mx-auto px-4 pt-4 pb-28 ${
        wide ? 'max-w-3xl' : 'max-w-2xl'
      } ${className}`}
    >
      {children}
    </div>
  )
}
