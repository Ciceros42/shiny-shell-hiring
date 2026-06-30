'use client'

import { useState } from 'react'
import ApplicantPanel from './ApplicantPanel'

export type AppListItem = {
  id: string
  applicantId: string
  applicantName: string
  applicantPhone: string
  jobTitle: string | null
  locationName: string
  status: string
  createdAt: string
  score: number | null
  aiPassed: boolean | null
}

interface Props {
  apps: AppListItem[]
  pipelineMode: 'suggestion' | 'assistant'
}

const BUCKETS = [
  {
    id: 'needs_decision', label: 'Needs Decision', statuses: ['screen_complete'], urgent: true,
    accentColor: '#F59E0B', accentBg: 'rgba(245,158,11,0.08)', badgeStyle: { backgroundColor: '#FEF3C7', color: '#92400E' },
  },
  {
    id: 'new', label: 'New Applications', statuses: ['applied'],
    accentColor: '#3B82F6', accentBg: 'rgba(59,130,246,0.06)', badgeStyle: { backgroundColor: '#DBEAFE', color: '#1E40AF' },
  },
  {
    id: 'in_progress', label: 'Screening In Progress', statuses: ['sms_sent', 'screen_link_clicked', 'screening'],
    accentColor: '#6366F1', accentBg: 'rgba(99,102,241,0.06)', badgeStyle: { backgroundColor: '#E0E7FF', color: '#3730A3' },
  },
  {
    id: 'passed', label: 'Passed — Awaiting Schedule', statuses: ['passed'],
    accentColor: '#10B981', accentBg: 'rgba(16,185,129,0.06)', badgeStyle: { backgroundColor: '#D1FAE5', color: '#065F46' },
  },
  {
    id: 'scheduled', label: 'Interview Scheduled', statuses: ['scheduled'],
    accentColor: '#14B8A6', accentBg: 'rgba(20,184,166,0.06)', badgeStyle: { backgroundColor: '#CCFBF1', color: '#134E4A' },
  },
  {
    id: 'interviewed', label: 'Interview: Needs Decision', statuses: ['interviewed'], urgent: true,
    accentColor: '#8B5CF6', accentBg: 'rgba(139,92,246,0.08)', badgeStyle: { backgroundColor: '#EDE9FE', color: '#4C1D95' },
  },
  {
    id: 'hired', label: 'Hired', statuses: ['hired'],
    accentColor: '#059669', accentBg: 'rgba(5,150,105,0.06)', badgeStyle: { backgroundColor: '#A7F3D0', color: '#064E3B' },
  },
  {
    id: 'not_proceeding', label: 'Not Proceeding', statuses: ['failed', 'rejected', 'no_show'],
    defaultCollapsed: true,
    accentColor: '#9CA3AF', accentBg: 'transparent', badgeStyle: { backgroundColor: '#F3F4F6', color: '#6B7280' },
  },
]

function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

function ScoreBadge({ score, passed }: { score: number; passed: boolean | null }) {
  const color =
    score >= 70 ? { bg: '#DCFCE7', text: '#166534' } :
    score >= 50 ? { bg: '#FEF9C3', text: '#854D0E' } :
                  { bg: '#FEE2E2', text: '#991B1B' }
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold"
      style={{ backgroundColor: color.bg, color: color.text }}
    >
      {score}
    </span>
  )
}

