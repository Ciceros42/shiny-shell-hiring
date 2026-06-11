'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AppForm, AppFormQuestion, FormOption } from '@/lib/db/application-forms'

interface Props { form: AppForm }

const BLANK_QUESTION: QFormValue = {
  questionText: '',
  questionType: 'single',
  isRequired: true,
  options: [
    { text: '', is_fail: false },
    { text: '', is_fail: false },
  ],
}

type QFormValue = {
  questionText: string
  questionType: 'single' | 'multi'
  isRequired: boolean
  options: FormOption[]
}

export default function FormEditor({ form: initialForm }: Props) {
  const router = useRouter()
  const [formName, setFormName] = useState(initialForm.name)
  const [nameSaving, setNameSaving] = useState(false)
  const [questions, setQuestions] = useState<AppFormQuestion[]>(initialForm.questions)
  const [addingQuestion, setAddingQuestion] = useState(false)
  const [newQ, setNewQ] = useState({ ...BLANK_QUESTION, options: BLANK_QUESTION.options.map((o) => ({ ...o })) })
  const [newQSaving, setNewQSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editQ, setEditQ] = useState<typeof BLANK_QUESTION | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function saveName() {
    if (!formName.trim() || formName === initialForm.name) return
    setNameSaving(true)
    await fetch(`/api/admin/application-forms/${initialForm.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: formName.trim() }),
    })
    setNameSaving(false)
    router.refresh()
  }

  async function saveNewQuestion() {
    setError(null)
    if (!newQ.questionText.trim()) { setError('Question text is required'); return }
    const opts = newQ.options.filter((o) => o.text.trim())
    if (opts.length < 2) { setError('At least 2 options are required'); return }
    setNewQSaving(true)
    const res = await fetch(`/api/admin/application-forms/${initialForm.id}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...newQ, questionText: newQ.questionText.trim(), options: opts }),
    })
    setNewQSaving(false)
    if (!res.ok) { setError('Failed to save question'); return }
    const created = await res.json()
    setQuestions((prev) => [...prev, created])
    setAddingQuestion(false)
    setNewQ({ ...BLANK_QUESTION, options: BLANK_QUESTION.options.map((o) => ({ ...o })) })
  }

  function startEdit(q: AppFormQuestion) {
    setEditingId(q.id)
    setEditQ({ questionText: q.questionText, questionType: q.questionType, isRequired: q.isRequired, options: q.options.map((o) => ({ ...o })) })
    setError(null)
  }

  async function saveEdit(questionId: string) {
    if (!editQ) return
    setError(null)
    if (!editQ.questionText.trim()) { setError('Question text is required'); return }
    const opts = editQ.options.filter((o) => o.text.trim())
    if (opts.length < 2) { setError('At least 2 options are required'); return }
    const res = await fetch(`/api/admin/application-forms/${initialForm.id}/questions/${questionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...editQ, questionText: editQ.questionText.trim(), options: opts }),
    })
    if (!res.ok) { setError('Failed to save changes'); return }
    setQuestions((prev) => prev.map((q) => q.id === questionId ? { ...q, ...editQ, options: opts } : q))
    setEditingId(null)
    setEditQ(null)
  }

  async function deleteQuestion(questionId: string) {
    setDeletingId(questionId)
    await fetch(`/api/admin/application-forms/${initialForm.id}/questions/${questionId}`, { method: 'DELETE' })
    setQuestions((prev) => prev.filter((q) => q.id !== questionId))
    setDeletingId(null)
  }

  async function deleteForm() {
    if (!confirm('Delete this application form? Jobs using it will be unassigned.')) return
    await fetch(`/api/admin/application-forms/${initialForm.id}`, { method: 'DELETE' })
    router.push('/application-forms')
  }

  return (
    <div>
      {/* Back */}
      <a href="/application-forms" className="text-sm text-blue-600 hover:underline mb-6 inline-block">
        ← Applications
      </a>

      {/* Form name */}
      <div className="flex items-center gap-3 mb-8">
        <input
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          onBlur={saveName}
          className="text-2xl font-bold text-gray-900 bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-0 w-full max-w-md"
        />
        {nameSaving && <span className="text-xs text-gray-400">Saving…</span>}
      </div>

      {/* Questions */}
      <div className="space-y-3 mb-5">
        {questions.length === 0 && !addingQuestion && (
          <p className="text-sm text-gray-400 py-4">No questions yet. Add one below.</p>
        )}

        {questions.map((q) => (
          <div key={q.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {editingId === q.id && editQ ? (
              <div className="p-5 space-y-4">
                <QuestionForm
                  value={editQ}
                  onChange={setEditQ as (v: typeof BLANK_QUESTION) => void}
                  error={error}
                />
                <div className="flex gap-2 pt-1">
                  <button onClick={() => saveEdit(q.id)} className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700">Save</button>
                  <button onClick={() => { setEditingId(null); setEditQ(null); setError(null) }} className="rounded-md px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start justify-between px-5 py-4 gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-medium text-gray-900">{q.questionText}</p>
                    {q.isRequired && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">required</span>
                    )}
                    <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">
                      {q.questionType === 'single' ? 'Single choice' : 'Multi-select'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {q.options.map((opt, i) => (
                      <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${opt.is_fail ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-gray-100 text-gray-600'}`}>
                        {opt.text}{opt.is_fail ? ' ✕' : ''}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => startEdit(q)} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => deleteQuestion(q.id)} disabled={deletingId === q.id} className="text-xs text-red-500 hover:underline disabled:opacity-40">
                    {deletingId === q.id ? '…' : 'Delete'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}

        {addingQuestion && (
          <div className="bg-white rounded-lg border border-blue-300 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-gray-700">New question</h3>
            <QuestionForm value={newQ} onChange={setNewQ} error={error} />
            <div className="flex gap-2 pt-1">
              <button onClick={saveNewQuestion} disabled={newQSaving} className="rounded-md bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                {newQSaving ? 'Saving…' : 'Add question'}
              </button>
              <button onClick={() => { setAddingQuestion(false); setError(null) }} className="rounded-md px-4 py-1.5 text-sm font-medium text-gray-600 hover:bg-gray-100">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {!addingQuestion && (
        <button
          onClick={() => { setAddingQuestion(true); setError(null) }}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
        >
          + Add question
        </button>
      )}

      <div className="mt-12 pt-6 border-t border-gray-200">
        <button onClick={deleteForm} className="text-sm text-red-500 hover:text-red-700 hover:underline">
          Delete this application form
        </button>
      </div>
    </div>
  )
}

