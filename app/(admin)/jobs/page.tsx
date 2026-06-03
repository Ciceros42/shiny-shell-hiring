import { createClient } from '@/lib/supabase/server'
import { adminDb } from '@/lib/supabase/admin'
import JobsClient from '@/components/admin/jobs/JobsClient'

export const revalidate = 0

export default async function JobsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await adminDb
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  const companyId = profile?.company_id

  type JobRow = {
    id: string
    title: string
    slug: string
    description: string | null
    question_set_id: string | null
    is_active: boolean
    created_at: string
  }

  type SetRow = {
    id: string
    job_title: string
  }

  let jobs: JobRow[] = []
  let questionSets: SetRow[] = []

  if (companyId) {
    const [jobsRes, setsRes] = await Promise.all([
      adminDb
        .from('jobs')
        .select('id, title, slug, description, question_set_id, is_active, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true }),
      adminDb
        .from('question_sets')
        .select('id, job_title')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true }),
    ])
    jobs = (jobsRes.data ?? []) as JobRow[]
    questionSets = (setsRes.data ?? []) as SetRow[]
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

      <JobsClient jobs={jobs} questionSets={questionSets} />
    </div>
  )
}
