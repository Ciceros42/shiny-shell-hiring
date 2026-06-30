'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { AppFormQuestion } from '@/lib/db/application-forms'

interface Props {
  companySlug: string
  locationSlug: string
  jobSlug: string
  formQuestions?: AppFormQuestion[]
  source?: string
}

const inputClass =
  'w-full rounded-xl border border-gray-200 px-4 text-[15px] text-gray-900 placeholder:text-gray-400 focus:border-[var(--brand-primary)] focus:outline-none focus:ring-2 focus:ring-[color-mix(in_srgb,var(--brand-primary)_25%,transparent)] transition-colors'

const DAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
const DAY_LABELS: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' }
const SHIFTS = ['morning', 'afternoon', 'evening'] as const
const SHIFT_LABELS: Record<string, string> = { morning: 'AM', afternoon: 'PM', evening: 'Eve' }

type Day = typeof DAYS[number]
type Shift = typeof SHIFTS[number]
type Availability = Partial<Record<Day, Shift[]>>

export function ApplicationForm({ companySlug, locationSlug, jobSlug, formQuestions = [], source }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [preferEmail, setPreferEmail] = useState(false)
  const [website, setWebsite] = useState('')
  const [responses, setResponses] = useState<Record<string, string[]>>({})
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [availability, setAvailability] = useState<Availability>({})

  function toggleSlot(day: Day, shift: Shift) {
    setAvailability(prev => {
      const current = prev[day] ?? []
      const next = current.includes(shift) ? current.filter(s => s !== shift) : [...current, shift]
      return next.length === 0 ? { ...prev, [day]: [] } : { ...prev, [day]: next }
    })
  }

  function toggleOption(questionId: string, optionText: string, type: 'single' | 'multi') {
    setResponses((prev) => {
      if (type === 'single') return { ...prev, [questionId]: [optionText] }
      const current = prev[questionId] ?? []
      const next = current.includes(optionText)
        ? current.filter((o) => o !== optionText)
        : [...current, optionText]
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
          source: source ?? undefined,
          availability: Object.keys(availability).length > 0 ? availability : undefined,
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
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Honeypot */}
      <input
        type="text"
        name="website"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-[13px] font-semibold text-gray-700 mb-1.5">
          Full name <span className="text-red-400">*</span>
        </label>
        <input
          id="name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="name"
          className={inputClass}
          style={{ height: '48px' }}
          placeholder="Jane Smith"
        />
        {fieldErrors.name && <p className="mt-1 text-[12px] text-red-500">{fieldErrors.name}</p>}
      </div>

      {/* Phone */}
      <div>
        <label htmlFor="phone" className="block text-[13px] font-semibold text-gray-700 mb-1.5">
          Mobile phone <span className="text-red-400">*</span>
        </label>
        <input
          id="phone"
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          autoComplete="tel"
          className={inputClass}
          style={{ height: '48px' }}
          placeholder="(555) 123-4567"
        />
        {fieldErrors.phone && <p className="mt-1 text-[12px] text-red-500">{fieldErrors.phone}</p>}
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-[13px] font-semibold text-gray-700 mb-1.5">
          Email{' '}
          <span className="font-normal text-gray-400">(optional)</span>
        </label>
        <input
          id="email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className={inputClass}
          style={{ height: '48px' }}
          placeholder="jane@example.com"
        />
      </div>

      {/* Contact preference */}
      {email.trim() && (
        <div>
          <p className="text-[13px] font-semibold text-gray-700 mb-2">
            Preferred contact method
          </p>
          <div className="flex gap-3">
            {[
              { value: false, label: 'Text (SMS)' },
              { value: true,  label: 'Email' },
            ].map(({ value, label }) => (
              <button
                key={label}
                type="button"
                onClick={() => setPreferEmail(value)}
                className="flex-1 rounded-xl border-2 py-3 text-[14px] font-semibold transition-all duration-150"
                style={
                  preferEmail === value
                    ? {
                        backgroundColor: 'var(--brand-primary)',
                        borderColor: 'var(--brand-primary)',
                        color: 'var(--brand-primary-fg)',
                      }
                    : {
                        backgroundColor: '#ffffff',
                        borderColor: '#E5E7EB',
                        color: '#374151',
                      }
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Availability grid */}
      <div>
        <p className="text-[13px] font-semibold text-gray-700 mb-2">
          When are you available to work?{' '}
          <span className="font-normal text-gray-400">(select all that apply)</span>
        </p>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          {/* Header row */}
          <div className="grid grid-cols-[56px_1fr_1fr_1fr] bg-gray-50 border-b border-gray-200">
            <div />
            {SHIFTS.map(shift => (
              <div key={shift} className="py-1.5 text-center text-[11px] font-semibold text-gray-500 uppercase tracking-wide">
                {SHIFT_LABELS[shift]}
              </div>
            ))}
          </div>
          {/* Day rows */}
          {DAYS.map((day, i) => {
            const dayShifts = availability[day] ?? []
            return (
              <div
                key={day}
                className={`grid grid-cols-[56px_1fr_1fr_1fr] ${i < DAYS.length - 1 ? 'border-b border-gray-100' : ''}`}
              >
                <div className="flex items-center justify-center text-[12px] font-semibold text-gray-500 py-2">
                  {DAY_LABELS[day]}
                </div>
                {SHIFTS.map(shift => {
                  const active = dayShifts.includes(shift)
                  return (
                    <button
                      key={shift}
                      type="button"
                      onClick={() => toggleSlot(day, shift)}
                      className="m-1 rounded-lg py-2 text-[12px] font-semibold transition-all duration-100 border"
                      style={active ? {
                        backgroundColor: 'var(--brand-primary)',
                        borderColor: 'var(--brand-primary)',
                        color: 'var(--brand-primary-fg)',
                      } : {
                        backgroundColor: '#F9FAFB',
                        borderColor: '#E5E7EB',
                        color: '#6B7280',
                      }}
                    >
                      {active ? '✓' : ''}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Custom questions */}
      {formQuestions.map((q) => {
        const selected = responses[q.id] ?? []
        return (
          <div key={q.id}>
            <p className="text-[13px] font-semibold text-gray-700 mb-2">
              {q.questionText}{' '}
              {q.isRequired && <span className="text-red-400">*</span>}
            </p>
            {q.questionType === 'single' ? (
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const isSelected = selected.includes(opt.text)
                  return (
                    <button
                      key={opt.text}
                      type="button"
                      onClick={() => toggleOption(q.id, opt.text, 'single')}
                      className="rounded-xl border-2 px-4 py-2.5 text-[14px] font-semibold transition-all duration-150"
                      style={
                        isSelected
                          ? {
                              backgroundColor: 'var(--brand-primary)',
                              borderColor: 'var(--brand-primary)',
                              color: 'var(--brand-primary-fg)',
                            }
                          : {
                              backgroundColor: '#ffffff',
                              borderColor: '#E5E7EB',
                              color: '#374151',
                            }
                      }
                    >
                      {opt.text}
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {q.options.map((opt) => {
                  const isSelected = selected.includes(opt.text)
                  return (
                    <button
                      key={opt.text}
                      type="button"
                      onClick={() => toggleOption(q.id, opt.text, 'multi')}
                      className="rounded-xl border-2 px-4 py-2.5 text-[14px] font-semibold transition-all duration-150"
                      style={
                        isSelected
                          ? {
                              backgroundColor: 'var(--brand-primary)',
                              borderColor: 'var(--brand-primary)',
                              color: 'var(--brand-primary-fg)',
                            }
                          : {
                              backgroundColor: '#ffffff',
                              borderColor: '#E5E7EB',
                              color: '#374151',
                            }
                      }
                    >
                      {isSelected && <span className="mr-1.5">✓</span>}
                      {opt.text}
                    </button>
                  )
                })}
              </div>
            )}
            {fieldErrors[`q_${q.id}`] && (
              <p className="mt-1 text-[12px] text-red-500">{fieldErrors[`q_${q.id}`]}</p>
            )}
          </div>
        )
      })}

      {/* Error */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-600">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-xl text-[15px] font-bold transition-all duration-150 disabled:opacity-60 hover:brightness-95 active:scale-[0.99]"
        style={{
          height: '52px',
          backgroundColor: 'var(--brand-primary)',
          color: 'var(--brand-primary-fg)',
        }}
      >
        {isSubmitting ? 'Submitting…' : 'Apply Now'}
      </button>

      {/* Disclaimer */}
      <p className="text-center text-[11px] leading-relaxed" style={{ color: '#9CA3AF' }}>
        {preferEmail && email.trim()
          ? 'Updates about your application will be sent to your email address.'
          : 'By submitting, you agree to receive SMS messages about your application. Reply STOP to opt out.'}
      </p>
    </form>
  )
}
