'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  appId: string
  currentStatus: 'hired' | 'terminated'
  applicantName: string
  hiredAt: string
  terminatedAt: string | null
}

function retentionBadge(
  label: string,
  hiredAt: Date,
  terminatedAt: Date | null,
  days: number
): { text: string; style: React.CSSProperties } {
  const milestone = new Date(hiredAt)
  milestone.setDate(milestone.getDate() + days)
  const now = new Date()

  if (now < milestone) {
    const daysLeft = Math.ceil((milestone.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return {
      text: `in ${daysLeft}d`,
      style: { backgroundColor: '#F3F4F6', color: '#9CA3AF' },
    }
  }
  if (terminatedAt === null || terminatedAt > milestone) {
    return {
      text: '✓ Retained',
      style: { backgroundColor: '#F0FDF4', color: '#15803D' },
    }
  }
  return {
    text: '✗ Left',
    style: { backgroundColor: '#FEF2F2', color: '#DC2626' },
  }
}

export default function EmploymentToggle({ appId, currentStatus, applicantName, hiredAt, terminatedAt }: Props) {
  const router = useRouter()
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [localStatus, setLocalStatus] = useState(currentStatus)
  const [localTerminatedAt, setLocalTerminatedAt] = useState(terminatedAt)

  const isHired = localStatus === 'hired'
  const hiredDate = new Date(hiredAt)
  const terminatedDate = localTerminatedAt ? new Date(localTerminatedAt) : null

  async function handleToggle() {
    if (loading) return
    setLoading(true)
    setError(null)
    const res = await fetch(`/api/admin/applications/${appId}/terminate`, { method: 'POST' })
    const body = await res.json().catch(() => ({}))
    setLoading(false)
    if (!res.ok) {
      setError(body.error ?? 'Something went wrong')
      return
    }
    setLocalStatus(body.newStatus)
    setLocalTerminatedAt(body.newStatus === 'terminated' ? new Date().toISOString() : null)
    setShowConfirm(false)
    router.refresh()
  }

  const milestones = [30, 60, 90]

  return (
    <div>
      {/* Employment status + toggle */}
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-xs font-semibold px-2.5 py-1 rounded-full"
          style={isHired
            ? { backgroundColor: '#F0FDF4', color: '#15803D' }
            : { backgroundColor: '#FEF2F2', color: '#DC2626' }
          }
        >
          {isHired ? 'Currently Employed' : 'No Longer Employed'}
        </span>
        <button
          onClick={() => setShowConfirm(true)}
          className="text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors"
          style={isHired
            ? { borderColor: '#FECACA', color: '#DC2626', backgroundColor: '#FEF2F2' }
            : { borderColor: '#BBF7D0', color: '#15803D', backgroundColor: '#F0FDF4' }
          }
        >
          {isHired ? 'Mark No Longer Employed' : 'Reinstate'}
        </button>
      </div>

      {/* 30 / 60 / 90 day milestones */}
      <div className="grid grid-cols-3 gap-2">
        {milestones.map(days => {
          const badge = retentionBadge(`Day ${days}`, hiredDate, terminatedDate, days)
          return (
            <div
              key={days}
              className="rounded-lg border p-3 text-center"
              style={{ borderColor: '#E5E7EB' }}
            >
              <p className="text-[11px] font-semibold text-gray-400 mb-1">Day {days}</p>
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={badge.style}
              >
                {badge.text}
              </span>
            </div>
          )
        })}
      </div>

      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}

      {/* Confirmation modal */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}
          onClick={() => !loading && setShowConfirm(false)}
        >
          <div
            className="rounded-2xl shadow-xl px-8 py-7 w-full max-w-sm mx-4"
            style={{ backgroundColor: 'var(--ui-card-bg)', border: '1px solid var(--ui-border)' }}
            onClick={e => e.stopPropagation()}
          >
            <p className="text-[15px] font-semibold mb-2" style={{ color: 'var(--ui-text-primary)' }}>
              {isHired ? `Mark ${applicantName} as no longer employed?` : `Reinstate ${applicantName}?`}
            </p>
            <p className="text-[13px] mb-6" style={{ color: 'var(--ui-text-secondary)' }}>
              {isHired
                ? 'This will update their status to No Longer Employed. You can reverse this at any time.'
                : 'This will restore their status to Hired.'}
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={loading}
                className="rounded-xl px-4 py-2 text-[13px] font-medium border transition-colors disabled:opacity-50"
                style={{ borderColor: 'var(--ui-border)', color: 'var(--ui-text-secondary)', backgroundColor: 'var(--ui-card-bg)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleToggle}
                disabled={loading}
                className="rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-colors disabled:opacity-40"
                style={{ backgroundColor: isHired ? '#DC2626' : '#059669' }}
              >
                {loading ? 'Saving…' : isHired ? 'Confirm' : 'Reinstate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
