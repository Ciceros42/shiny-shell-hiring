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

export async function getLocationBySlug(slug: string): Promise<Location> {
  const { data, error } = await adminDb
    .from('locations')
    .select('id, company_id, name, slug, timezone, is_hiring, active_question_set_id, slot_shortage_sms_sent_at')
    .eq('slug', slug)
    .single()

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
