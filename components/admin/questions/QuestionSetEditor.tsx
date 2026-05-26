'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'

export type QuestionRow = {
  id: string
  type: 'hard_filter' | 'scored' | 'informational'
  variants: string[]
  rubric: string | null
  fail_value: string | null
  weight: number
  order_index: number
}

type Props = {
  setId: string
  initialJobTitle: string
  initialThreshold: number
  initialQuestions: QuestionRow[]
}

const TYPE_LABELS = {
  hard_filter: 'Hard Filter',
  scored: 'Scored',
  informational: 'Informational',
}
const TYPE_COLORS = {
  hard_filter: 'bg-orange-50 text-orange-700',
  scored: 'bg-blue-50 text-blue-700',
  informational: 'bg-gray-100 text-gray-600',
}
const TYPE_HELP = {
  hard_filter: 'Instant disqualifier — if the answer matches the fail value, the applicant fails regardless of score.',
  scored: 'AI evaluates the answer and assigns a score (0–100). Weighted by importance.',
  informational: 'Recorded for context only — does not affect the pass/fail decision.',
}

type DraftQuestion = {
  id: string | null
  type: 'hard_filter' | 'scored' | 'informational'
  variants: string[]
  rubric: string
  fail_value: string
  weight: number
}

function emptyDraft(): DraftQuestion {
  return { id: null, type: 'scored', variants: [''], rubric: '', fail_value: '', weight: 1 }
}

