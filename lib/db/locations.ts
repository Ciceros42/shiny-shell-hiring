import { adminDb } from '@/lib/supabase/admin'

export interface Location {
  id: string
  companyId: string
  name: string
  slug: string
  timezone: string
  isHiring: boolean
  activeQuestionSetId: string | null
  slotShortageSmsAt: string | null
}

export async function getLocationById(id: string): Promise<Location> {
  const { data, error } = await adminDb
    .from('locations')
    .select('id, company_id, name, slug, timezone, is_hiring, active_question_set_id, slot_shortage_sms_sent_at')
    .eq('id', id)
    .single()

  if (error || !data) throw new Error(`Location not found: ${id}`)

  return {
    id: data.id,
    companyId: data.company_id,
    name: data.name,
    slug: data.slug,
    timezone: data.timezone,
    isHiring: data.is_hiring,
    activeQuestionSetId: data.active_question_set_id,
    slotShortageSmsAt: data.slot_shortage_sms_sent_at,
  }
}

export async function getLocationBySlug(slug: string, companySlug?: string): Promise<Location> {
  let query = adminDb
    .from('locations')
    .select('id, company_id, name, slug, timezone, is_hiring, active_question_set_id, slot_shortage_sms_sent_at, companies!inner(slug)')
    .eq('slug', slug)

  if (companySlug) {
    query = query.eq('companies.slug', companySlug) as typeof query
  }

  const { data, error } = await query.single()

  if (error || !data) throw new Error(`Location not found: ${slug}`)

  return {
    id: data.id,
    companyId: data.company_id,
    name: data.name,
    slug: data.slug,
    timezone: data.timezone,
    isHiring: data.is_hiring,
    activeQuestionSetId: data.active_question_set_id,
    slotShortageSmsAt: data.slot_shortage_sms_sent_at,
  }
}

export async function createLocation(companyId: string, name: string, timezone: string): Promise<string> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const { data, error } = await adminDb
    .from('locations')
    .insert({ company_id: companyId, name, slug, timezone, is_hiring: false })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create location')
  return data.id
}

export async function updateLocation(
  id: string,
  companyId: string,
  fields: { name?: string; timezone?: string; isHiring?: boolean }
): Promise<void> {
  const update: Record<string, unknown> = {}
  if (fields.name !== undefined) update.name = fields.name
  if (fields.timezone !== undefined) update.timezone = fields.timezone
  if (fields.isHiring !== undefined) update.is_hiring = fields.isHiring
  if (Object.keys(update).length === 0) return
  const { error } = await adminDb
    .from('locations')
    .update(update)
    .eq('id', id)
    .eq('company_id', companyId)
  if (error) throw new Error(error.message)
}

export async function listLocations(companyId?: string): Promise<{ id: string; companyId: string; name: string; slug: string; timezone: string; isHiring: boolean }[]> {
  let query = adminDb.from('locations').select('id, company_id, name, slug, timezone, is_hiring').order('name', { ascending: true })
  if (companyId) query = query.eq('company_id', companyId)
  const { data } = await query
  return (data ?? []).map((row) => ({
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    slug: row.slug,
    timezone: row.timezone,
    isHiring: row.is_hiring,
  }))
}
