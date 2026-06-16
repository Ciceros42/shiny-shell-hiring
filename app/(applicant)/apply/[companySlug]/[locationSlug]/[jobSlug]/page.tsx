import { ApplicationForm } from '@/components/applicant/ApplicationForm'
import { getLocationBySlug } from '@/lib/db/locations'
import { getJobBySlug } from '@/lib/db/jobs'
import { getApplicationFormForJob } from '@/lib/db/application-forms'
import type { AppFormQuestion } from '@/lib/db/application-forms'

interface Props {
  params: Promise<{ companySlug: string; locationSlug: string; jobSlug: string }>
  searchParams: Promise<{ src?: string }>
}

export default async function ApplyJobPage({ params, searchParams }: Props) {
  const { companySlug, locationSlug, jobSlug } = await params
  const { src } = await searchParams

  let jobTitle = ''
  let jobDescription: string | null = null
  let formQuestions: AppFormQuestion[] = []

  try {
    const location = await getLocationBySlug(locationSlug, companySlug)
    const job = await getJobBySlug(location.companyId, jobSlug)
    jobTitle = job.title
    jobDescription = job.description
    const appForm = await getApplicationFormForJob(job.id)
    formQuestions = appForm?.questions ?? []
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

      <ApplicationForm
        companySlug={companySlug}
        locationSlug={locationSlug}
        jobSlug={jobSlug}
        formQuestions={formQuestions}
        source={src}
      />
    </div>
  )
}
