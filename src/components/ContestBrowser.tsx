import { useEffect, useState, useRef, useCallback } from 'react'
import type { Contest } from '../lib/rssFetcher'
import { resolveContestUrl } from '../lib/rssFetcher'
import { reportUrl } from '../lib/utils/reportedUrls'
import { getInjectionScript } from '../lib/autofill/assassin'
import type { AutoFillData } from '../types/profile'

interface ContestBrowserProps {
  contest: Contest | null
  open: boolean
  onClose: () => void
  onMarkEntered?: (contest: Contest) => void
  autoFillData?: AutoFillData
}

const DEFAULT_AUTOFILL: AutoFillData = {
  name: '',
  email: '',
  address: '',
}

function CheatSheetBar({
  autoFillData,
  onCopied,
}: {
  autoFillData: AutoFillData
  onCopied?: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)

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

  return (
    <div className="flex gap-2 px-3 py-2 bg-surface border-t border-gray-600/50 shrink-0">
      <button
        type="button"
        onClick={() => copy('Name', autoFillData.name ?? '')}
        className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
          copied === 'Name'
            ? 'bg-win/30 text-win border-win/50'
            : 'bg-surface-light border-gray-600/50 text-gray-300 hover:text-gray-50'
        }`}
      >
        {copied === 'Name' ? 'Copied!' : '[Name]'}
      </button>
      <button
        type="button"
        onClick={() => copy('Email', autoFillData.email ?? '')}
        className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
          copied === 'Email'
            ? 'bg-win/30 text-win border-win/50'
            : 'bg-surface-light border-gray-600/50 text-gray-300 hover:text-gray-50'
        }`}
      >
        {copied === 'Email' ? 'Copied!' : '[Email]'}
      </button>
      <button
        type="button"
        onClick={() => copy('Addr', autoFillData.address ?? '')}
        className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
          copied === 'Addr'
            ? 'bg-win/30 text-win border-win/50'
            : 'bg-surface-light border-gray-600/50 text-gray-300 hover:text-gray-50'
        }`}
      >
        {copied === 'Addr' ? 'Copied!' : '[Addr]'}
      </button>
    </div>
  )
}

export default function ContestBrowser({
  contest,
  open,
  onClose,
  onMarkEntered,
  autoFillData = DEFAULT_AUTOFILL,
}: ContestBrowserProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [iframeLikelyBlocked, setIframeLikelyBlocked] = useState(false)
  const [reportToast, setReportToast] = useState(false)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const isNativeRef = useRef<boolean | null>(null)
  const iframeLoadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!open || !contest) return
    setLoading(true)
    setResolvedUrl(null)
    setIframeLikelyBlocked(false)
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
          } catch (_) {}
        })

        InAppBrowser.addListener('closeEvent', () => {
          InAppBrowser.removeAllListeners()
        })
        return true
      } catch (_) {
        return false
      }
    },
    [autoFillData, contest?.title]
  )

  const handleEnterContest = useCallback(() => {
    if (!resolvedUrl) return
    openNativeWebView(resolvedUrl).then((opened) => {
      if (!opened) {
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
      }
    })
  }, [resolvedUrl, openNativeWebView])

  const handleAutoFill = () => {
    try {
      const doc = iframeRef.current?.contentDocument
      if (!doc) return
      const script = document.createElement('script')
      script.textContent = getInjectionScript(autoFillData)
      doc.body?.appendChild(script)
      script.remove()
    } catch (_) {}
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
            <h2 className="font-semibold text-lg line-clamp-2">{contest?.title}</h2>
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
          <h3 className="text-sm font-medium text-white/90 mb-2">Auto-Fill</h3>
          <div className="text-sm text-white/70 space-y-1">
            <p>
              <span className="text-white/50">Name:</span> {autoFillData.name || '—'}
            </p>
            <p>
              <span className="text-white/50">Email:</span> {autoFillData.email || '—'}
            </p>
            <p>
              <span className="text-white/50">Address:</span>{' '}
              {autoFillData.address || '—'}
            </p>
          </div>
          <p className="text-xs text-yellow-400/90 mt-2">
            Tap chips below to copy. Math / skill-test fields need your input.
          </p>
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
                        // Cross-origin: we can't read content; don't assume blocked
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
                This area shows the contest. If it stays blank, the contest site may block embedding—tap Open in Browser to enter.
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
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleEnterContest}
                className="flex-1 py-2.5 rounded-lg bg-win text-gray-900 font-semibold hover:opacity-90"
              >
                Open in Browser
              </button>
              {onMarkEntered && (
              <button
                type="button"
                onClick={() => {
                  onMarkEntered(contest)
                  onClose()
                }}
                className="flex-1 py-2.5 rounded-lg glass text-win font-medium"
              >
                Mark as Entered
              </button>
            )}
            </div>
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
            {reportToast && (
              <p className="text-xs text-win" role="status">
                Thanks, we&apos;ll look into it.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  )
}
