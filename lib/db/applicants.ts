import { adminDb } from '@/lib/supabase/admin'

export type TalentPoolTag =
  | 'future_opening'
  | 'passed_no_schedule'
  | 'didnt_engage'
  | 'reconsidered'

export interface Applicant {
  id: string
  phone: string
  email: string | null
  name: string
  smsOptedOut: boolean
  createdAt: string
}

// Fix 16: SELECT by email first to catch same person with a new phone number,
// then upsert by phone so the unique constraint handles the common case atomically.
export async function upsertApplicant({
  phone,
  email,
  name,
}: {
  phone: string
  email?: string
  name: string
}): Promise<Applicant> {
  const now = new Date().toISOString()

  if (email) {
    const { data: byEmail } = await adminDb
      .from('applicants')
      .select('*')
      .eq('email', email)
      .maybeSingle()

    if (byEmail && byEmail.phone !== phone) {
      const { data: updated } = await adminDb
        .from('applicants')
        .update({ phone, name, updated_at: now })
        .eq('id', byEmail.id)
        .select()
        .single()
      return mapApplicant(updated!)
    }
  }

  const { data, error } = await adminDb
    .from('applicants')
    .upsert({ phone, email: email || null, name, updated_at: now }, { onConflict: 'phone' })
    .select()
    .single()

  if (error) throw new Error(`upsertApplicant failed: ${error.message}`)
  return mapApplicant(data!)
}

export async function getApplicant(id: string): Promise<Applicant | null> {
  const { data } = await adminDb.from('applicants').select('*').eq('id', id).maybeSingle()
  return data ? mapApplicant(data) : null
}

// Fix 15: correct Supabase upsert API with onConflict + ignoreDuplicates
export async function addToTalentPool(
  applicantId: string,
  locationId: string,
  tag: TalentPoolTag
) {
  await adminDb
    .from('talent_pool')
    .upsert(
      { applicant_id: applicantId, location_id: locationId, tag, added_at: new Date().toISOString() },
      { onConflict: 'applicant_id,location_id', ignoreDuplicates: true }
    )
}

export async function removeFromTalentPool(applicantId: string, locationId: string) {
  await adminDb
    .from('talent_pool')
    .delete()
    .eq('applicant_id', applicantId)
    .eq('location_id', locationId)
}

function mapApplicant(row: Record<string, unknown>): Applicant {
  return {
    id: row.id as string,
    phone: row.phone as string,
    email: (row.email as string | null) ?? null,
    name: row.name as string,
    smsOptedOut: (row.sms_opted_out as boolean) ?? false,
    createdAt: row.created_at as string,
  }
}
