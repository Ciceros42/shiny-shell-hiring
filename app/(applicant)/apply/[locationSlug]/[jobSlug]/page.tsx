import { ApplicationForm } from '@/components/applicant/ApplicationForm'
import { getLocationBySlug } from '@/lib/db/locations'
import { getJobBySlug } from '@/lib/db/jobs'

interface Props {
  params: Promise<{ locationSlug: string; jobSlug: string }>
}

export default async function ApplyJobPage({ params }: Props) {
  const { locationSlug, jobSlug } = await params

  let jobTitle = ''
  let jobDescription: string | null = null

  try {
    const location = await getLocationBySlug(locationSlug)
    const job = await getJobBySlug(location.companyId, jobSlug)
    jobTitle = job.title
    jobDescription = job.description
  } catch {
    // Let the API handle errors gracefully
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">
          {jobTitle ? `Apply — ${jobTitle}` : 'Apply for a position'}
        </h2>
        {jobDescription ? (
          <p className="mt-1 text-gray-600">{jobDescription}</p>
        ) : (
          <p className="mt-1 text-gray-600">
            Takes 2 minutes. We&apos;ll text you a link to complete a quick 3-minute phone screening.
          </p>
        )}
      </div>

      <ApplicationForm locationSlug={locationSlug} jobSlug={jobSlug} />
    </div>
  )
}
