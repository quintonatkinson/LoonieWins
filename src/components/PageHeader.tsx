import type { ReactNode } from 'react'

/**
 * Shared page title row for Mine / Earn / Profile / secondary screens.
 * Keeps spacing and hierarchy consistent across tabs.
 */
export default function PageHeader({
  icon,
  title,
  subtitle,
  action,
  testId,
}: {
  icon?: ReactNode
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  testId?: string
}) {
  return (
    <div
      className="flex items-start justify-between gap-3 flex-wrap"
      data-testid={testId}
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon != null && (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-win/20 border border-win/40 shrink-0">
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-white">{title}</h1>
          {subtitle != null && (
            <div className="text-sm text-gray-400 mt-0.5">{subtitle}</div>
          )}
        </div>
      </div>
      {action != null && <div className="shrink-0">{action}</div>}
    </div>
  )
}
