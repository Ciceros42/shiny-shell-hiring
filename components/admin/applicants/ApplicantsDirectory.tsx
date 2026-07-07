'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { STATUS_LABEL, STATUS_COLOR } from '@/lib/application-statuses'

type AppRow = {
  id: string
  status: string
  created_at: string
  jobs: { title: string } | null
  locations: { name: string } | null
}

type ApplicantRow = {
  id: string
  name: string
  phone: string
  email: string | null
  created_at: string
  applications: AppRow[]
}

function statusStyle(status: string) {
  return STATUS_COLOR[status] ?? 'bg-blue-50 text-blue-700'
}

export default function ApplicantsDirectory({ applicants }: { applicants: ApplicantRow[] }) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return applicants
    return applicants.filter(
      (a) =>
        a.name.toLowerCase().includes(q) ||
        a.phone.includes(q) ||
        (a.email ?? '').toLowerCase().includes(q)
    )
  }, [applicants, search])

  return (
    <div>
      {/* Search bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="relative flex-1 max-w-sm">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, or email…"
            className="w-full rounded-lg border border-gray-200 pl-9 pr-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
          />
        </div>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            Clear
          </button>
        )}
        <span className="text-xs text-gray-400 ml-auto">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-400">No applicants found.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {filtered.map((applicant) => {
              const latestApp = applicant.applications.slice().sort(
                (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )[0]
              return (
                <li key={applicant.id}>
                  <Link
                    href={`/applicants/${applicant.id}`}
                    className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">{applicant.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {applicant.phone}
                        {applicant.email && <> · {applicant.email}</>}
                        {latestApp?.locations?.name && <> · {latestApp.locations.name}</>}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      {latestApp && (
                        <>
                          {latestApp.jobs?.title && (
                            <span className="text-xs text-gray-400 hidden sm:block">{latestApp.jobs.title}</span>
                          )}
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusStyle(latestApp.status)}`}>
                            {STATUS_LABEL[latestApp.status] ?? latestApp.status}
                          </span>
                          {applicant.applications.length > 1 && (
                            <span className="text-xs text-gray-400">{applicant.applications.length} apps</span>
                          )}
                        </>
                      )}
                      <span className="text-gray-300 text-sm">→</span>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
