import { Link } from 'react-router-dom'
import type { LegalSection } from '../lib/legal/content'

export default function LegalPage({
  title,
  lastUpdated,
  sections,
}: {
  title: string
  lastUpdated?: string
  sections: LegalSection[]
}) {
  return (
    <div className="p-4 pb-24 max-w-2xl mx-auto space-y-6">
      <div>
        <Link to="/profile" className="text-sm text-win hover:underline">
          ← Back to Profile
        </Link>
        <h1 className="text-2xl font-semibold text-white mt-3">{title}</h1>
        {lastUpdated && (
          <p className="text-xs text-gray-500 mt-1">Last updated: {lastUpdated}</p>
        )}
      </div>
      {sections.map((section) => (
        <section key={section.heading} className="space-y-2">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wide">
            {section.heading}
          </h2>
          {section.paragraphs.map((p) => (
            <p key={p.slice(0, 48)} className="text-sm text-gray-300 leading-relaxed">
              {p}
            </p>
          ))}
          {section.bullets && (
            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-300">
              {section.bullets.map((b) => (
                <li key={b.slice(0, 48)}>{b}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  )
}
