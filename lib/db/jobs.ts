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
