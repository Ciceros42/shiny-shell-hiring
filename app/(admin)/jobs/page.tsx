import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import JobsClient from '@/components/admin/jobs/JobsClient'

export const revalidate = 0

export default async function JobsPage() {
  const { profile, error } = await requireAdmin()
  if (error) redirect('/login')
  const { companyId } = profile

  const { data: companyRow } = await adminDb
    .from('companies')
    .select('slug')
    .eq('id', companyId)
    .maybeSingle()
  const companySlug = companyRow?.slug ?? ''

  type JobRow = {
    id: string
    title: string
    slug: string
    description: string | null
    question_set_id: string | null
    application_form_id: string | null
    is_active: boolean
    created_at: string
  }

  type SetRow = {
    id: string
    job_title: string
  }

  type FormRow = {
    id: string
    name: string
  }

  type LocationRow = {
    id: string
    name: string
  }

  let jobs: JobRow[] = []
  let questionSets: SetRow[] = []
  let applicationForms: FormRow[] = []
  let locationOptions: LocationRow[] = []
  let jobLocationMap: Record<string, string[]> = {}

  if (companyId) {
    const [jobsRes, setsRes, formsRes, locsRes] = await Promise.all([
      adminDb
        .from('jobs')
        .select('id, title, slug, description, question_set_id, application_form_id, is_active, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true }),
      adminDb
        .from('question_sets')
        .select('id, job_title')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true }),
      adminDb
        .from('application_forms')
        .select('id, name')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true }),
      adminDb
        .from('locations')
        .select('id, name')
        .eq('company_id', companyId)
        .order('name', { ascending: true }),
    ])
    jobs = (jobsRes.data ?? []) as JobRow[]
    questionSets = (setsRes.data ?? []) as SetRow[]
    applicationForms = (formsRes.data ?? []) as FormRow[]
    locationOptions = (locsRes.data ?? []) as LocationRow[]

    // Fetch job-location assignments for all jobs at once
    if (jobs.length > 0) {
      const jobIds = jobs.map((j) => j.id)
      const { data: jlRows } = await adminDb
        .from('job_locations')
        .select('job_id, location_id')
        .in('job_id', jobIds)
      for (const row of jlRows ?? []) {
        if (!jobLocationMap[row.job_id]) jobLocationMap[row.job_id] = []
        jobLocationMap[row.job_id].push(row.location_id)
      }
    }
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Jobs</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Each job has its own apply URL and question set. Applicants pick a position before applying.
          </p>
        </div>
      </div>

      <JobsClient
        jobs={jobs}
        questionSets={questionSets}
        applicationForms={applicationForms}
        locationOptions={locationOptions}
        jobLocationMap={jobLocationMap}
        companySlug={companySlug}
      />
    </div>
  )
}
