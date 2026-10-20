import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import type { Contest } from '../lib/rssFetcher'
import { resolveContestUrl } from '../lib/rssFetcher'
import { reportUrl } from '../lib/utils/reportedUrls'
import { getInjectionScript, readFillResult } from '../lib/autofill/assassin'
import type { AutoFillData } from '../types/profile'
import { daysLeftUntilExpiry } from '../lib/utils/expiryDate'
import { shareContest } from '../lib/utils/shareContest'
import { copyText } from '../lib/utils/copyText'
import {
  deadLinkLabel,
  formatLinkCheckedAgo,
  isDeadLink,
  isDeadLinkStatus,
  probeContestUrl,
} from '../lib/utils/linkHealth'
import { markVaultLinkStatus } from '../hooks/useContestVault'
import CountdownTimer from './CountdownTimer'
import AgeGateModal from './AgeGateModal'
import {
  badgeToneClass,
  getRequirementBadges,
} from '../lib/utils/requirementBadges'
import {
  contestRequiresAgeGate,
  loadAgeConfirmed,
  saveAgeConfirmed,
} from '../lib/utils/ageGate'
import { formatEntriesToday } from '../hooks/useContestSocialProof'
import { resolveFeedDisplayPrefs } from '../lib/utils/userSettings'
import { useAuth } from '../contexts/AuthContext'

interface ContestBrowserProps {
  contest: Contest | null
  open: boolean
  onClose: () => void
  onMarkEntered?: (contest: Contest, status?: 'entered' | 'submitted') => void | Promise<unknown>
  autoFillData?: AutoFillData
  onAutoFillUsed?: () => void
  /** Free-tier paywall: block Smart-Fill when exhausted */
  smartFillBlocked?: boolean
  smartFillsRemaining?: number | null
  /** When true, returning from Open & Fill / Capgo close auto-marks entered. */
  autoMarkOnReturn?: boolean
  /** Anonymized entries today */
  entriesToday?: number | null
  onAgeConfirmed?: () => void
}

const DEFAULT_AUTOFILL: AutoFillData = {
  name: '',
  email: '',
  address: '',
}

const EXT_README =
  'https://github.com/quintonatkinson/LoonieWins/tree/main/extension#readme'

