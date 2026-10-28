import { useCallback, useEffect, useState } from 'react'
import { Share, Smartphone, X } from 'lucide-react'

const DISMISS_KEY = 'looniewins_pwa_hint_dismissed'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return true
  const mq = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone =
    'standalone' in window.navigator &&
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  return mq || iosStandalone
}

function isMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false
  const coarse = window.matchMedia('(max-width: 768px)').matches
  const ua = navigator.userAgent || ''
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
  return coarse || mobileUa
}

function isIosSafari(): boolean {
  const ua = navigator.userAgent || ''
  const isAppleMobile = /iPhone|iPad|iPod/i.test(ua)
  const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome/i.test(ua)
  return isAppleMobile && isSafari
}

function isAndroidChrome(): boolean {
  const ua = navigator.userAgent || ''
  return /Android/i.test(ua) && /Chrome/i.test(ua)
}

export default function PwaInstallHint() {
  const [visible, setVisible] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)
  const [installing, setInstalling] = useState(false)

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === '1') return
    } catch {
      /* private mode */
    }
    if (isStandaloneDisplay()) return
    if (!isMobileBrowser()) return
    setVisible(true)
  }, [])

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstall)
  }, [])

  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* ignore */
    }
    setVisible(false)
  }, [])

  const onInstallClick = useCallback(async () => {
    if (!installEvent) return
    setInstalling(true)
    try {
      await installEvent.prompt()
      await installEvent.userChoice
      dismiss()
    } catch {
      /* user dismissed or browser blocked */
    } finally {
      setInstalling(false)
      setInstallEvent(null)
    }
  }, [installEvent, dismiss])

  if (!visible) return null

  const showAndroidInstall = Boolean(installEvent) && isAndroidChrome()
  const showIosSteps = isIosSafari() || (!showAndroidInstall && /iPhone|iPad|iPod/i.test(navigator.userAgent))

  return (
    <div
      className="mx-auto w-full max-w-3xl px-4 pt-2"
      data-testid="pwa-install-hint"
      role="region"
      aria-label="Add LoonieWins to your home screen"
    >
      <div className="relative rounded-xl border border-win/30 bg-gray-800/90 px-4 py-3 pr-10 shadow-lg">
        <button
          type="button"
          onClick={dismiss}
          className="absolute top-2 right-2 p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/80"
          aria-label="Dismiss home screen tip"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex gap-3 items-start">
          <span className="flex items-center justify-center w-9 h-9 rounded-full bg-win/15 border border-win/35 text-win shrink-0 mt-0.5">
            <Smartphone className="w-4 h-4" aria-hidden />
          </span>
          <div className="min-w-0 space-y-2 text-sm text-gray-200 leading-snug">
            <p className="font-semibold text-white">Enter on the go</p>
            <p className="text-gray-300">
              Open LoonieWins on your phone and save it to your home screen for a quick shortcut —
              no app store needed.
            </p>
            {showIosSteps && (
              <p className="text-gray-400 text-xs flex items-start gap-1.5">
                <Share className="w-3.5 h-3.5 shrink-0 mt-0.5 text-win" aria-hidden />
                <span>
                  On iPhone: tap <span className="text-gray-200">Share</span>, then{' '}
                  <span className="text-gray-200">Add to Home Screen</span>.
                </span>
              </p>
            )}
            {showAndroidInstall && (
              <button
                type="button"
                onClick={() => void onInstallClick()}
                disabled={installing}
                className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-win text-on-win text-xs font-semibold disabled:opacity-60"
              >
                {installing ? 'Opening…' : 'Add to Home Screen'}
              </button>
            )}
            {!showAndroidInstall && !showIosSteps && (
              <p className="text-gray-400 text-xs">
                In your browser menu, choose <span className="text-gray-200">Add to Home screen</span>{' '}
                or <span className="text-gray-200">Install app</span>.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
