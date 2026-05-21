'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { SlotPicker } from '@/components/applicant/SlotPicker'
import type { SlotDisplay } from '@/lib/scheduling/slots'

type PageState = 'loading' | 'ready' | 'booking' | 'expired' | 'no-slots' | 'already-booked' | 'error'

export default function SchedulePage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [state, setState] = useState<PageState>('loading')
  const [slots, setSlots] = useState<SlotDisplay[]>([])
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    loadSlots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  async function loadSlots() {
    try {
      const res = await fetch(`/api/schedule/${token}/slots`)
      const data = await res.json()

      if (res.status === 410 || data.error === 'expired') { setState('expired'); return }
      if (res.status === 409 || data.error === 'already-booked') { setState('already-booked'); return }
      if (!res.ok) { setErrorMsg(data.error ?? 'Failed to load available times.'); setState('error'); return }

      if (!data.slots || data.slots.length === 0) { setState('no-slots'); return }

      setSlots(data.slots)
      setState('ready')
    } catch {
      setErrorMsg('Network error. Please try again.')
      setState('error')
    }
  }

  async function handleBook() {
    if (!selectedSlotId) return
    setState('booking')

    try {
      const res = await fetch(`/api/schedule/${token}/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slotId: selectedSlotId }),
      })
      const data = await res.json()

      if (!res.ok) {
        if (res.status === 409 && data.error?.includes('just taken')) {
          // Reload slots so the taken one disappears
          setSelectedSlotId(null)
          await loadSlots()
          setErrorMsg('That slot was just taken — please pick another time.')
          return
        }
        setErrorMsg(data.error ?? 'Booking failed. Please try again.')
        setState('ready')
        return
      }

      router.push(`/schedule/${token}/confirmed`)
    } catch {
      setErrorMsg('Network error. Please try again.')
      setState('ready')
    }
  }

  if (state === 'loading') {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
        <p className="text-gray-500">Loading available times…</p>
      </div>
    )
  }

  if (state === 'expired') {
    return (
      <div className="py-12 text-center">
        <p className="text-2xl font-bold text-gray-900">This link has expired</p>
        <p className="mt-2 text-gray-500">Scheduling links are valid for 72 hours.</p>
      </div>
    )
  }

  if (state === 'already-booked') {
    return (
      <div className="py-12 text-center">
        <p className="text-2xl font-bold text-gray-900">Already scheduled!</p>
        <p className="mt-2 text-gray-500">Check your texts for your interview details.</p>
      </div>
    )
  }

  if (state === 'no-slots') {
    return (
      <div className="py-12 text-center">
        <p className="text-2xl font-bold text-gray-900">We&apos;re fully booked</p>
        <p className="mt-3 max-w-xs mx-auto text-gray-500">
          No interview slots are available in the next 7 days. We&apos;ll reach out when one opens up.
        </p>
      </div>
    )
  }

  if (state === 'error' && !slots.length) {
    return (
      <div className="py-12 text-center">
        <p className="text-xl font-bold text-gray-900">Something went wrong</p>
        <p className="mt-2 text-gray-500">{errorMsg}</p>
        <button onClick={loadSlots} className="mt-4 rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white">
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Pick your interview time</h2>
        <p className="mt-1 text-gray-500">Choose any available slot — interviews take about 20 minutes.</p>
      </div>

      {errorMsg && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          {errorMsg}
        </div>
      )}

      <SlotPicker
        slots={slots}
        selectedId={selectedSlotId}
        onSelect={setSelectedSlotId}
        disabled={state === 'booking'}
      />

      <button
        onClick={handleBook}
        disabled={!selectedSlotId || state === 'booking'}
        className="w-full rounded-lg bg-blue-600 px-6 py-4 text-base font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {state === 'booking' ? 'Confirming…' : 'Confirm this time'}
      </button>
    </div>
  )
}
