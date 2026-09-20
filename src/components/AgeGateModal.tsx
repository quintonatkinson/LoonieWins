/**
 * One-time 18+ confirmation before entering age-restricted contests.
 * Does not collect date of birth — confirm only.
 */

interface AgeGateModalProps {
  open: boolean
  contestTitle?: string
  onConfirm: () => void
  onCancel: () => void
}

export default function AgeGateModal({
  open,
  contestTitle,
  onConfirm,
  onCancel,
}: AgeGateModalProps) {
  if (!open) return null

  return (
    <>
      <div className="fixed inset-0 bg-black/70 z-[60]" onClick={onCancel} aria-hidden />
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[70] w-full max-w-sm rounded-2xl bg-gray-900 border border-gray-600/50 p-6 shadow-xl"
        role="dialog"
        aria-modal
        aria-labelledby="age-gate-title"
      >
        <p id="age-gate-title" className="text-gray-50 font-semibold text-lg">
          18+ required
        </p>
        <p className="text-gray-400 text-sm mt-2">
          {contestTitle
            ? `“${contestTitle.slice(0, 72)}${contestTitle.length > 72 ? '…' : ''}” is marked 18+.`
            : 'This contest is marked 18+.'}{' '}
          Confirm you are of legal age to enter before continuing.
        </p>
        <button
          type="button"
          onClick={onConfirm}
          className="mt-5 w-full py-2.5 rounded-lg bg-win text-gray-900 font-semibold"
        >
          I am 18 or older
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="mt-2 w-full py-2 text-gray-400 text-sm"
        >
          Cancel
        </button>
      </div>
    </>
  )
}
