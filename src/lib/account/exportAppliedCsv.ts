/**
 * CSV export of Applied Contests — Pro-locked download helper.
 */

export interface AppliedContestCsvRow {
  contest_id: string
  title: string | null
  status: string
  entered_at: string
  submitted_at?: string | null
  prize_value?: number | null
  contest_url?: string | null
}

const HEADER = [
  'contest_id',
  'title',
  'status',
  'entered_at',
  'submitted_at',
  'prize_value',
  'contest_url',
] as const

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildAppliedContestsCsv(rows: AppliedContestCsvRow[]): string {
  const lines = [HEADER.join(',')]
  for (const row of rows) {
    lines.push(
      [
        csvEscape(row.contest_id ?? ''),
        csvEscape(row.title ?? ''),
        csvEscape(row.status ?? ''),
        csvEscape(row.entered_at ?? ''),
        csvEscape(row.submitted_at ?? ''),
        csvEscape(
          row.prize_value != null && !Number.isNaN(row.prize_value)
            ? String(row.prize_value)
            : ''
        ),
        csvEscape(row.contest_url ?? ''),
      ].join(',')
    )
  }
  return lines.join('\n') + '\n'
}

export function downloadAppliedContestsCsv(
  rows: AppliedContestCsvRow[],
  filenamePrefix = 'looniewins-applied-contests'
): void {
  const csv = buildAppliedContestsCsv(rows)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${filenamePrefix}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