function QuestionForm({ value, onChange, error }: { value: QFormValue; onChange: (v: QFormValue) => void; error: string | null }) {
  function setField<K extends keyof QFormValue>(key: K, val: QFormValue[K]) {
    onChange({ ...value, [key]: val })
  }

  function setOption(i: number, field: keyof FormOption, val: string | boolean) {
    const next = value.options.map((o, idx) => idx === i ? { ...o, [field]: val } : o)
    setField('options', next)
  }

  function addOption() {
    setField('options', [...value.options, { text: '', is_fail: false }])
  }

  function removeOption(i: number) {
    setField('options', value.options.filter((_, idx) => idx !== i))
  }

  const inputClass = 'w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none'

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Question text *</label>
        <input
          className={inputClass}
          value={value.questionText}
          onChange={(e) => setField('questionText', e.target.value)}
          placeholder="e.g. Do you have reliable transportation?"
          autoFocus
        />
      </div>

      <div className="flex gap-4 flex-wrap">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
          <select
            className={inputClass + ' bg-white w-auto'}
            value={value.questionType}
            onChange={(e) => setField('questionType', e.target.value as 'single' | 'multi')}
          >
            <option value="single">Single choice</option>
            <option value="multi">Select all that apply</option>
          </select>
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value.isRequired}
              onChange={(e) => setField('isRequired', e.target.checked)}
              className="rounded"
            />
            <span className="text-sm text-gray-700">Required</span>
          </label>
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-gray-700">
            Options {value.questionType === 'single' ? '— mark failing answer(s) with ✕' : ''}
          </label>
        </div>
        <div className="space-y-2">
          {value.options.map((opt, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={inputClass + ' flex-1'}
                value={opt.text}
                onChange={(e) => setOption(i, 'text', e.target.value)}
                placeholder={`Option ${i + 1}`}
              />
              {value.questionType === 'single' && (
                <button
                  type="button"
                  onClick={() => setOption(i, 'is_fail', !opt.is_fail)}
                  title={opt.is_fail ? 'Mark as passing' : 'Mark as failing'}
                  className={`shrink-0 w-7 h-7 rounded-md text-sm font-bold transition-colors ${opt.is_fail ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                >
                  ✕
                </button>
              )}
              {value.options.length > 2 && (
                <button type="button" onClick={() => removeOption(i)} className="shrink-0 text-gray-300 hover:text-red-400 text-lg leading-none">×</button>
              )}
            </div>
          ))}
        </div>
        <button type="button" onClick={addOption} className="mt-2 text-xs text-blue-600 hover:underline">
          + Add option
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  )
}
