import { adminDb } from '@/lib/supabase/admin'

export type ApplicationStatus =
  | 'applied'
  | 'sms_sent'
  | 'screen_link_clicked'
  | 'screening'
  | 'screen_complete'
  | 'passed'
  | 'failed'
  | 'scheduled'
  | 'interviewed'
  | 'hired'
  | 'no_show'
  | 'rejected'

export interface Application {
  id: string
  applicantId: string
  companyId: string
  locationId: string
  jobId: string | null
  questionSetId: string
  status: ApplicationStatus
  source: string
  createdAt: string
}

export async function createApplication({
  applicantId,
  companyId,
  locationId,
  jobId,
  questionSetId,
  status,
  source,
}: {
  applicantId: string
  companyId: string
  locationId: string
  jobId: string | null
  questionSetId: string
  status: ApplicationStatus
  source: string
}): Promise<Application> {
  const { data, error } = await adminDb
    .from('applications')
    .insert({
      applicant_id: applicantId,
      company_id: companyId,
      location_id: locationId,
      job_id: jobId,
      question_set_id: questionSetId,
      status,
      source,
    })
    .select()
    .single()

  if (error) throw new Error(`createApplication failed: ${error.message}`)
  return mapApplication(data!)
}

export async function getApplicationById(id: string): Promise<Application> {
  const { data, error } = await adminDb
    .from('applications')
    .select('*')
    .eq('id', id)
    .single()
  if (error || !data) throw new Error(`getApplicationById failed for ${id}`)
  return mapApplication(data)
}

export async function updateApplicationStatus(id: string, status: ApplicationStatus) {
  const { error } = await adminDb.from('applications').update({ status }).eq('id', id)
  if (error) throw new Error(`updateApplicationStatus failed: ${error.message}`)
}

export async function getApplicationWithDetails(id: string) {
  const { data, error } = await adminDb
    .from('applications')
    .select(`
      *,
      applicants(*),
      locations(id, name, slug, timezone, company_id),
      question_sets(id, pass_threshold, questions(*))
    `)
    .eq('id', id)
    .single()

  if (error || !data) throw new Error(`getApplicationWithDetails failed for ${id}`)
  return data
}

function mapApplication(row: Record<string, unknown>): Application {
  return {
    id: row.id as string,
    applicantId: row.applicant_id as string,
    companyId: row.company_id as string,
    locationId: row.location_id as string,
    jobId: row.job_id as string | null,
    questionSetId: row.question_set_id as string,
    status: row.status as ApplicationStatus,
    source: row.source as string,
    createdAt: row.created_at as string,
  }
}
