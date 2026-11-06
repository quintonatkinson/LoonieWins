import { useCallback, useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import PageShell from '../components/PageShell'
import InboxShieldPanel from '../components/InboxShieldPanel'
import InboxShieldConsentModal from '../components/InboxShieldConsentModal'
import { useAuth } from '../contexts/AuthContext'
import { loadAutoFillData } from '../lib/utils/autoFillStorage'
import {
  applyConsentChoice,
  loadInboxShieldPrefs,
  mergeProfileInboxShield,
  prefsToProfilePatch,
  saveInboxShieldPrefs,
} from '../lib/inboxShield/storage'
import type { InboxShieldPrefs } from '../lib/inboxShield/types'

export default function InboxShield() {
  const { profile, updateProfile } = useAuth()
  const [prefs, setPrefs] = useState<InboxShieldPrefs>(() =>
    mergeProfileInboxShield(profile)
  )
  const [consentOpen, setConsentOpen] = useState(false)

  useEffect(() => {
    setPrefs(mergeProfileInboxShield(profile))
  }, [profile])

  useEffect(() => {
    const onUpdate = () => setPrefs(loadInboxShieldPrefs())
    window.addEventListener('looniewins_inbox_shield_updated', onUpdate)
    return () => window.removeEventListener('looniewins_inbox_shield_updated', onUpdate)
  }, [])

  const persist = useCallback(
    async (next: InboxShieldPrefs) => {
      saveInboxShieldPrefs(next)
      setPrefs(next)
      await updateProfile(prefsToProfilePatch(next) as Parameters<typeof updateProfile>[0])
    },
    [updateProfile]
  )

  const suggestedEmail =
    prefs.entry_email_for_giveaways ||
    profile?.auto_fill_data?.email?.trim() ||
    profile?.email?.trim() ||
    loadAutoFillData().email?.trim() ||
    ''

  const handleConsent = async (choice: 'local' | 'skipped' | 'gmail_wishlist', email: string) => {
    const next = applyConsentChoice(choice, email || suggestedEmail)
    await persist(next)
    setConsentOpen(false)
  }

  return (
    <PageShell className="space-y-4" testId="inbox-shield-page">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-full bg-win/20 border border-win/40">
          <ShieldCheck className="w-5 h-5 text-win" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">Inbox Shield</h1>
          <p className="text-gray-400 text-sm">
            Wins &amp; confirmations separate from promo noise — Gmail sync coming soon.
          </p>
        </div>
      </div>

      <InboxShieldPanel prefs={prefs} onOpenConsent={() => setConsentOpen(true)} />

      <InboxShieldConsentModal
        open={consentOpen}
        suggestedEmail={suggestedEmail}
        onClose={() => setConsentOpen(false)}
        onChoose={(choice, email) => void handleConsent(choice, email)}
      />
    </PageShell>
  )
}