export default function QuestionSetEditor({ setId, initialJobTitle, initialThreshold, initialQuestions }: Props) {
  const [jobTitle, setJobTitle] = useState(initialJobTitle)
  const [threshold, setThreshold] = useState(initialThreshold)
  const [questions, setQuestions] = useState<QuestionRow[]>(initialQuestions)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftQuestion | null>(null)
  const [saving, setSaving] = useState(false)
  const [settingsSaved, setSettingsSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // --- Settings save ---
  async function saveSettings() {
    setSaving(true)
    setError(null)
    const res = await fetch(`/api/admin/questions/${setId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_title: jobTitle, pass_threshold: threshold }),
    })
    setSaving(false)
    if (!res.ok) { setError('Failed to save settings'); return }
    setSettingsSaved(true)
    setTimeout(() => setSettingsSaved(false), 2000)
  }

  // --- Question CRUD ---
  function startEdit(q: QuestionRow) {
    setEditingId(q.id)
    setDraft({
      id: q.id,
      type: q.type,
      variants: [...q.variants],
      rubric: q.rubric ?? '',
      fail_value: q.fail_value ?? '',
      weight: q.weight,
    })
    setError(null)
  }

  function startAdd() {
    setEditingId('__new__')
    setDraft(emptyDraft())
    setError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setDraft(null)
    setError(null)
  }

  const saveQuestion = useCallback(async () => {
    if (!draft) return
    setSaving(true)
    setError(null)

    const body = {
      type: draft.type,
      variants: draft.variants.filter((v) => v.trim()),
      rubric: draft.rubric.trim() || null,
      fail_value: draft.fail_value.trim() || null,
      weight: draft.weight,
      order_index: draft.id
        ? questions.find((q) => q.id === draft.id)?.order_index ?? 0
        : questions.length,
    }

    if (body.variants.length === 0) {
      setError('At least one question variant is required.')
      setSaving(false)
      return
    }

    let res: Response
    if (draft.id) {
      res = await fetch(`/api/admin/questions/${setId}/questions/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      res = await fetch(`/api/admin/questions/${setId}/questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    }

    setSaving(false)
    if (!res.ok) { setError('Failed to save question'); return }

    const saved = await res.json()

    if (draft.id) {
      setQuestions((qs) => qs.map((q) => q.id === draft.id ? { ...q, ...body } : q))
    } else {
      setQuestions((qs) => [...qs, { id: saved.id, ...body }])
    }
    setEditingId(null)
    setDraft(null)
  }, [draft, questions, setId])

  async function deleteQuestion(qId: string) {
    if (!confirm('Delete this question?')) return
    const res = await fetch(`/api/admin/questions/${setId}/questions/${qId}`, { method: 'DELETE' })
    if (!res.ok) { setError('Failed to delete question'); return }
    setQuestions((qs) => qs.filter((q) => q.id !== qId))
  }

  async function moveQuestion(qId: string, direction: 'up' | 'down') {
    const idx = questions.findIndex((q) => q.id === qId)
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === questions.length - 1) return

    const newQuestions = [...questions]
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    ;[newQuestions[idx], newQuestions[swapIdx]] = [newQuestions[swapIdx], newQuestions[idx]]

    // Reassign order_index values
    const reindexed = newQuestions.map((q, i) => ({ ...q, order_index: i }))
    setQuestions(reindexed)

    // Persist both swapped questions
    await Promise.all([
      fetch(`/api/admin/questions/${setId}/questions/${reindexed[idx].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: reindexed[idx].order_index }),
      }),
      fetch(`/api/admin/questions/${setId}/questions/${reindexed[swapIdx].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_index: reindexed[swapIdx].order_index }),
      }),
    ])
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/questions" className="text-sm text-blue-600 hover:underline">
          ← Question Sets
        </Link>
      </div>

      {/* Settings card */}
      <div className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
          Set Settings
        </h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Title</label>
            <input
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium text-gray-700">
                Pass Threshold
              </label>
              <span className="text-sm font-bold text-gray-900">{threshold}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-blue-600"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-0.5">
              <span>0% (all pass)</span>
              <span>100% (near-perfect)</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={saveSettings}
              disabled={saving}
              className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save Settings'}
            </button>
            {settingsSaved && <span className="text-sm text-green-600">Saved!</span>}
          </div>
        </div>
      </div>

      {/* Questions */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
          Questions ({questions.length})
        </h2>
        {editingId !== '__new__' && (
          <button
            onClick={startAdd}
            className="text-sm text-blue-600 hover:underline font-medium"
          >
            + Add Question
          </button>
        )}
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {editingId === q.id && draft ? (
              <QuestionForm
                draft={draft}
                setDraft={setDraft}
                onSave={saveQuestion}
                onCancel={cancelEdit}
                saving={saving}
              />
            ) : (
              <div className="flex items-start gap-3 px-5 py-4">
                <div className="flex flex-col gap-1 mt-0.5 shrink-0">
                  <button
                    onClick={() => moveQuestion(q.id, 'up')}
                    disabled={idx === 0}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-lg"
                    title="Move up"
                  >▲</button>
                  <button
                    onClick={() => moveQuestion(q.id, 'down')}
                    disabled={idx === questions.length - 1}
                    className="text-gray-300 hover:text-gray-600 disabled:opacity-20 leading-none text-lg"
                    title="Move down"
                  >▼</button>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[q.type]}`}>
                      {TYPE_LABELS[q.type]}
                    </span>
                    {q.type === 'scored' && q.weight > 1 && (
                      <span className="text-xs text-gray-400">weight ×{q.weight}</span>
                    )}
                    {q.type === 'hard_filter' && q.fail_value && (
                      <span className="text-xs text-gray-400">fail if: <em>{q.fail_value}</em></span>
                    )}
                  </div>
                  <p className="text-sm text-gray-900">{q.variants[0]}</p>
                  {q.variants.length > 1 && (
                    <p className="text-xs text-gray-400 mt-0.5">+{q.variants.length - 1} variant{q.variants.length > 2 ? 's' : ''}</p>
                  )}
                  {q.rubric && (
                    <p className="text-xs text-gray-500 mt-1 italic">{q.rubric}</p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => startEdit(q)}
                    className="text-xs text-blue-600 hover:underline"
                  >Edit</button>
                  <button
                    onClick={() => deleteQuestion(q.id)}
                    className="text-xs text-red-500 hover:underline"
                  >Delete</button>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* New question form */}
        {editingId === '__new__' && draft && (
          <div className="bg-white rounded-lg border border-blue-300 overflow-hidden">
            <QuestionForm
              draft={draft}
              setDraft={setDraft}
              onSave={saveQuestion}
              onCancel={cancelEdit}
              saving={saving}
              isNew
            />
          </div>
        )}

        {questions.length === 0 && editingId !== '__new__' && (
          <p className="text-sm text-gray-400 text-center py-6">
            No questions yet. Add your first question above.
          </p>
        )}
      </div>
    </div>
  )
}

