import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getLocationBySlug } from '@/lib/db/locations'
import { getActiveJobsForCompany } from '@/lib/db/jobs'

interface Props {
  params: Promise<{ locationSlug: string }>
}

export default async function ApplyPage({ params }: Props) {
  const { locationSlug } = await params

  let location = null
  try {
    location = await getLocationBySlug(locationSlug)
  } catch {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-bold text-gray-900">Location not found</h2>
      </div>
    )
  }

  if (!location.isHiring) {
    return (
      <div className="space-y-4 text-center py-8">
        <p className="text-4xl">🚗</p>
        <h2 className="text-xl font-bold text-gray-900">Not currently hiring</h2>
        <p className="text-gray-600">
          {location.name} is not accepting applications right now. Check back soon!
        </p>
      </div>
    )
  }

  const jobs = await getActiveJobsForCompany(location.companyId)

  if (jobs.length === 0) {
    return (
      <div className="space-y-4 text-center py-8">
        <h2 className="text-xl font-bold text-gray-900">No open positions</h2>
        <p className="text-gray-600">
          No positions are currently open. Check back soon!
        </p>
      </div>
    )
  }

  // Only one job — skip the picker
  if (jobs.length === 1) {
    redirect(`/apply/${locationSlug}/${jobs[0].slug}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Open positions</h2>
        <p className="mt-1 text-gray-600">Select a position to apply for.</p>
      </div>

      <div className="space-y-3">
        {jobs.map((job) => (
          <Link
            key={job.id}
            href={`/apply/${locationSlug}/${job.slug}`}
            className="flex items-center justify-between rounded-lg border border-gray-200 p-5 hover:border-gray-400 hover:bg-gray-50 transition-colors"
          >
            <div>
              <p className="font-semibold text-gray-900">{job.title}</p>
              {job.description && (
                <p className="mt-0.5 text-sm text-gray-500">{job.description}</p>
              )}
            </div>
            <span className="text-gray-400 ml-4 text-lg">→</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
