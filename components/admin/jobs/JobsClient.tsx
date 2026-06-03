'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type JobRow = {
  id: string
  title: string
  slug: string
  description: string | null
  question_set_id: string | null
  is_active: boolean
  created_at: string
}

type SetRow = {
  id: string
  job_title: string
}

interface Props {
  jobs: JobRow[]
  questionSets: SetRow[]
}

export default function JobsClient({ jobs: initialJobs, questionSets }: Props) {
  const router = useRouter()
  const [jobs, setJobs] = useState(initialJobs)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newSetId, setNewSetId] = useState('')

  async function toggleActive(job: JobRow) {
    setTogglingId(job.id)
    await fetch(`/api/admin/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !job.is_active }),
    })
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, is_active: !j.is_active } : j))
    )
    setTogglingId(null)
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setCreating(true)
    setFormError(null)

    const res = await fetch('/api/admin/jobs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newTitle.trim(),
        description: newDesc.trim() || null,
        questionSetId: newSetId || null,
      }),
    })

    const json = await res.json()
    setCreating(false)

    if (!res.ok) {
      setFormError(json.error ?? 'Failed to create job')
      return
    }

    setShowForm(false)
    setNewTitle('')
    setNewDesc('')
    setNewSetId('')
    router.refresh()
  }

  const inputClass = 'w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none'

  return (
    <div className="space-y-4">
      {/* Job list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {jobs.length === 0 && !showForm && (
          <p className="px-6 py-10 text-center text-sm text-gray-400">
            No jobs yet. Create one to let applicants choose a position.
          </p>
        )}
        <ul className="divide-y divide-gray-100">
          {jobs.map((job) => {
            const setName = questionSets.find((s) => s.id === job.question_set_id)?.job_title
            return (
              <li key={job.id} className="flex items-center justify-between px-5 py-4 gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900 truncate">{job.title}</p>
                    {!job.is_active && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                        inactive
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {setName ? `Questions: ${setName}` : 'No question set assigned'} ·{' '}
                    <span className="font-mono">/apply/…/{job.slug}</span>
                  </p>
                  {job.description && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate">{job.description}</p>
                  )}
                </div>
                <button
                  role="switch"
                  aria-checked={job.is_active}
                  onClick={() => toggleActive(job)}
                  disabled={togglingId === job.id}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 focus:outline-none disabled:opacity-50 ${
                    job.is_active ? 'bg-green-500' : 'bg-gray-300'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                      job.is_active ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {/* New job form */}
      {showForm ? (
        <form
          onSubmit={handleCreate}
          className="bg-white rounded-lg border border-gray-200 p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-gray-900">New position</h3>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Job title *</label>
            <input
              className={inputClass}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="e.g. Carwash Associate"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Description <span className="text-gray-400">(optional — shown to applicants)</span>
            </label>
            <textarea
              className={inputClass + ' resize-none'}
              rows={2}
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="e.g. Full-time and part-time available. No experience required."
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Question set <span className="text-gray-400">(can be set later)</span>
            </label>
            <select
              className={inputClass + ' bg-white'}
              value={newSetId}
              onChange={(e) => setNewSetId(e.target.value)}
            >
              <option value="">— None —</option>
              {questionSets.map((s) => (
                <option key={s.id} value={s.id}>{s.job_title}</option>
              ))}
            </select>
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={creating || !newTitle.trim()}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {creating ? 'Creating…' : 'Create job'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormError(null) }}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          + New position
        </button>
      )}
    </div>
  )
}
