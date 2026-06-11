import { adminDb } from '@/lib/supabase/admin'

export interface Job {
  id: string
  companyId: string
  title: string
  slug: string
  description: string | null
  questionSetId: string | null
  isActive: boolean
  createdAt: string
}

function mapJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    companyId: row.company_id as string,
    title: row.title as string,
    slug: row.slug as string,
    description: row.description as string | null,
    questionSetId: row.question_set_id as string | null,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
  }
}

export async function getActiveJobsForCompany(companyId: string): Promise<Job[]> {
  const { data } = await adminDb
    .from('jobs')
    .select('id, company_id, title, slug, description, question_set_id, is_active, created_at')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  return (data ?? []).map((r) => mapJob(r as Record<string, unknown>))
}

// Returns active jobs visible at a specific location.
// Jobs with no location assignments are shown everywhere;
// jobs with assignments are only shown at those locations.
export async function getActiveJobsForLocation(locationId: string, companyId: string): Promise<Job[]> {
  const { data } = await adminDb
    .from('jobs')
    .select('id, company_id, title, slug, description, question_set_id, is_active, created_at, job_locations(location_id)')
    .eq('company_id', companyId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  const rows = (data ?? []) as (Record<string, unknown> & { job_locations: { location_id: string }[] | null })[]
  return rows
    .filter((row) => {
      const assignments = row.job_locations ?? []
      if (assignments.length === 0) return true
      return assignments.some((a) => a.location_id === locationId)
    })
    .map((r) => mapJob(r))
}

export async function getJobBySlug(companyId: string, slug: string): Promise<Job> {
  const { data, error } = await adminDb
    .from('jobs')
    .select('id, company_id, title, slug, description, question_set_id, is_active, created_at')
    .eq('company_id', companyId)
    .eq('slug', slug)
    .single()

  if (error || !data) throw new Error(`Job not found: ${slug}`)
  return mapJob(data as Record<string, unknown>)
}

export async function getAllJobsForCompany(companyId: string): Promise<Job[]> {
  const { data } = await adminDb
    .from('jobs')
    .select('id, company_id, title, slug, description, question_set_id, is_active, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: true })

  return (data ?? []).map((r) => mapJob(r as Record<string, unknown>))
}

export async function getJobLocationIds(jobId: string): Promise<string[]> {
  const { data } = await adminDb
    .from('job_locations')
    .select('location_id')
    .eq('job_id', jobId)
  return (data ?? []).map((r) => r.location_id)
}

export async function setJobLocations(jobId: string, locationIds: string[]): Promise<void> {
  await adminDb.from('job_locations').delete().eq('job_id', jobId)
  if (locationIds.length > 0) {
    await adminDb.from('job_locations').insert(locationIds.map((location_id) => ({ job_id: jobId, location_id })))
  }
}
