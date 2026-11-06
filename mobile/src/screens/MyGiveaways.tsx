import { useMemo, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Share,
  Alert,
} from 'react-native'
import type { ContestEntry, ContestEntryStatus } from '../hooks/useContestEntries'
import { useAuth } from '../contexts/AuthContext'
import { useUserEarn } from '../contexts/UserEarnContext'
import { useTheme } from '../contexts/ThemeContext'
import { hasFeature } from '../lib/monetization/tiers'
import { daysLeftUntilExpiry, isExpired } from '../lib/utils/expiryDate'
import { isCurrentContestEntry } from '../lib/utils/contestEntryScope'
import { buildAppliedContestsCsv } from '../lib/account/exportAppliedCsv'

type ScopeTab = 'current' | 'all'
type StatusFilter = 'all' | ContestEntryStatus

function formatPrize(v: number | null | undefined): string | undefined {
  if (v == null || Number.isNaN(v)) return undefined
  if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}K`
  return `$${Math.round(v)}`
}

function statusLabel(s: ContestEntryStatus): string {
  switch (s) {
    case 'submitted':
      return 'Submitted'
    case 'won':
      return 'Won'
    case 'lost':
      return 'Lost'
    case 'expired':
      return 'Expired'
    default:
      return 'Entered'
  }
}

interface MyGiveawaysProps {
  entries: ContestEntry[]
  updateStatus: (
    contestId: string,
    status: ContestEntryStatus
  ) => Promise<{ ok: boolean; error?: string }>
  removeEntry: (contestId: string) => Promise<{ ok: boolean; error?: string }>
  onGoHome?: () => void
}

export default function MyGiveaways({
  entries,
  updateStatus,
  removeEntry,
  onGoHome,
}: MyGiveawaysProps) {
  const { profile } = useAuth()
  const { subscriptionTier } = useUserEarn()
  const { accentColor } = useTheme()
  const [scope, setScope] = useState<ScopeTab>('current')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [search, setSearch] = useState('')

  const activeCount = useMemo(
    () => entries.filter(isCurrentContestEntry).length,
    [entries]
  )
  const allTimeCount = entries.length

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return entries
      .filter((e) => (scope === 'current' ? isCurrentContestEntry(e) : true))
      .filter((e) => (statusFilter === 'all' ? true : e.status === statusFilter))
      .filter((e) => (!q ? true : (e.title || e.contest_id).toLowerCase().includes(q)))
      .map((e) => {
        const expiresAt = e.expires_at
        const expiredByDate = isExpired(expiresAt)
        const daysLeft = daysLeftUntilExpiry(expiresAt)
        let endsLabel: string | null = null
        if (expiresAt) {
          const day = expiresAt.slice(0, 10)
          if (expiredByDate || e.status === 'expired') endsLabel = `Ended ${day}`
          else if (daysLeft === 0) endsLabel = `Ends today (${day})`
          else if (daysLeft === 1) endsLabel = `Ends tomorrow (${day})`
          else if (daysLeft != null) endsLabel = `Ends ${day} · ${daysLeft}d left`
          else endsLabel = `Ends ${day}`
        }
        return {
          id: e.contest_id,
          title: e.title || e.contest_id,
          enteredAt: e.entered_at.slice(0, 10),
          prizeValue: formatPrize(e.prize_value),
          ended: e.status === 'expired' || e.status === 'lost' || expiredByDate,
          endsLabel,
          status: e.status,
          url: e.contest_url,
        }
      })
  }, [entries, scope, statusFilter, search])

  const canExportCsv = hasFeature(profile?.feature_flags, 'export_csv', {
    tier: subscriptionTier,
    isPremium: profile?.is_premium,
  })

  const handleExportCsv = async () => {
    if (!canExportCsv) {
      Alert.alert('Pro feature', 'CSV export of My Giveaways unlocks with Pro.')
      return
    }
    if (entries.length === 0) return
    const csv = buildAppliedContestsCsv(
      entries.map((e) => ({
        contest_id: e.contest_id,
        title: e.title,
        status: e.status,
        entered_at: e.entered_at,
        submitted_at: e.submitted_at,
        prize_value: e.prize_value,
        contest_url: e.contest_url,
        expires_at: e.expires_at,
      }))
    )
    try {
      await Share.share({
        message: csv,
        title: 'LoonieWins My Giveaways CSV',
      })
    } catch {
      /* user dismissed */
    }
  }

  const emptyCopy =
    scope === 'current'
      ? {
          title: 'No active giveaways yet',
          body: 'Enter from Home to see them here. Open a contest, then Mark Entered — it lands on Current until it ends.',
        }
      : {
          title: 'No giveaways tracked yet',
          body: 'Enter from Home to build your history. Everything you mark entered stays in All-time.',
        }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#111827' }}
      contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }}
      testID="my-giveaways"
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={{ color: '#fff', fontSize: 20, fontWeight: '700' }}>My Giveaways</Text>
          <Text style={{ color: '#9ca3af', fontSize: 13, marginTop: 4 }} testID="my-giveaways-counts">
            {activeCount} active · {allTimeCount} all-time
          </Text>
        </View>
        <TouchableOpacity
          onPress={() => void handleExportCsv()}
          disabled={entries.length === 0 && canExportCsv}
          style={{
            paddingHorizontal: 10,
            paddingVertical: 8,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: canExportCsv ? accentColor + '66' : '#f59e0b66',
            opacity: entries.length === 0 && canExportCsv ? 0.4 : 1,
          }}
        >
          <Text
            style={{
              color: canExportCsv ? accentColor : '#fbbf24',
              fontSize: 12,
              fontWeight: '700',
            }}
          >
            {canExportCsv ? 'Export CSV' : 'CSV · Pro'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Current / All-time */}
      <View
        style={{
          flexDirection: 'row',
          borderRadius: 12,
          backgroundColor: '#1f2937',
          borderWidth: 1,
          borderColor: '#4b556380',
          padding: 4,
          gap: 4,
        }}
        accessibilityRole="tablist"
      >
        {(
          [
            ['current', 'Current', activeCount],
            ['all', 'All-time', allTimeCount],
          ] as const
        ).map(([key, label, count]) => {
          const on = scope === key
          return (
            <TouchableOpacity
              key={key}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              onPress={() => setScope(key)}
              testID={`my-giveaways-tab-${key}`}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 10,
                backgroundColor: on ? accentColor : 'transparent',
                alignItems: 'center',
              }}
            >
              <Text
                style={{
                  color: on ? '#111827' : '#9ca3af',
                  fontWeight: '700',
                  fontSize: 14,
                }}
              >
                {label}{' '}
                <Text style={{ fontSize: 12, opacity: on ? 0.8 : 1 }}>{count}</Text>
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {(
          [
            ['all', 'All'],
            ['entered', 'Entered'],
            ['submitted', 'Submitted'],
            ['won', 'Won'],
            ['lost', 'Lost'],
            ['expired', 'Expired'],
          ] as const
        ).map(([key, label]) => {
          const on = statusFilter === key
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setStatusFilter(key)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: on ? accentColor : '#4b556380',
                backgroundColor: on ? accentColor : 'transparent',
              }}
            >
              <Text
                style={{
                  color: on ? '#111827' : '#9ca3af',
                  fontSize: 12,
                  fontWeight: '600',
                }}
              >
                {label}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Search your giveaways…"
        placeholderTextColor="#6b7280"
        accessibilityLabel="Search giveaways"
        style={{
          backgroundColor: '#111827',
          borderWidth: 1,
          borderColor: '#4b556380',
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 10,
          color: '#fff',
          fontSize: 14,
        }}
      />

      {visible.length === 0 ? (
        <View
          style={{
            borderRadius: 12,
            borderWidth: 1,
            borderStyle: 'dashed',
            borderColor: '#4b556399',
            backgroundColor: '#1f293766',
            padding: 24,
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '600' }}>{emptyCopy.title}</Text>
          <Text style={{ color: '#9ca3af', fontSize: 13, textAlign: 'center' }}>
            {emptyCopy.body}
          </Text>
          {onGoHome ? (
            <TouchableOpacity
              onPress={onGoHome}
              style={{
                marginTop: 4,
                backgroundColor: accentColor,
                borderRadius: 10,
                paddingHorizontal: 16,
                paddingVertical: 12,
              }}
            >
              <Text style={{ color: '#111827', fontWeight: '700', fontSize: 14 }}>
                Enter from Home
              </Text>
            </TouchableOpacity>
          ) : null}
          {scope === 'current' && allTimeCount > 0 ? (
            <TouchableOpacity onPress={() => setScope('all')}>
              <Text style={{ color: accentColor, fontSize: 12 }}>
                View All-time history ({allTimeCount})
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : (
        visible.map((c) => (
          <View
            key={c.id}
            testID="my-giveaway-card"
            style={{
              borderRadius: 12,
              borderWidth: 2,
              borderColor: accentColor + '66',
              backgroundColor: '#1f293799',
              padding: 14,
              gap: 10,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }} numberOfLines={2}>
                  {c.title}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 }}>
                  {c.prizeValue ? (
                    <Text style={{ color: accentColor, fontSize: 12, fontWeight: '700' }}>
                      {c.prizeValue}
                    </Text>
                  ) : null}
                  <Text style={{ color: '#9ca3af', fontSize: 12 }}>Entered {c.enteredAt}</Text>
                  {c.endsLabel ? (
                    <Text
                      style={{ color: c.ended ? '#f87171' : '#fcd34d', fontSize: 12 }}
                      testID="my-giveaway-ends"
                    >
                      {c.endsLabel}
                    </Text>
                  ) : c.ended ? (
                    <Text style={{ color: '#f87171', fontSize: 12 }}>Ended</Text>
                  ) : (
                    <Text style={{ color: '#6b7280', fontSize: 12 }}>End date unknown</Text>
                  )}
                  <Text
                    style={{
                      color: accentColor,
                      fontSize: 11,
                      fontWeight: '600',
                      backgroundColor: accentColor + '33',
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 6,
                      overflow: 'hidden',
                    }}
                  >
                    {statusLabel(c.status)}
                  </Text>
                </View>
              </View>
              {c.url ? (
                <TouchableOpacity
                  onPress={() => void Linking.openURL(c.url!)}
                  accessibilityLabel="Open contest"
                  style={{ padding: 8 }}
                >
                  <Text style={{ color: accentColor, fontWeight: '700', fontSize: 12 }}>Open</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {c.status === 'entered' ? (
                <ActionChip
                  label="Mark submitted"
                  color={accentColor}
                  onPress={() => void updateStatus(c.id, 'submitted')}
                />
              ) : null}
              {c.status !== 'won' ? (
                <ActionChip
                  label="Won"
                  color="#d1d5db"
                  onPress={() => void updateStatus(c.id, 'won')}
                />
              ) : null}
              {c.status !== 'lost' ? (
                <ActionChip
                  label="Lost"
                  color="#d1d5db"
                  onPress={() => void updateStatus(c.id, 'lost')}
                />
              ) : null}
              <ActionChip
                label="Remove"
                color="#f87171"
                onPress={() => void removeEntry(c.id)}
              />
            </View>
          </View>
        ))
      )}

      <Text style={{ color: '#6b7280', fontSize: 12, marginTop: 8 }}>
        This list is only what you entered — not the platform Past vault.
      </Text>
    </ScrollView>
  )
}

function ActionChip({
  label,
  color,
  onPress,
}: {
  label: string
  color: string
  onPress: () => void
}) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={{
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: color + '66',
      }}
    >
      <Text style={{ color, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  )
}
