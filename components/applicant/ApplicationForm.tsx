'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AppFormQuestion } from '@/lib/db/application-forms'

interface Props {
  companySlug: string
  locationSlug: string
  jobSlug: string
  formQuestions?: AppFormQuestion[]
}

export function ApplicationForm({ companySlug, locationSlug, jobSlug, formQuestions = [] }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [preferEmail, setPreferEmail] = useState(false)
  const [website, setWebsite] = useState('') // honeypot
  // questionId -> selected option texts
  const [responses, setResponses] = useState<Record<string, string[]>>({})

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function toggleOption(questionId: string, optionText: string, type: 'single' | 'multi') {
    setResponses((prev) => {
      if (type === 'single') return { ...prev, [questionId]: [optionText] }
      const current = prev[questionId] ?? []
      const next = current.includes(optionText) ? current.filter((o) => o !== optionText) : [...current, optionText]
      return { ...prev, [questionId]: next }
    })
  }

  function validate() {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!phone.trim()) errs.phone = 'Phone number is required'
    for (const q of formQuestions) {
      if (q.isRequired && (!responses[q.id] || responses[q.id].length === 0)) {
        errs[`q_${q.id}`] = 'This question is required'
      }
    }
    return errs
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const errs = validate()
    setFieldErrors(errs)
    if (Object.keys(errs).length > 0) return

    setIsSubmitting(true)
    try {
      const res = await fetch('/api/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          preferEmail: email.trim() ? preferEmail : undefined,
          companySlug,
          locationSlug,
          jobSlug,
          website,
          responses: Object.keys(responses).length > 0 ? responses : undefined,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        if (res.status === 429) {
          setError('Too many submissions. Please try again in 15 minutes.')
        } else if (typeof data.error === 'string') {
          setError(data.error)
        } else {
          setError('Something went wrong. Please try again.')
        }
        return
      }

      const params = new URLSearchParams({ appId: data.applicationId })
      if (data.email) params.set('email', data.email)
      router.push(`/apply/${companySlug}/${locationSlug}/${jobSlug}/submitted?${params.toString()}`)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6" noValidate>
      {/* Honeypot — hidden from users, visible to bots */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
          Full name *
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="Jane Smith"
        />
        {fieldErrors.name && <p className="mt-1 text-sm text-red-600">{fieldErrors.name}</p>}
      </div>

      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">
          Mobile phone number *
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="(555) 123-4567"
        />
        {fieldErrors.phone && <p className="mt-1 text-sm text-red-600">{fieldErrors.phone}</p>}
      </div>

      <div>
        <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
          Email address <span className="text-gray-400">(optional)</span>
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="w-full rounded-lg border border-gray-300 px-4 py-3 text-base focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          placeholder="jane@example.com"
        />
      </div>

      {email.trim() && (
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">
            How would you like to receive updates about your application?
          </p>
          <div className="flex gap-4">
            {[
              { value: false, label: 'Text (SMS)' },
              { value: true, label: 'Email' },
            ].map(({ value, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => setPreferEmail(value)}
                className={`flex-1 rounded-lg border-2 py-3 text-sm font-medium transition-colors ${
                  preferEmail === value
                    ? 'border-blue-600 bg-blue-50 text-blue-700'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Custom application form questions */}
      {formQuestions.map((q) => {
        const selected = responses[q.id] ?? []
        return (
          <div key={q.id}>
            <p className="mb-2 text-sm font-medium text-gray-700">
              {q.questionText} {q.isRequired && <span className="text-gray-400">*</span>}
            </p>
            <div className={q.questionType === 'single' ? 'flex gap-3 flex-wrap' : 'space-y-2'}>
              {q.options.map((opt) => {
                const isSelected = selected.includes(opt.text)
                if (q.questionType === 'single') {
                  return (
                    <button
                      key={opt.text}
                      type="button"
                      onClick={() => toggleOption(q.id, opt.text, 'single')}
                      className={`flex-1 rounded-lg border-2 py-3 px-4 text-sm font-medium transition-colors ${
                        isSelected ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      {opt.text}
                    </button>
                  )
                }
                return (
                  <label key={opt.text} className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOption(q.id, opt.text, 'multi')}
                      className="rounded border-gray-300 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">{opt.text}</span>
                  </label>
                )
              })}
            </div>
            {fieldErrors[`q_${q.id}`] && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors[`q_${q.id}`]}</p>
            )}
          </div>
        )
      })}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-blue-600 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-60"
      >
        {isSubmitting ? 'Submitting…' : 'Apply Now'}
      </button>

      <p className="text-center text-xs text-gray-400">
        {preferEmail && email.trim()
          ? 'Updates about your application will be sent to your email address.'
          : 'By submitting, you agree to receive SMS messages about your application. Reply STOP to opt out.'}
      </p>
    </form>
  )
}
