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
    id: 'needs_decision', label: 'Needs Decision', statuses: ['screen_complete'],
    urgent: true,
    headerBg: 'bg-amber-50', headerBorder: 'border-l-4 border-amber-400',
    headerText: 'text-amber-800', countBg: 'bg-amber-100 text-amber-700',
    rowSelected: 'bg-amber-50',
  },
  {
    id: 'new', label: 'New Applications', statuses: ['applied'],
    headerBg: 'bg-blue-50', headerBorder: 'border-l-4 border-blue-400',
    headerText: 'text-blue-900', countBg: 'bg-blue-100 text-blue-700',
    rowSelected: 'bg-blue-50',
  },
  {
    id: 'in_progress', label: 'Screening In Progress', statuses: ['sms_sent', 'screen_link_clicked', 'screening'],
    headerBg: 'bg-indigo-50', headerBorder: 'border-l-4 border-indigo-400',
    headerText: 'text-indigo-900', countBg: 'bg-indigo-100 text-indigo-700',
    rowSelected: 'bg-indigo-50',
  },
  {
    id: 'passed', label: 'Passed — Awaiting Schedule', statuses: ['passed'],
    headerBg: 'bg-green-50', headerBorder: 'border-l-4 border-green-400',
    headerText: 'text-green-900', countBg: 'bg-green-100 text-green-700',
    rowSelected: 'bg-green-50',
  },
  {
    id: 'scheduled', label: 'Interview Scheduled', statuses: ['scheduled'],
    headerBg: 'bg-teal-50', headerBorder: 'border-l-4 border-teal-400',
    headerText: 'text-teal-900', countBg: 'bg-teal-100 text-teal-700',
    rowSelected: 'bg-teal-50',
  },
  {
    id: 'interviewed', label: 'Interviewed', statuses: ['interviewed'],
    headerBg: 'bg-purple-50', headerBorder: 'border-l-4 border-purple-400',
    headerText: 'text-purple-900', countBg: 'bg-purple-100 text-purple-700',
    rowSelected: 'bg-purple-50',
  },
  {
    id: 'hired', label: 'Hired', statuses: ['hired'],
    headerBg: 'bg-emerald-50', headerBorder: 'border-l-4 border-emerald-500',
    headerText: 'text-emerald-900', countBg: 'bg-emerald-100 text-emerald-700',
    rowSelected: 'bg-emerald-50',
  },
  {
    id: 'not_proceeding', label: 'Not Proceeding', statuses: ['failed', 'rejected', 'no_show'],
    defaultCollapsed: true,
    headerBg: 'bg-gray-100', headerBorder: 'border-l-4 border-gray-300',
    headerText: 'text-gray-500', countBg: 'bg-gray-200 text-gray-500',
    rowSelected: 'bg-gray-100',
  },
]

function timeAgo(dateStr: string): string {
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return '1 day ago'
  return `${days} days ago`
}

