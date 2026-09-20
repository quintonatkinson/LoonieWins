import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Contest } from '../lib/rssFetcher'
import { resolveContestUrl } from '../lib/rssFetcher'
import { reportUrl } from '../lib/utils/reportedUrls'
import { getInjectionScript } from '../lib/autofill/assassin'
import type { AutoFillData } from '../types/profile'

interface ContestBrowserProps {
  contest: Contest | null
  open: boolean
  onClose: () => void
  onMarkEntered?: (contest: Contest, status?: 'entered' | 'submitted') => void | Promise<unknown>
  autoFillData?: AutoFillData
  onAutoFillUsed?: () => void
}

const DEFAULT_AUTOFILL: AutoFillData = {
  name: '',
  email: '',
  address: '',
}

function decodeTitle(title: string): string {
  return title
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function CheatSheetBar({
  autoFillData,
  onCopied,
}: {
  autoFillData: AutoFillData
  onCopied?: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)

  const chips = useMemo(() => {
    const first =
      autoFillData.firstName ||
      autoFillData.name?.trim().split(/\s+/)[0] ||
      ''
    const last =
      autoFillData.lastName ||
      autoFillData.name?.trim().split(/\s+/).slice(1).join(' ') ||
      ''
    const full =
      autoFillData.name ||
      [first, last].filter(Boolean).join(' ') ||
      ''
    return [
      { label: 'Name', value: full },
      { label: 'First', value: first },
      { label: 'Last', value: last },
      { label: 'Email', value: autoFillData.email ?? '' },
      { label: 'Phone', value: autoFillData.phone ?? '' },
      { label: 'Addr', value: autoFillData.address ?? '' },
      { label: 'City', value: autoFillData.city ?? '' },
      { label: 'Prov', value: autoFillData.province ?? '' },
      { label: 'Postal', value: autoFillData.postalCode ?? '' },
    ].filter((c) => c.value.trim().length > 0)
  }, [autoFillData])

  const copy = useCallback(
    async (label: string, value: string) => {
      if (!value) return
      try {
        await navigator.clipboard.writeText(value)
        setCopied(label)
        onCopied?.()
        setTimeout(() => setCopied(null), 1500)
      } catch (_) {}
    },
    [onCopied]
  )

  if (chips.length === 0) {
    return (
      <div className="px-3 py-2 bg-surface border-t border-gray-600/50 shrink-0 text-xs text-amber-300">
        No autofill fields set —{' '}
        <Link to="/profile" className="underline text-win">
          add them in Profile
        </Link>
      </div>
    )
  }

  return (
    <div className="flex gap-2 px-3 py-2 bg-surface border-t border-gray-600/50 shrink-0 overflow-x-auto">
      {chips.map(({ label, value }) => (
        <button
          key={label}
          type="button"
          onClick={() => void copy(label, value)}
          title={value}
          className={`shrink-0 px-3 py-2 rounded-full text-sm font-medium border transition-colors ${
            copied === label
              ? 'bg-win/30 text-win border-win/50'
              : 'bg-surface-light border-gray-600/50 text-gray-300 hover:text-gray-50'
          }`}
        >
          {copied === label ? 'Copied!' : `[${label}]`}
        </button>
      ))}
    </div>
  )
}

export default function ContestBrowser({
  contest,
  open,
  onClose,
  onMarkEntered,
  autoFillData = DEFAULT_AUTOFILL,
  onAutoFillUsed,
}: ContestBrowserProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [iframeLikelyBlocked, setIframeLikelyBlocked] = useState(false)
  const [reportToast, setReportToast] = useState(false)
  const [autoFillMsg, setAutoFillMsg] = useState<string | null>(null)
  const [pendingMark, setPendingMark] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const isNativeRef = useRef<boolean | null>(null)
  const iframeLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hasProfile =
    Boolean(autoFillData.email?.trim()) ||
    Boolean(autoFillData.name?.trim()) ||
    Boolean(autoFillData.firstName?.trim())

  useEffect(() => {
    if (!open || !contest) return
    setLoading(true)
    setResolvedUrl(null)
    setIframeLikelyBlocked(false)
    setPendingMark(false)
    setAutoFillMsg(null)
    setStatusMsg(null)
    resolveContestUrl(contest.url, contest.contentSnippet ?? contest.description).then((url) => {
      setResolvedUrl(url)
      setLoading(false)
    })
  }, [open, contest])

  useEffect(() => {
    return () => {
      if (iframeLoadTimeoutRef.current) clearTimeout(iframeLoadTimeoutRef.current)
    }
  }, [])

  const confirmMark = useCallback(
    async (status: 'entered' | 'submitted' = 'entered') => {
      if (!contest || !onMarkEntered) return
      await onMarkEntered(contest, status)
      setPendingMark(false)
      setStatusMsg(status === 'submitted' ? 'Marked as submitted' : 'Marked as entered')
      setTimeout(() => onClose(), 450)
    },
    [contest, onMarkEntered, onClose]
  )

  const openNativeWebView = useCallback(
    async (url: string) => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return false

        const { InAppBrowser } = await import('@capgo/inappbrowser')
        const script = getInjectionScript(autoFillData)

        await InAppBrowser.openWebView({
          url,
          title: contest?.title ?? 'Contest',
          isPresentAfterPageLoad: true,
          preShowScript: script,
        })

        InAppBrowser.addListener('browserPageLoaded', async () => {
          try {
            await InAppBrowser.executeScript({ code: script })
            onAutoFillUsed?.()
          } catch (_) {}
        })

        InAppBrowser.addListener('closeEvent', () => {
          InAppBrowser.removeAllListeners()
          if (onMarkEntered) setPendingMark(true)
        })
        return true
      } catch (_) {
        return false
      }
    },
    [autoFillData, contest?.title, onAutoFillUsed, onMarkEntered]
  )

  const handleEnterContest = useCallback(() => {
    if (!resolvedUrl) return
    openNativeWebView(resolvedUrl).then((opened) => {
      if (!opened) {
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
        if (onMarkEntered) setPendingMark(true)
      }
    })
  }, [resolvedUrl, openNativeWebView, onMarkEntered])

  const handleEnterAndTrack = useCallback(() => {
    handleEnterContest()
  }, [handleEnterContest])

  const handleAutoFill = () => {
    if (!hasProfile) {
      setAutoFillMsg('Add autofill details in Profile first.')
      return
    }
    try {
      const doc = iframeRef.current?.contentDocument
      if (!doc) {
        setAutoFillMsg(
          'In-app form is blocked by the contest site. Use Open in Browser + copy chips, then mark entered.'
        )
        setIframeLikelyBlocked(true)
        return
      }
      const script = document.createElement('script')
      script.textContent = getInjectionScript(autoFillData)
      doc.body?.appendChild(script)
      script.remove()
      onAutoFillUsed?.()
      setAutoFillMsg('Autofill injected — check fields, then Mark as Entered.')
    } catch (_) {
      setAutoFillMsg(
        'Could not reach the form (cross-origin). Open in Browser and tap the copy chips.'
      )
      setIframeLikelyBlocked(true)
    }
  }

  const daysLeft = contest?.expiryDate
    ? Math.ceil(
        (new Date(contest.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      )
    : null

  if (!open) return null

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden
      />
      <div
        className="fixed left-0 right-0 bottom-0 z-50 glass rounded-t-2xl flex flex-col"
        style={{ height: '90vh' }}
        role="dialog"
        aria-modal
        aria-label="Contest entry – Smart Fill"
      >
        <div className="flex items-start justify-between p-4 border-b border-white/10 shrink-0">
          <div>
            <h2 className="font-semibold text-lg line-clamp-2">
              {decodeTitle(contest?.title ?? '')}
            </h2>
            <div className="flex gap-3 mt-1 text-sm text-white/80">
              {contest?.prizeValue != null && <span>${contest.prizeValue}</span>}
              {daysLeft != null && (
                <span>{daysLeft > 0 ? `${daysLeft} days left` : 'Ended'}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/80"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/10 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-white/90">Auto-Fill</h3>
            <Link to="/profile" className="text-xs text-win hover:underline">
              Edit in Profile
            </Link>
          </div>
          {!hasProfile ? (
            <p className="text-sm text-amber-300">
              Set your name & email in Profile for one-tap fill and copy chips.
            </p>
          ) : (
            <div className="text-sm text-white/70 space-y-1">
              <p>
                <span className="text-white/50">Name:</span>{' '}
                {autoFillData.name ||
                  [autoFillData.firstName, autoFillData.lastName].filter(Boolean).join(' ') ||
                  '—'}
              </p>
              <p>
                <span className="text-white/50">Email:</span> {autoFillData.email || '—'}
              </p>
              <p>
                <span className="text-white/50">Address:</span>{' '}
                {[autoFillData.address, autoFillData.city, autoFillData.province, autoFillData.postalCode]
                  .filter(Boolean)
                  .join(', ') || '—'}
              </p>
              {autoFillData.phone && (
                <p>
                  <span className="text-white/50">Phone:</span> {autoFillData.phone}
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-yellow-400/90 mt-2">
            Tap chips to copy when sites block embedding. Math / skill-test fields need your input.
          </p>
          {autoFillMsg && (
            <p className="text-xs text-win mt-2" role="status">
              {autoFillMsg}
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 relative flex flex-col">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center text-white/60">
              Resolving contest link…
            </div>
          ) : resolvedUrl ? (
            <>
              <div className="flex-1 min-h-0 relative flex flex-col">
                <iframe
                  ref={iframeRef}
                  src={resolvedUrl}
                  title="Contest entry form"
                  className="w-full flex-1 rounded-b-lg border-0 bg-white min-h-0"
                  sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
                  onLoad={() => {
                    if (typeof window !== 'undefined' && isNativeRef.current === null) {
                      import('@capacitor/core')
                        .then(({ Capacitor }) => {
                          isNativeRef.current = Capacitor.isNativePlatform()
                        })
                        .catch(() => {
                          isNativeRef.current = false
                        })
                    }
                    if (iframeLoadTimeoutRef.current) clearTimeout(iframeLoadTimeoutRef.current)
                    iframeLoadTimeoutRef.current = setTimeout(() => {
                      try {
                        const doc = iframeRef.current?.contentDocument
                        if (doc && doc.body) {
                          const len = (doc.body.innerText || doc.body.textContent || '').length
                          if (len < 80) setIframeLikelyBlocked(true)
                        }
                      } catch {
                        // Cross-origin: can't read; keep Open in Browser primary
                      }
                    }, 2500)
                  }}
                />
                {iframeLikelyBlocked && (
                  <div
                    className="absolute inset-x-2 bottom-2 rounded-lg bg-black/80 text-white text-sm px-3 py-2 flex items-center justify-between gap-2"
                    role="status"
                  >
                    <span>This contest can&apos;t be shown in-app.</span>
                    <button
                      type="button"
                      onClick={handleEnterContest}
                      className="shrink-0 px-3 py-1.5 rounded-lg bg-win text-slate-950 font-semibold text-xs"
                    >
                      Open in Browser
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleAutoFill}
                  className="absolute bottom-16 right-4 px-4 py-2 rounded-xl bg-win text-slate-950 font-semibold shadow-lg hover:opacity-90"
                >
                  ⚡ Auto-Fill Form
                </button>
              </div>
              <p className="text-xs text-white/50 px-2 py-1 shrink-0">
                If the preview stays blank, open in browser — we&apos;ll remind you to mark entered.
              </p>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/60">
              Could not load form.
            </div>
          )}

          <CheatSheetBar autoFillData={autoFillData} />
        </div>

        {contest && (
          <div className="p-4 border-t border-white/10 shrink-0 flex flex-col gap-2">
            {pendingMark && onMarkEntered && (
              <div className="rounded-xl bg-win/15 border border-win/40 p-3 space-y-2">
                <p className="text-sm text-white font-medium">Did you finish entering?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void confirmMark('entered')}
                    className="flex-1 py-2 rounded-lg bg-win text-gray-900 font-semibold text-sm"
                  >
                    Yes — Mark Entered
                  </button>
                  <button
                    type="button"
                    onClick={() => void confirmMark('submitted')}
                    className="flex-1 py-2 rounded-lg glass text-win font-medium text-sm"
                  >
                    Submitted form
                  </button>
                  <button
                    type="button"
                    onClick={() => setPendingMark(false)}
                    className="px-3 py-2 rounded-lg text-xs text-white/60"
                  >
                    Not yet
                  </button>
                </div>
              </div>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleEnterAndTrack}
                className="flex-1 py-2.5 rounded-lg bg-win text-gray-900 font-semibold hover:opacity-90"
              >
                Open & Enter
              </button>
              {onMarkEntered && (
                <button
                  type="button"
                  onClick={() => void confirmMark('entered')}
                  className="flex-1 py-2.5 rounded-lg glass text-win font-medium"
                >
                  Mark Entered
                </button>
              )}
            </div>
            {onMarkEntered && (
              <button
                type="button"
                onClick={() => void confirmMark('submitted')}
                className="text-xs text-white/60 hover:text-win self-start"
              >
                Mark as submitted instead
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                reportUrl(contest.url)
                setReportToast(true)
                setTimeout(() => setReportToast(false), 2500)
              }}
              className="text-xs text-white/50 hover:text-white/70 transition-colors self-start"
            >
              Report bad link
            </button>
            {(reportToast || statusMsg) && (
              <p className="text-xs text-win" role="status">
                {statusMsg || "Thanks, we'll look into it."}
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
