/**
 * Client helpers for moderated user-submitted contests.
 * Submit → pending queue → mod approve → public.contests (Hive Mind).
 */

import { supabase } from './supabase'
import { sanitizeContestUrl } from './utils/sanitizeContestUrl'
import { syncToVault, fetchFromCloud } from '../hooks/useContestVault'
import type { Contest } from './rssFetcher'

export type ContestEligibility = 'CA' | 'US' | 'NA' | 'Unknown'
export type SubmissionStatus = 'pending' | 'approved' | 'rejected'

export interface ContestSubmission {
  id: string
  submitter_id: string
  title: string
  url: string
  url_normalized: string
  eligibility: ContestEligibility
  expiry_date: string | null
  status: SubmissionStatus
  rejection_reason: string | null
  moderated_by: string | null
  moderated_at: string | null
  contest_id: string | null
  created_at: string
  updated_at: string
}

export interface ModerateResult {
  ok: boolean
  status: SubmissionStatus
  submission_id: string
  contest_id?: string
  contest?: {
    id: string
    title: string
    url: string
    source: string
    eligibility: string | null
    expiry_date: string | null
  }
}

const BLOCKED_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '[::1]'])

/** Client-side URL checks (server re-validates in submit_contest_suggestion). */
export function validateSubmissionUrl(raw: string): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = sanitizeContestUrl((raw ?? '').trim())
  if (!trimmed || trimmed.length < 12) {
    return { ok: false, error: 'Enter a full contest URL (https://…).' }
  }
  if (trimmed.length > 2048) {
    return { ok: false, error: 'URL is too long (max 2048 characters).' }
  }
  let parsed: URL
  try {
    parsed = new URL(trimmed)
  } catch {
    return { ok: false, error: 'That does not look like a valid URL.' }
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { ok: false, error: 'URL must use http:// or https://.' }
  }
  const host = parsed.hostname.toLowerCase()
  if (BLOCKED_HOSTS.has(host) || host.endsWith('.local')) {
    return { ok: false, error: 'Localhost / private URLs are not allowed.' }
  }
  if (!host.includes('.')) {
    return { ok: false, error: 'URL must include a valid hostname.' }
  }
  return { ok: true, url: trimmed }
}

export function validateSubmissionTitle(title: string): string | null {
  const t = title.trim()
  if (t.length < 3) return 'Title must be at least 3 characters.'
  if (t.length > 200) return 'Title must be 200 characters or fewer.'
  return null
}

export async function getSessionUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

export async function fetchMyModerationFlags(): Promise<{
  isAdmin: boolean
  isModerator: boolean
} | null> {
  const uid = await getSessionUserId()
  if (!uid) return null
  const { data, error } = await supabase
    .from('profiles')
    .select('is_admin, is_moderator')
    .eq('id', uid)
    .maybeSingle()
  if (error || !data) return { isAdmin: false, isModerator: false }
  return {
    isAdmin: Boolean((data as { is_admin?: boolean }).is_admin),
    isModerator: Boolean((data as { is_moderator?: boolean }).is_moderator),
  }
}

export async function isStaffModerator(): Promise<boolean> {
  const flags = await fetchMyModerationFlags()
  return Boolean(flags && (flags.isAdmin || flags.isModerator))
}

export async function submitContestSuggestion(input: {
  title: string
  url: string
  eligibility: ContestEligibility
  expiryDate?: string | null
}): Promise<{ id: string | null; error: string | null }> {
  const titleErr = validateSubmissionTitle(input.title)
  if (titleErr) return { id: null, error: titleErr }

  const urlCheck = validateSubmissionUrl(input.url)
  if (!urlCheck.ok) return { id: null, error: urlCheck.error }

  const uid = await getSessionUserId()
  if (!uid) return { id: null, error: 'Sign in to submit a contest.' }

  let expiry: string | null = null
  if (input.expiryDate && input.expiryDate.trim()) {
    const d = new Date(input.expiryDate)
    if (Number.isNaN(d.getTime())) return { id: null, error: 'Invalid expiry date.' }
    expiry = d.toISOString()
  }

  const { data, error } = await supabase.rpc('submit_contest_suggestion', {
    p_title: input.title.trim(),
    p_url: urlCheck.url,
    p_eligibility: input.eligibility,
    p_expiry_date: expiry,
  })

  if (error) return { id: null, error: error.message }
  return { id: data as string, error: null }
}

export async function listMySubmissions(): Promise<ContestSubmission[]> {
  const { data, error } = await supabase
    .from('contest_submissions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) {
    console.warn('[UGC] listMySubmissions:', error.message)
    return []
  }
  return (data ?? []) as ContestSubmission[]
}

export async function listPendingSubmissions(): Promise<ContestSubmission[]> {
  const { data, error } = await supabase
    .from('contest_submissions')
    .select('*')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(100)
  if (error) {
    console.warn('[UGC] listPendingSubmissions:', error.message)
    return []
  }
  return (data ?? []) as ContestSubmission[]
}

/** Approve or reject; on approve, merge Hive Mind row into local vault + refresh cloud. */
export async function moderateSubmission(
  submissionId: string,
  action: 'approve' | 'reject',
  rejectionReason?: string
): Promise<{ result: ModerateResult | null; error: string | null }> {
  const { data, error } = await supabase.rpc('moderate_contest_submission', {
    p_submission_id: submissionId,
    p_action: action,
    p_rejection_reason: rejectionReason ?? null,
  })

  if (error) return { result: null, error: error.message }

  const result = data as ModerateResult

  if (action === 'approve' && result?.contest) {
    const c = result.contest
    const contest: Contest = {
      id: c.id,
      title: c.title,
      url: c.url,
      source: c.source || 'user-submitted',
      expiryDate: c.expiry_date ?? undefined,
      is_estimated_expiry: !c.expiry_date,
      eligibility: (c.eligibility as Contest['eligibility']) ?? 'Unknown',
      tags: ['Community', 'User Submitted'],
      requirements: [],
      restrictions: [],
    }
    syncToVault([contest])
    void fetchFromCloud()
  }

  return { result, error: null }
}