// --- Inline question form ---
function QuestionForm({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  isNew,
}: {
  draft: DraftQuestion
  setDraft: (d: DraftQuestion) => void
  onSave: () => void
  onCancel: () => void
  saving: boolean
  isNew?: boolean
}) {
  function updateVariant(i: number, val: string) {
    const v = [...draft.variants]
    v[i] = val
    setDraft({ ...draft, variants: v })
  }
  function addVariant() {
    if (draft.variants.length < 4) setDraft({ ...draft, variants: [...draft.variants, ''] })
  }
  function removeVariant(i: number) {
    if (draft.variants.length <= 1) return
    setDraft({ ...draft, variants: draft.variants.filter((_, idx) => idx !== i) })
  }

  return (
    <div className="px-5 py-4 space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          {isNew ? 'New Question' : 'Edit Question'}
        </span>
      </div>

      {/* Type selector */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Type</label>
        <div className="flex gap-2 flex-wrap">
          {(['hard_filter', 'scored', 'informational'] as const).map((t) => (
            <label key={t} className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="q-type"
                value={t}
                checked={draft.type === t}
                onChange={() => setDraft({ ...draft, type: t })}
                className="accent-blue-600"
              />
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${TYPE_COLORS[t]}`}>
                {TYPE_LABELS[t]}
              </span>
            </label>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-gray-400">{TYPE_HELP[draft.type]}</p>
      </div>

      {/* Variants */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">
          Question Text
          <span className="font-normal text-gray-400 ml-1">
            (variants — Vapi picks one at random each call)
          </span>
        </label>
        <div className="space-y-2">
          {draft.variants.map((v, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="text"
                value={v}
                onChange={(e) => updateVariant(i, e.target.value)}
                placeholder={`Variant ${i + 1}`}
                className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              {draft.variants.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeVariant(i)}
                  className="text-gray-400 hover:text-red-500 text-sm px-1"
                >✕</button>
              )}
            </div>
          ))}
        </div>
        {draft.variants.length < 4 && (
          <button
            type="button"
            onClick={addVariant}
            className="mt-1.5 text-xs text-blue-600 hover:underline"
          >+ Add variant</button>
        )}
      </div>

      {/* Scored: rubric + weight */}
      {draft.type === 'scored' && (
        <>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Rubric
              <span className="font-normal text-gray-400 ml-1">(what makes a good answer?)</span>
            </label>
            <textarea
              value={draft.rubric}
              onChange={(e) => setDraft({ ...draft, rubric: e.target.value })}
              rows={2}
              placeholder="e.g. Full availability for at least 3 shifts per week scores high; limited or vague availability scores low."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Weight
              <span className="font-normal text-gray-400 ml-1">(importance multiplier 1–5)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={1}
                max={5}
                step={1}
                value={draft.weight}
                onChange={(e) => setDraft({ ...draft, weight: Number(e.target.value) })}
                className="w-32 accent-blue-600"
              />
              <span className="text-sm font-bold text-gray-900 w-4">{draft.weight}</span>
            </div>
          </div>
        </>
      )}

      {/* Hard filter: fail value */}
      {draft.type === 'hard_filter' && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Fail Value
            <span className="font-normal text-gray-400 ml-1">(exact word/phrase that triggers disqualification, e.g. "no")</span>
          </label>
          <input
            type="text"
            value={draft.fail_value}
            onChange={(e) => setDraft({ ...draft, fail_value: e.target.value })}
            placeholder="no"
            className="w-48 rounded-md border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button
          onClick={onSave}
          disabled={saving}
          className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button
          onClick={onCancel}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
