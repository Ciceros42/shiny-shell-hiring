'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type JobRow = {
  id: string
  title: string
  slug: string
  description: string | null
  question_set_id: string | null
  application_form_id: string | null
  is_active: boolean
  created_at: string
}

type SetRow = {
  id: string
  job_title: string
}

type FormRow = {
  id: string
  name: string
}

type LocationRow = {
  id: string
  name: string
}

interface Props {
  jobs: JobRow[]
  questionSets: SetRow[]
  applicationForms: FormRow[]
  locationOptions: LocationRow[]
  jobLocationMap: Record<string, string[]>
  companySlug: string
}

export default function JobsClient({
  jobs: initialJobs,
  questionSets,
  applicationForms,
  locationOptions,
  jobLocationMap: initialJobLocationMap,
  companySlug,
}: Props) {
  const router = useRouter()
  const [jobs, setJobs] = useState(initialJobs)
  const [jobLocationMap, setJobLocationMap] = useState(initialJobLocationMap)
  const [togglingId, setTogglingId] = useState<string | null>(null)
  const [assigningFormId, setAssigningFormId] = useState<string | null>(null)
  const [expandedLocationJob, setExpandedLocationJob] = useState<string | null>(null)
  const [savingLocationsFor, setSavingLocationsFor] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [creating, setCreating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newSetId, setNewSetId] = useState('')

  async function assignForm(job: JobRow, formId: string | null) {
    setAssigningFormId(job.id)
    const res = await fetch(`/api/admin/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ application_form_id: formId }),
    })
    if (res.ok) {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, application_form_id: formId } : j)))
    }
    setAssigningFormId(null)
  }

  async function saveLocations(jobId: string, locationIds: string[]) {
    setSavingLocationsFor(jobId)
    const res = await fetch(`/api/admin/jobs/${jobId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ location_ids: locationIds }),
    })
    if (res.ok) {
      setJobLocationMap((prev) => ({ ...prev, [jobId]: locationIds }))
    }
    setSavingLocationsFor(null)
    setExpandedLocationJob(null)
  }

  async function toggleActive(job: JobRow) {
    setTogglingId(job.id)
    const originalJobs = jobs
    const res = await fetch(`/api/admin/jobs/${job.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !job.is_active }),
    })
    if (res.ok) {
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, is_active: !j.is_active } : j))
      )
    } else {
      setJobs(originalJobs)
      setFormError('Failed to update hiring status. Please try again.')
    }
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
            const assignedForm = applicationForms.find((f) => f.id === job.application_form_id)
            const assignedLocationIds = jobLocationMap[job.id] ?? []
            const isLocationExpanded = expandedLocationJob === job.id
            return (
              <li key={job.id} className="px-5 py-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-gray-900 truncate">{job.title}</p>
                      {!job.is_active && (
                        <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full shrink-0">
                          inactive
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {setName ? `Questions: ${setName}` : 'No question set'} ·{' '}
                      <span className="font-mono">/apply/{companySlug}/…/{job.slug}</span>
                    </p>
                    {job.description && (
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{job.description}</p>
                    )}
                    {/* Application form assignment */}
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <span className="text-xs text-gray-400">Application:</span>
                      <select
                        value={job.application_form_id ?? ''}
                        onChange={(e) => assignForm(job, e.target.value || null)}
                        disabled={assigningFormId === job.id}
                        className="text-xs rounded border border-gray-200 px-1.5 py-0.5 bg-white text-gray-700 focus:outline-none focus:border-gray-400 disabled:opacity-50"
                      >
                        <option value="">— None —</option>
                        {applicationForms.map((f) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                      {assignedForm && (
                        <span className="text-xs text-green-600">✓</span>
                      )}
                    </div>
                    {/* Location assignment */}
                    {locationOptions.length > 0 && (
                      <div className="mt-1.5">
                        <button
                          onClick={() => setExpandedLocationJob(isLocationExpanded ? null : job.id)}
                          className="text-xs text-gray-500 hover:text-gray-700 underline-offset-2 hover:underline"
                        >
                          {assignedLocationIds.length === 0
                            ? 'Locations: all (click to restrict)'
                            : `Locations: ${assignedLocationIds.map((lid) => locationOptions.find((l) => l.id === lid)?.name ?? lid).join(', ')}`}
                        </button>
                      </div>
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
                </div>

                {/* Location picker — inline expandable */}
                {isLocationExpanded && (
                  <LocationPicker
                    locations={locationOptions}
                    selected={assignedLocationIds}
                    saving={savingLocationsFor === job.id}
                    onSave={(ids) => saveLocations(job.id, ids)}
                    onCancel={() => setExpandedLocationJob(null)}
                  />
                )}
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

function LocationPicker({
  locations,
  selected,
  saving,
  onSave,
  onCancel,
}: {
  locations: LocationRow[]
  selected: string[]
  saving: boolean
  onSave: (ids: string[]) => void
  onCancel: () => void
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set(selected))

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="mt-3 ml-0 bg-gray-50 border border-gray-200 rounded-lg p-3">
      <p className="text-xs font-medium text-gray-700 mb-2">
        Show this job at: <span className="font-normal text-gray-500">(leave all unchecked to show everywhere)</span>
      </p>
      <div className="space-y-1.5">
        {locations.map((loc) => (
          <label key={loc.id} className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={checked.has(loc.id)}
              onChange={() => toggle(loc.id)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{loc.name}</span>
          </label>
        ))}
      </div>
      <div className="flex gap-2 mt-3">
        <button
          onClick={() => onSave(Array.from(checked))}
          disabled={saving}
          className="rounded px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="rounded px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-200"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
