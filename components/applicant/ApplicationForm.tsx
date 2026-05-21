'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AvailabilityPicker } from './AvailabilityPicker'

interface Props {
  locationSlug: string
}

export function ApplicationForm({ locationSlug }: Props) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [hasTransportation, setHasTransportation] = useState<boolean | null>(null)
  const [availability, setAvailability] = useState({ days: [] as string[], shifts: [] as string[] })
  const [website, setWebsite] = useState('') // honeypot

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  function validate() {
    const errs: Record<string, string> = {}
    if (!name.trim()) errs.name = 'Name is required'
    if (!phone.trim()) errs.phone = 'Phone number is required'
    if (hasTransportation === null) errs.transportation = 'Please answer the transportation question'
    if (availability.days.length === 0) errs.days = 'Please select at least one day'
    if (availability.shifts.length === 0) errs.shifts = 'Please select at least one shift'
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
          locationSlug,
          availability,
          hasTransportation: hasTransportation!,
          website,
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

      router.push(`/apply/${locationSlug}/submitted`)
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

      <div>
        <p className="mb-2 text-sm font-medium text-gray-700">
          Do you have reliable transportation? *
        </p>
        <div className="flex gap-4">
          {[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ].map(({ value, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => setHasTransportation(value)}
              className={`flex-1 rounded-lg border-2 py-3 text-sm font-medium transition-colors ${
                hasTransportation === value
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-700 hover:border-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {fieldErrors.transportation && (
          <p className="mt-1 text-sm text-red-600">{fieldErrors.transportation}</p>
        )}
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-gray-700">Availability *</p>
        <AvailabilityPicker
          value={availability}
          onChange={setAvailability}
          error={fieldErrors.days || fieldErrors.shifts}
        />
      </div>

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
        By submitting, you agree to receive SMS messages about your application. Reply STOP to opt out.
      </p>
    </form>
  )
}