export default function ApplicantsTree({ apps: initialApps, pipelineMode }: Props) {
  const [apps, setApps] = useState(initialApps)
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    Object.fromEntries(BUCKETS.filter((b) => b.defaultCollapsed).map((b) => [b.id, true]))
  )
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set())
  const [actionError, setActionError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const isLoading = (id: string) => actionLoading.has(id)
  const selectedApp = apps.find((a) => a.id === selectedAppId) ?? null

  async function handleAdvance(appId: string) {
    setActionError(null)
    setActionLoading(prev => new Set(prev).add(appId))
    const res = await fetch(`/api/admin/applications/${appId}/advance`, { method: 'POST' })
    if (res.ok) {
      setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'passed' } : a))
      if (selectedAppId === appId) setSelectedAppId(null)
    } else {
      setActionError('Failed to advance applicant. Please try again.')
    }
    setActionLoading(prev => { const s = new Set(prev); s.delete(appId); return s })
  }

  async function handleReject(appId: string) {
    setActionError(null)
    const name = apps.find(a => a.id === appId)?.applicantName ?? 'this applicant'
    if (!window.confirm('Reject ' + name + '? This cannot be undone.')) return
    setActionLoading(prev => new Set(prev).add(appId))
    const res = await fetch(`/api/admin/applications/${appId}/reject`, { method: 'POST' })
    if (res.ok) {
      setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'rejected' } : a))
      if (selectedAppId === appId) setSelectedAppId(null)
    } else {
      setActionError('Failed to reject applicant. Please try again.')
    }
    setActionLoading(prev => { const s = new Set(prev); s.delete(appId); return s })
  }

  async function handleHire(appId: string) {
    setActionError(null)
    setActionLoading(prev => new Set(prev).add(appId))
    const res = await fetch(`/api/admin/applications/${appId}/hire`, { method: 'POST' })
    if (res.ok) {
      setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'hired' } : a))
      if (selectedAppId === appId) setSelectedAppId(null)
    } else {
      setActionError('Failed to mark as hired. Please try again.')
    }
    setActionLoading(prev => { const s = new Set(prev); s.delete(appId); return s })
  }

  async function handleMarkInterviewed(appId: string) {
    setActionError(null)
    setActionLoading(prev => new Set(prev).add(appId))
    const res = await fetch(`/api/admin/applications/${appId}/mark-interviewed`, { method: 'POST' })
    if (res.ok) {
      setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'interviewed' } : a))
      if (selectedAppId === appId) setSelectedAppId(null)
    } else {
      setActionError('Failed to update status.')
    }
    setActionLoading(prev => { const s = new Set(prev); s.delete(appId); return s })
  }

  function toggleBucket(bucketId: string) {
    setCollapsed((c) => ({ ...c, [bucketId]: !c[bucketId] }))
  }

  const visibleBuckets = pipelineMode === 'suggestion'
    ? BUCKETS
    : BUCKETS.filter((b) => b.id !== 'needs_decision')

  const filteredApps = search.trim()
    ? apps.filter(a =>
        a.applicantName.toLowerCase().includes(search.toLowerCase()) ||
        a.applicantPhone.includes(search)
      )
    : apps

  return (
    <div className="flex h-full">
      <div className="flex-1 overflow-auto min-w-0">
        {actionError && (
          <div className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-[13px] text-red-600">
            {actionError}
          </div>
        )}

        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or phone…"
            className="w-full rounded-xl border px-3.5 py-2.5 text-[13px] focus:outline-none transition-colors"
            style={{
              borderColor: 'var(--ui-border)',
              backgroundColor: 'var(--ui-card-bg)',
              color: 'var(--ui-text-primary)',
            }}
          />
        </div>

        <div className="space-y-3">
          {visibleBuckets.map((bucket) => {
            const bucketApps = filteredApps.filter((a) => bucket.statuses.includes(a.status))
            if (bucket.id === 'not_proceeding' && bucketApps.length === 0) return null
            const isCollapsed = collapsed[bucket.id] ?? false

            return (
              <div
                key={bucket.id}
                className="rounded-xl overflow-hidden"
                style={{ border: '1px solid var(--ui-border)' }}
              >
                {/* Bucket header */}
                <button
                  onClick={() => toggleBucket(bucket.id)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{
                    backgroundColor: bucket.accentBg,
                    borderLeft: `3px solid ${bucket.accentColor}`,
                  }}
                >
                  <svg
                    className="shrink-0 transition-transform"
                    style={{
                      transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                      color: bucket.accentColor,
                    }}
                    width="12" height="12" viewBox="0 0 12 12"
                    fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                  >
                    <path d="M2 4l4 4 4-4" />
                  </svg>
                  <span
                    className="text-[12px] font-semibold uppercase tracking-[0.06em]"
                    style={{ color: bucket.accentColor }}
                  >
                    {bucket.label}
                  </span>
                  <span
                    className="text-[11px] font-bold px-2 py-0.5 rounded-full"
                    style={bucket.badgeStyle}
                  >
                    {bucketApps.length}
                  </span>
                </button>

                {/* Rows */}
                {!isCollapsed && (
                  <div style={{ backgroundColor: 'var(--ui-card-bg)' }}>
                    {bucketApps.length === 0 && (
                      <p className="px-5 py-5 text-center text-[12px] italic" style={{ color: 'var(--ui-text-muted)' }}>
                        No candidates
                      </p>
                    )}
                    {bucketApps.map((app) => (
                      <div
                        key={app.id}
                        onClick={() => setSelectedAppId(app.id === selectedAppId ? null : app.id)}
                        className="flex items-center gap-4 px-4 py-3 cursor-pointer transition-colors"
                        style={{
                          borderTop: '1px solid var(--ui-border)',
                          backgroundColor: selectedAppId === app.id ? bucket.accentBg : undefined,
                        }}
                        onMouseEnter={(e) => {
                          if (selectedAppId !== app.id)
                            (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--ui-content-bg)'
                        }}
                        onMouseLeave={(e) => {
                          if (selectedAppId !== app.id)
                            (e.currentTarget as HTMLElement).style.backgroundColor = ''
                        }}
                      >
                        {/* Candidate info */}
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ui-text-primary)' }}>
                            {app.applicantName}
                          </p>
                          <p className="text-[11px] truncate" style={{ color: 'var(--ui-text-muted)' }}>
                            {app.applicantPhone}
                          </p>
                        </div>

                        {/* Job */}
                        <div className="hidden md:block w-32 shrink-0">
                          <p className="text-[12px] truncate" style={{ color: 'var(--ui-text-secondary)' }}>
                            {app.jobTitle ?? '—'}
                          </p>
                        </div>

                        {/* Score */}
                        <div className="w-10 shrink-0 text-center">
                          {app.score !== null ? (
                            <ScoreBadge score={app.score} passed={app.aiPassed} />
                          ) : (
                            <span className="text-[11px]" style={{ color: 'var(--ui-text-muted)' }}>—</span>
                          )}
                        </div>

                        {/* AI rec (needs decision only) */}
                        {bucket.id === 'needs_decision' && pipelineMode === 'suggestion' && app.aiPassed !== null && (
                          <div className="hidden sm:block w-14 shrink-0">
                            {(() => {
                              const isReview = app.aiPassed && app.score !== null && app.score < 70
                              return (
                                <span
                                  className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                                  style={{
                                    backgroundColor: isReview ? '#FEF3C7' : app.aiPassed ? '#DCFCE7' : '#FEE2E2',
                                    color: isReview ? '#92400E' : app.aiPassed ? '#166534' : '#991B1B',
                                  }}
                                >
                                  {isReview ? 'Review' : app.aiPassed ? 'Pass' : 'Fail'}
                                </span>
                              )
                            })()}
                          </div>
                        )}

                        {/* Age */}
                        <div className="hidden sm:block w-14 text-right shrink-0">
                          <span className="text-[11px]" style={{ color: 'var(--ui-text-muted)' }}>
                            {timeAgo(app.createdAt)}
                          </span>
                        </div>

                        {/* Actions */}
                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {bucket.id === 'needs_decision' && pipelineMode === 'suggestion' && (
                            <>
                              <button
                                onClick={() => handleAdvance(app.id)}
                                disabled={isLoading(app.id)}
                                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors disabled:opacity-50"
                                style={{ backgroundColor: '#16a34a' }}
                              >
                                Advance
                              </button>
                              <button
                                onClick={() => handleReject(app.id)}
                                disabled={isLoading(app.id)}
                                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors disabled:opacity-50"
                                style={{ backgroundColor: '#dc2626' }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {bucket.id === 'interviewed' && (
                            <>
                              <button
                                onClick={() => handleHire(app.id)}
                                disabled={isLoading(app.id)}
                                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors disabled:opacity-50"
                                style={{ backgroundColor: '#059669' }}
                              >
                                Hire
                              </button>
                              <button
                                onClick={() => handleReject(app.id)}
                                disabled={isLoading(app.id)}
                                className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors disabled:opacity-50"
                                style={{ backgroundColor: '#dc2626' }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {bucket.id === 'scheduled' && (
                            <button
                              onClick={() => handleMarkInterviewed(app.id)}
                              disabled={isLoading(app.id)}
                              className="rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-white transition-colors disabled:opacity-50"
                              style={{ backgroundColor: '#8B5CF6' }}
                            >
                              Interviewed
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedAppId(app.id === selectedAppId ? null : app.id)}
                            className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors border"
                            style={{
                              borderColor: 'var(--ui-border)',
                              color: 'var(--ui-text-secondary)',
                              backgroundColor: 'var(--ui-card-bg)',
                            }}
                          >
                            View
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {apps.length === 0 && (
            <div
              className="rounded-xl border py-16 text-center"
              style={{ backgroundColor: 'var(--ui-card-bg)', borderColor: 'var(--ui-border)' }}
            >
              <p className="text-sm" style={{ color: 'var(--ui-text-muted)' }}>No applicants yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Detail panel */}
      <ApplicantPanel
        appId={selectedAppId}
        app={selectedApp}
        pipelineMode={pipelineMode}
        onClose={() => setSelectedAppId(null)}
        onAdvance={handleAdvance}
        onReject={handleReject}
        onHire={handleHire}
        onMarkInterviewed={handleMarkInterviewed}
        actionLoading={isLoading(selectedApp?.id ?? '')}
      />
    </div>
  )
}