function decodeTitle(title: string): string {
  return title
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

function buildChecklist(autoFillData: AutoFillData): { label: string; value: string }[] {
  const first =
    autoFillData.firstName || autoFillData.name?.trim().split(/\s+/)[0] || ''
  const last =
    autoFillData.lastName ||
    autoFillData.name?.trim().split(/\s+/).slice(1).join(' ') ||
    ''
  const full =
    autoFillData.name || [first, last].filter(Boolean).join(' ') || ''
  return [
    { label: 'Name', value: full },
    { label: 'First', value: first },
    { label: 'Last', value: last },
    { label: 'Email', value: autoFillData.email ?? '' },
    { label: 'Phone', value: autoFillData.phone ?? '' },
    { label: 'Address', value: autoFillData.address ?? '' },
    { label: 'City', value: autoFillData.city ?? '' },
    { label: 'Province', value: autoFillData.province ?? '' },
    { label: 'Postal', value: autoFillData.postalCode ?? '' },
    { label: 'DOB', value: autoFillData.dateOfBirth ?? '' },
  ].filter((c) => c.value.trim().length > 0)
}

function StickyChecklist({
  items,
  active,
  onDone,
}: {
  items: { label: string; value: string }[]
  active: boolean
  onDone?: () => void
}) {
  const [idx, setIdx] = useState(0)
  const [flash, setFlash] = useState<string | null>(null)

  useEffect(() => {
    if (active) setIdx(0)
  }, [active])

  const copyNext = useCallback(async () => {
    if (!items.length) return
    const cur = items[Math.min(idx, items.length - 1)]
    const ok = await copyText(cur.value)
    if (!ok) return
    setFlash(cur.label)
    setTimeout(() => setFlash(null), 900)
    setIdx((i) => Math.min(i + 1, items.length))
  }, [items, idx])

  if (!active || items.length === 0) return null

  const done = idx >= items.length
  const current = done ? null : items[idx]

  return (
    <div
      className="fixed z-[60] right-3 bottom-24 sm:bottom-28 w-[min(320px,calc(100vw-1.5rem))] rounded-2xl border border-win/40 bg-surface/95 backdrop-blur-md shadow-2xl p-3 space-y-2"
      role="complementary"
      aria-label="Paste checklist"
      data-testid="enter-checklist"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-win">Paste checklist</p>
        <span className="text-[10px] text-white/50">
          {Math.min(idx + (done ? 0 : 1), items.length)}/{items.length}
        </span>
      </div>
      <ol className="max-h-40 overflow-y-auto space-y-1 text-xs">
        {items.map((item, i) => (
          <li
            key={item.label}
            className={`flex justify-between gap-2 rounded-lg px-2 py-1 ${
              i < idx
                ? 'text-white/35 line-through'
                : i === idx
                  ? 'bg-win/15 text-white'
                  : 'text-white/70'
            }`}
          >
            <span>{item.label}</span>
            <span className="truncate max-w-[55%] text-right opacity-80">{item.value}</span>
          </li>
        ))}
      </ol>
      {!done && current && (
        <button
          type="button"
          onClick={() => void copyNext()}
          className="w-full py-2.5 rounded-xl bg-win text-on-win font-semibold text-sm"
          data-testid="checklist-copy-next"
        >
          {flash === current.label ? 'Copied — paste in form' : `Copy next: ${current.label}`}
        </button>
      )}
      {done && (
        <p className="text-xs text-win text-center py-1">All fields copied — review & submit on the sponsor tab.</p>
      )}
      <button
        type="button"
        onClick={onDone}
        className="w-full text-[11px] text-white/50 hover:text-white/80 py-1"
      >
        Hide checklist
      </button>
    </div>
  )
}

function CheatSheetBar({
  autoFillData,
  onCopied,
}: {
  autoFillData: AutoFillData
  onCopied?: () => void
}) {
  const [copied, setCopied] = useState<string | null>(null)
  const chips = useMemo(() => buildChecklist(autoFillData), [autoFillData])

  const copy = useCallback(
    async (label: string, value: string) => {
      if (!value) return
      const ok = await copyText(value)
      if (!ok) return
      setCopied(label)
      onCopied?.()
      setTimeout(() => setCopied(null), 1500)
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

function detectExtensionInstalled(): boolean {
  try {
    if (typeof window === 'undefined') return false
    const w = window as Window & { __LOONIEWINS_EXT__?: boolean }
    if (w.__LOONIEWINS_EXT__) return true
    if (document.documentElement?.dataset?.loonieExt === '1') return true
  } catch {
    /* ignore */
  }
  return false
}

export default function ContestBrowser({
  contest,
  open,
  onClose,
  onMarkEntered,
  autoFillData = DEFAULT_AUTOFILL,
  onAutoFillUsed,
  smartFillBlocked = false,
  smartFillsRemaining = null,
  autoMarkOnReturn = false,
  entriesToday = null,
  onAgeConfirmed,
}: ContestBrowserProps) {
  const { profile } = useAuth()
  const preferSystemBrowser =
    resolveFeedDisplayPrefs({ settings: profile?.settings }).openContestsIn === 'browser'
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [reportToast, setReportToast] = useState(false)
  const [autoFillMsg, setAutoFillMsg] = useState<string | null>(null)
  const [pendingMark, setPendingMark] = useState(false)
  const [statusMsg, setStatusMsg] = useState<string | null>(null)
  const [awaitingReturn, setAwaitingReturn] = useState(false)
  const [showAgeGate, setShowAgeGate] = useState(false)
  const [pendingAgeAction, setPendingAgeAction] = useState<
    'enter' | 'mark-entered' | 'mark-submitted' | null
  >(null)
  const [linkHealthMsg, setLinkHealthMsg] = useState<string | null>(null)
  const [checklistOpen, setChecklistOpen] = useState(false)
  const [extInstalled, setExtInstalled] = useState(false)
  const [honestyLine, setHonestyLine] = useState<string | null>(null)
  const skipReturnOnceRef = useRef(false)

  const hasProfile =
    Boolean(autoFillData.email?.trim()) ||
    Boolean(autoFillData.name?.trim()) ||
    Boolean(autoFillData.firstName?.trim())

  const checklist = useMemo(() => buildChecklist(autoFillData), [autoFillData])

  useEffect(() => {
    if (!open) return
    const sync = () => setExtInstalled(detectExtensionInstalled())
    sync()
    window.addEventListener('loonie_ext_ready', sync)
    return () => window.removeEventListener('loonie_ext_ready', sync)
  }, [open])

  useEffect(() => {
    if (!open || !contest) return
    setLoading(true)
    setResolvedUrl(null)
    setPendingMark(false)
    setAwaitingReturn(false)
    setAutoFillMsg(null)
    setStatusMsg(null)
    setLinkHealthMsg(null)
    setChecklistOpen(false)
    setHonestyLine(null)
    if (isDeadLink(contest)) {
      const checked = formatLinkCheckedAgo(contest.linkCheckedAt)
      setLinkHealthMsg(
        `${deadLinkLabel(contest.linkStatus)}${checked ? ` · ${checked}` : ''} — try Open & Fill or Report bad link below.`
      )
    } else if (contest.linkCheckedAt) {
      const checked = formatLinkCheckedAgo(contest.linkCheckedAt)
      if (checked) {
        setLinkHealthMsg(`${checked}. If the page looks wrong, Report bad link below.`)
      }
    }
    resolveContestUrl(contest.url, contest.contentSnippet ?? contest.description).then((url) => {
      setResolvedUrl(url)
      setLoading(false)
    })
    let cancelled = false
    void probeContestUrl(contest.url).then((status) => {
      if (cancelled || status == null) return
      markVaultLinkStatus(contest.url, status)
      if (isDeadLinkStatus(status)) {
        setLinkHealthMsg(
          `${deadLinkLabel(status)} (rechecked just now) — Open & Fill may still fail. Report bad link if it stays broken.`
        )
      } else if (status >= 200 && status < 400) {
        setLinkHealthMsg('Link OK (rechecked just now). Still broken? Report bad link below.')
      }
    })
    return () => {
      cancelled = true
    }
  }, [open, contest])

  const confirmMark = useCallback(
    async (status: 'entered' | 'submitted' = 'entered') => {
      if (!contest || !onMarkEntered) return
      if (contestRequiresAgeGate(contest) && !loadAgeConfirmed()) {
        setPendingAgeAction(status === 'submitted' ? 'mark-submitted' : 'mark-entered')
        setShowAgeGate(true)
        return
      }
      await onMarkEntered(contest, status)
      setPendingMark(false)
      setAwaitingReturn(false)
      setChecklistOpen(false)
      setStatusMsg(status === 'submitted' ? 'Marked as submitted' : 'Marked as entered')
      setTimeout(() => onClose(), 350)
    },
    [contest, onMarkEntered, onClose]
  )

  // Auto-mark when user returns after Open & Fill
  useEffect(() => {
    if (!open || !autoMarkOnReturn || !awaitingReturn || !onMarkEntered || !contest) return
    const onReturn = () => {
      if (skipReturnOnceRef.current) {
        skipReturnOnceRef.current = false
        return
      }
      if (document.visibilityState && document.visibilityState !== 'visible') return
      setAwaitingReturn(false)
      void confirmMark('entered')
    }
    const onVis = () => {
      if (document.visibilityState === 'visible') onReturn()
    }
    window.addEventListener('focus', onReturn)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      window.removeEventListener('focus', onReturn)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [open, autoMarkOnReturn, awaitingReturn, onMarkEntered, contest, confirmMark])

  const openNativeWebView = useCallback(
    async (url: string) => {
      if (preferSystemBrowser) return false
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

        // Capgo executeScript returns void — do not burn Smart-Fill (cannot verify).
        InAppBrowser.addListener('browserPageLoaded', async () => {
          try {
            await InAppBrowser.executeScript({ code: script })
            setStatusMsg(
              'Native shell tried aggressive field inject — verify every field; math / captcha / sign-in stay yours.'
            )
            setHonestyLine('Needs your tap: captcha / sign-in / purchase (when present)')
          } catch {
            setStatusMsg(
              'Could not inject into the contest page. Use the paste checklist or browser extension, then mark entered.'
            )
          }
        })

        InAppBrowser.addListener('closeEvent', () => {
          InAppBrowser.removeAllListeners()
          if (autoMarkOnReturn && onMarkEntered) {
            void confirmMark('entered')
          } else if (onMarkEntered) {
            setPendingMark(true)
          }
        })
        return true
      } catch {
        return false
      }
    },
    [
      preferSystemBrowser,
      autoFillData,
      contest?.title,
      onMarkEntered,
      autoMarkOnReturn,
      confirmMark,
    ]
  )

  const handleEnterContest = useCallback(() => {
    if (!resolvedUrl) return
    if (contest && contestRequiresAgeGate(contest) && !loadAgeConfirmed()) {
      setPendingAgeAction('enter')
      setShowAgeGate(true)
      return
    }
    skipReturnOnceRef.current = true
    setChecklistOpen(true)
    setHonestyLine('Needs your tap: captcha / sign-in / purchase (when the sponsor asks)')
    openNativeWebView(resolvedUrl).then((opened) => {
      if (!opened) {
        window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
        if (extInstalled) {
          setAutoFillMsg(
            'Opened sponsor tab — press Alt+Shift+L (or extension Fill) for in-page Smart-Fill, then review & submit.'
          )
        } else {
          setAutoFillMsg(
            'Opened sponsor tab — use the sticky paste checklist (or install the extension for one-click fill).'
          )
        }
        if (autoMarkOnReturn && onMarkEntered) {
          setAwaitingReturn(true)
          setStatusMsg('Opened — marking entered when you return')
        } else if (onMarkEntered) {
          setPendingMark(true)
        }
      }
    })
  }, [
    resolvedUrl,
    openNativeWebView,
    onMarkEntered,
    autoMarkOnReturn,
    contest,
    extInstalled,
  ])

  const handleAgeConfirm = useCallback(() => {
    saveAgeConfirmed(true)
    onAgeConfirmed?.()
    setShowAgeGate(false)
    const action = pendingAgeAction
    setPendingAgeAction(null)
    if (action === 'enter') {
      if (!resolvedUrl) return
      skipReturnOnceRef.current = true
      setChecklistOpen(true)
      void openNativeWebView(resolvedUrl).then((opened) => {
        if (!opened) {
          window.open(resolvedUrl, '_blank', 'noopener,noreferrer')
          if (autoMarkOnReturn && onMarkEntered) {
            setAwaitingReturn(true)
            setStatusMsg('Opened — marking entered when you return')
          } else if (onMarkEntered) {
            setPendingMark(true)
          }
        }
      })
      return
    }
    if (action === 'mark-entered' || action === 'mark-submitted') {
      void (async () => {
        if (!contest || !onMarkEntered) return
        await onMarkEntered(contest, action === 'mark-submitted' ? 'submitted' : 'entered')
        setPendingMark(false)
        setAwaitingReturn(false)
        setStatusMsg(action === 'mark-submitted' ? 'Marked as submitted' : 'Marked as entered')
        setTimeout(() => onClose(), 350)
      })()
    }
  }, [
    pendingAgeAction,
    resolvedUrl,
    openNativeWebView,
    autoMarkOnReturn,
    onMarkEntered,
    contest,
    onClose,
    onAgeConfirmed,
  ])

  const handleShare = useCallback(async () => {
    if (!contest) return
    const result = await shareContest(contest)
    if (result === 'shared') setStatusMsg('Shared')
    else if (result === 'copied') setStatusMsg('Link copied')
    else setStatusMsg('Could not share')
  }, [contest])

  /** Rare same-origin embed only — never burn unless fill likely succeeded. */
  const trySameOriginInject = useCallback(() => {
    if (smartFillBlocked) {
      setAutoFillMsg('Smart-Fills exhausted on Free — upgrade to Pro for unlimited.')
      onAutoFillUsed?.()
      return
    }
    if (!hasProfile) {
      setAutoFillMsg('Add autofill details in Profile first.')
      return
    }
    // Intentionally not using iframe as the primary path; this is a hidden diagnostic hook.
    try {
      const iframe = document.querySelector(
        'iframe[data-loonie-embed]'
      ) as HTMLIFrameElement | null
      const doc = iframe?.contentDocument
      const win = iframe?.contentWindow
      if (!doc?.body) {
        setAutoFillMsg(
          'In-app iframes can’t fill most sponsors. Use Open & Fill + checklist, or the browser extension.'
        )
        return
      }
      const script = document.createElement('script')
      script.textContent = getInjectionScript(autoFillData)
      doc.body.appendChild(script)
      script.remove()
      const result = readFillResult(win)
      if (result?.status === 'filled' && (result.filled ?? 0) > 0) {
        onAutoFillUsed?.()
        setAutoFillMsg(
          smartFillsRemaining != null
            ? `Filled ~${result.filled} field(s) (${Math.max(0, smartFillsRemaining - 1)} left). Review & submit.`
            : `Filled ~${result.filled} field(s). Review & submit.`
        )
        if (result.walls?.length) {
          setHonestyLine(`Needs your tap: ${result.walls.join(' / ')}`)
        }
      } else {
        setAutoFillMsg(
          'No reliable fill on this embed — Open & Fill (real tab) or install the extension instead. Smart-Fill not charged.'
        )
      }
    } catch {
      setAutoFillMsg(
        'Cross-origin embed — use Open & Fill + checklist or the LoonieWins extension. Smart-Fill not charged.'
      )
    }
  }, [
    smartFillBlocked,
    hasProfile,
    autoFillData,
    onAutoFillUsed,
    smartFillsRemaining,
  ])

  const daysLeft = daysLeftUntilExpiry(contest?.expiryDate)
  const reqBadges = contest ? getRequirementBadges(contest) : []
  const socialLabel = formatEntriesToday(entriesToday)

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
          <div className="min-w-0 pr-2">
            <h2 className="font-semibold text-lg line-clamp-2">
              {decodeTitle(contest?.title ?? '')}
            </h2>
            <div className="flex flex-wrap gap-2 mt-2 items-center text-sm text-white/80">
              {contest?.prizeValue != null && <span>${contest.prizeValue.toLocaleString()}</span>}
              {contest?.expiryDate ? (
                <CountdownTimer targetDate={contest.expiryDate} variant="detail" />
              ) : daysLeft != null ? (
                <span>{daysLeft > 0 ? `${daysLeft} days left` : 'Ended'}</span>
              ) : null}
              {socialLabel && (
                <span className="text-white/50 text-xs" title="Anonymized Hive Mind count">
                  {socialLabel}
                </span>
              )}
            </div>
            {reqBadges.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {reqBadges.map((b) => (
                  <span
                    key={b.kind}
                    className={`rounded-full px-2 py-0.5 text-xs font-medium border ${badgeToneClass(b)}`}
                  >
                    {b.icon} {b.label}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-white/80 shrink-0"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="px-4 py-3 border-b border-white/10 shrink-0 space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-white/90">Enter path</h3>
            <Link to="/profile" className="text-xs text-win hover:underline">
              Edit profile
            </Link>
          </div>
          {linkHealthMsg && (
            <p
              className="text-xs text-amber-300 rounded-lg bg-amber-500/10 border border-amber-500/30 px-2 py-1.5"
              role="status"
              data-testid="link-health-banner"
            >
              {linkHealthMsg}
            </p>
          )}
          {!hasProfile ? (
            <p className="text-sm text-amber-300">
              Set name & email in Profile so Open & Fill can paste / inject for you.
            </p>
          ) : (
            <div className="text-sm text-white/70 space-y-0.5">
              <p>
                <span className="text-white/50">Name:</span>{' '}
                {autoFillData.name ||
                  [autoFillData.firstName, autoFillData.lastName].filter(Boolean).join(' ') ||
                  '—'}
              </p>
              <p>
                <span className="text-white/50">Email:</span> {autoFillData.email || '—'}
              </p>
            </div>
          )}
          <p className="text-xs text-white/55">
            We don’t pretend sponsor iframes work. Primary path: open the real form, inject or paste
            your profile, you confirm (checkbox / captcha / send). We never auto-submit third-party
            sites.
          </p>
          {honestyLine && (
            <p className="text-xs text-amber-200/90" role="status" data-testid="wall-honesty">
              {honestyLine}
            </p>
          )}
          {autoFillMsg && (
            <p className="text-xs text-win" role="status">
              {autoFillMsg}
            </p>
          )}
        </div>

        <div className="flex-1 min-h-0 relative flex flex-col overflow-y-auto">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-white/60">
              Resolving contest link…
            </div>
          ) : resolvedUrl ? (
            <div className="p-4 space-y-3">
              <button
                type="button"
                onClick={handleEnterContest}
                disabled={!resolvedUrl}
                className="w-full py-3.5 rounded-xl bg-win text-on-win font-semibold text-base hover:opacity-90"
                data-testid="open-and-fill"
              >
                Open & Fill
              </button>
              <p className="text-[11px] text-white/45 text-center -mt-1">
                Opens the sponsor form · sticky paste checklist · Capgo inject on native
              </p>

              {extInstalled ? (
                <div className="rounded-xl border border-win/30 bg-win/10 px-3 py-2.5 text-sm text-white/85">
                  Extension detected — after Open & Fill, press{' '}
                  <kbd className="text-win font-semibold">Alt+Shift+L</kbd> on the contest tab for
                  in-page Smart-Fill, then review & submit.
                </div>
              ) : (
                <a
                  href={EXT_README}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block w-full text-center py-2.5 rounded-xl border border-white/20 text-sm text-white/80 hover:border-win/40 hover:text-win"
                  data-testid="install-extension"
                >
                  Install browser extension (Chrome/Edge Load unpacked)
                </a>
              )}

              <button
                type="button"
                onClick={() => setChecklistOpen(true)}
                className="w-full py-2 rounded-lg glass text-win text-sm font-medium"
              >
                Show paste checklist
              </button>

              {/* Diagnostic only — not the product path */}
              <details className="text-[11px] text-white/35">
                <summary className="cursor-pointer hover:text-white/50">
                  Advanced: same-origin inject (almost never works)
                </summary>
                <button
                  type="button"
                  onClick={trySameOriginInject}
                  className="mt-2 text-win/80 underline"
                >
                  Try inject if a rare embed is reachable
                </button>
              </details>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-white/60">
              Could not resolve contest URL.
            </div>
          )}

          <CheatSheetBar autoFillData={autoFillData} />
        </div>

        {contest && (
          <div className="p-4 border-t border-white/10 shrink-0 flex flex-col gap-2">
            {pendingMark && onMarkEntered && (
              <div className="rounded-xl bg-win/15 border border-win/40 p-3 space-y-2">
                <p className="text-sm text-white font-medium">Finished on the sponsor site?</p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void confirmMark('entered')}
                    className="flex-1 py-2.5 rounded-lg bg-win text-on-win font-semibold text-sm"
                    data-testid="im-done-mark-entered"
                  >
                    I&apos;m done — mark entered
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
            {!pendingMark && onMarkEntered && (
              <button
                type="button"
                onClick={() => void confirmMark('entered')}
                className="w-full py-3 rounded-xl bg-win text-on-win font-semibold hover:opacity-90"
                data-testid="im-done-mark-entered"
              >
                I&apos;m done — mark entered
              </button>
            )}
            <div className="flex gap-3 items-center justify-between">
              <button
                type="button"
                onClick={() => void handleShare()}
                className="text-xs text-white/60 hover:text-win"
              >
                Share contest
              </button>
              {onMarkEntered && (
                <button
                  type="button"
                  onClick={() => void confirmMark('submitted')}
                  className="text-xs text-white/60 hover:text-win"
                >
                  Mark as submitted instead
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => {
                reportUrl(contest.url, 410)
                markVaultLinkStatus(contest.url, 410)
                setLinkHealthMsg(
                  'Reported — dropped from this device’s live feed. Thanks for keeping Hive Mind honest.'
                )
                setReportToast(true)
                setTimeout(() => setReportToast(false), 2500)
              }}
              className="text-xs text-amber-300/80 hover:text-amber-200 transition-colors self-start underline-offset-2 hover:underline"
              data-testid="report-bad-link"
              aria-label="Report bad or expired contest link"
            >
              Report bad link
            </button>
            {(reportToast || statusMsg) && (
              <p className="text-xs text-win" role="status">
                {statusMsg || 'Thanks — saved locally and removed from your live feed.'}
              </p>
            )}
          </div>
        )}
      </div>

      <StickyChecklist
        items={checklist}
        active={checklistOpen}
        onDone={() => setChecklistOpen(false)}
      />

      <AgeGateModal
        open={showAgeGate}
        contestTitle={contest?.title}
        onCancel={() => {
          setShowAgeGate(false)
          setPendingAgeAction(null)
        }}
        onConfirm={handleAgeConfirm}
      />
    </>
  )
}
