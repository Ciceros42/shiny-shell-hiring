import { ApplicationForm } from '@/components/applicant/ApplicationForm'
import { getLocationBySlug } from '@/lib/db/locations'

interface Props {
  params: Promise<{ locationSlug: string }>
}

export default async function ApplyPage({ params }: Props) {
  const { locationSlug } = await params

  let isHiring = true
  let locationName = ''
  try {
    const location = await getLocationBySlug(locationSlug)
    isHiring = location.isHiring
    locationName = location.name
  } catch {
    // Location not found — let the API handle it gracefully
  }

  if (!isHiring) {
    return (
      <div className="space-y-4 text-center py-8">
        <p className="text-4xl">🚗</p>
        <h2 className="text-xl font-bold text-gray-900">Not currently hiring</h2>
        <p className="text-gray-600">
          {locationName || 'This location'} is not accepting applications right now.
          Check back soon!
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Apply for a position</h2>
        <p className="mt-1 text-gray-600">
          Takes 2 minutes. We&apos;ll text you a link to complete a quick 3-minute phone screening.
        </p>
      </div>

      <ApplicationForm locationSlug={locationSlug} />
    </div>
  )
}