export default function ApplicantsTree({ apps: initialApps, pipelineMode }: Props) {
  const [apps, setApps] = useState(initialApps)
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>(
    Object.fromEntries(BUCKETS.filter((b) => b.defaultCollapsed).map((b) => [b.id, true]))
  )
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const selectedApp = apps.find((a) => a.id === selectedAppId) ?? null

  async function handleAdvance(appId: string) {
    setActionLoading(appId)
    setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'passed' } : a))
    if (selectedAppId === appId) setSelectedAppId(null)
    await fetch(`/api/admin/applications/${appId}/advance`, { method: 'POST' })
    setActionLoading(null)
  }

  async function handleReject(appId: string) {
    setActionLoading(appId)
    setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'rejected' } : a))
    if (selectedAppId === appId) setSelectedAppId(null)
    await fetch(`/api/admin/applications/${appId}/reject`, { method: 'POST' })
    setActionLoading(null)
  }

  function toggleBucket(bucketId: string) {
    setCollapsed((c) => ({ ...c, [bucketId]: !c[bucketId] }))
  }

  const visibleBuckets = pipelineMode === 'suggestion' ? BUCKETS : BUCKETS.filter((b) => b.id !== 'needs_decision')

  return (
    <div className="flex h-full">
      {/* Left: tree list */}
      <div className={`flex-1 overflow-auto transition-all duration-200 ${selectedAppId ? 'pr-0' : ''}`}>
        <div className="space-y-3">
          {visibleBuckets.map((bucket) => {
            const bucketApps = apps.filter((a) => bucket.statuses.includes(a.status))
            if (bucketApps.length === 0) return null
            const isCollapsed = collapsed[bucket.id] ?? false

            return (
              <div key={bucket.id} className="rounded-lg overflow-hidden border border-gray-200">
                {/* Bucket header */}
                <button
                  onClick={() => toggleBucket(bucket.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${bucket.headerBg} ${bucket.headerBorder} hover:brightness-95`}
                >
                  <span className={`text-xs ${bucket.headerText}`}>{isCollapsed ? '▶' : '▼'}</span>
                  <span className={`text-sm font-bold uppercase tracking-wide ${bucket.headerText}`}>
                    {bucket.label}
                  </span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${bucket.countBg}`}>
                    {bucketApps.length}
                  </span>
                </button>

                {/* Applicant rows */}
                {!isCollapsed && (
                  <div className="bg-white">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                          <th className="px-4 py-2 text-left">Candidate</th>
                          <th className="px-4 py-2 text-left hidden md:table-cell">Position</th>
                          <th className="px-4 py-2 text-left hidden lg:table-cell">Location</th>
                          <th className="px-4 py-2 text-left hidden sm:table-cell">Applied</th>
                          {(bucket.id === 'needs_decision' || bucket.id === 'passed' || bucket.id === 'not_proceeding') && (
                            <th className="px-4 py-2 text-left">Score</th>
                          )}
                          {bucket.id === 'needs_decision' && pipelineMode === 'suggestion' && (
                            <th className="px-4 py-2 text-left">AI Rec</th>
                          )}
                          <th className="px-4 py-2 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {bucketApps.map((app) => (
                          <tr
                            key={app.id}
                            onClick={() => setSelectedAppId(app.id === selectedAppId ? null : app.id)}
                            className={`cursor-pointer transition-colors ${
                              selectedAppId === app.id
                                ? bucket.rowSelected
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium text-gray-900">{app.applicantName}</p>
                              <p className="text-xs text-gray-400">{app.applicantPhone}</p>
                            </td>
                            <td className="px-4 py-3 text-gray-500 hidden md:table-cell">
                              {app.jobTitle ?? '—'}
                            </td>
                            <td className="px-4 py-3 text-gray-500 hidden lg:table-cell">
                              {app.locationName}
                            </td>
                            <td className="px-4 py-3 text-gray-400 text-xs hidden sm:table-cell">
                              {timeAgo(app.createdAt)}
                            </td>
                            {(bucket.id === 'needs_decision' || bucket.id === 'passed' || bucket.id === 'not_proceeding') && (
                              <td className="px-4 py-3">
                                {app.score !== null ? (
                                  <span className={`text-sm font-bold ${
                                    app.aiPassed ? 'text-green-600' : 'text-red-500'
                                  }`}>
                                    {app.score}
                                  </span>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                            )}
                            {bucket.id === 'needs_decision' && pipelineMode === 'suggestion' && (
                              <td className="px-4 py-3">
                                {app.aiPassed !== null && (() => {
                                  const isReview = app.aiPassed && app.score !== null && app.score < 70
                                  return (
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                                      isReview ? 'bg-amber-50 text-amber-700'
                                      : app.aiPassed ? 'bg-green-50 text-green-700'
                                      : 'bg-red-50 text-red-600'
                                    }`}>
                                      {isReview ? 'Review' : app.aiPassed ? 'Pass' : 'Fail'}
                                    </span>
                                  )
                                })()}
                              </td>
                            )}
                            <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end gap-2">
                                {bucket.id === 'needs_decision' && pipelineMode === 'suggestion' && (
                                  <>
                                    <button
                                      onClick={() => handleAdvance(app.id)}
                                      disabled={actionLoading === app.id}
                                      className="rounded px-2.5 py-1 text-xs font-semibold bg-green-600 text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                                    >
                                      ✓ Advance
                                    </button>
                                    <button
                                      onClick={() => handleReject(app.id)}
                                      disabled={actionLoading === app.id}
                                      className="rounded px-2.5 py-1 text-xs font-semibold bg-red-500 text-white hover:bg-red-600 disabled:opacity-50 transition-colors"
                                    >
                                      ✗ Reject
                                    </button>
                                  </>
                                )}
                                <button
                                  onClick={() => setSelectedAppId(app.id === selectedAppId ? null : app.id)}
                                  className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
                                >
                                  View →
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          {apps.length === 0 && (
            <div className="bg-white rounded-lg border border-gray-200 px-6 py-16 text-center">
              <p className="text-sm text-gray-400">No applicants yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Right: slide-out panel */}
      <ApplicantPanel
        appId={selectedAppId}
        app={selectedApp}
        pipelineMode={pipelineMode}
        onClose={() => setSelectedAppId(null)}
        onAdvance={handleAdvance}
        onReject={handleReject}
        actionLoading={actionLoading}
      />
    </div>
  )
}
