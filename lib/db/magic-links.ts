import { adminDb } from '@/lib/supabase/admin'

export type MagicLinkType = 'screen' | 'schedule'

export interface MagicLink {
  id: string
  type: MagicLinkType
  applicationId: string
  token: string
  expiresAt: string | null
  clickedAt: string | null
  completedAt: string | null
  usedAt: string | null
  earliestBookable: string | null
  isReschedule: boolean
  replacesInterviewId: string | null
}

export async function createMagicLink({
  type,
  applicationId,
  token,
  expiresAt,
  earliestBookable,
  isReschedule = false,
  replacesInterviewId,
}: {
  type: MagicLinkType
  applicationId: string
  token: string
  expiresAt?: Date
  earliestBookable?: Date
  isReschedule?: boolean
  replacesInterviewId?: string
}): Promise<MagicLink> {
  const { data, error } = await adminDb
    .from('magic_links')
    .insert({
      type,
      application_id: applicationId,
      token,
      expires_at: expiresAt?.toISOString() ?? null,
      earliest_bookable: earliestBookable?.toISOString() ?? null,
      is_reschedule: isReschedule,
      replaces_interview_id: replacesInterviewId ?? null,
    })
    .select()
    .single()

  if (error) throw new Error(`createMagicLink failed: ${error.message}`)
  return mapMagicLink(data!)
}

export async function getMagicLink(token: string): Promise<MagicLink | null> {
  const { data } = await adminDb
    .from('magic_links')
    .select('*')
    .eq('token', token)
    .maybeSingle()
  return data ? mapMagicLink(data) : null
}

export async function markMagicLinkClicked(id: string) {
  await adminDb
    .from('magic_links')
    .update({ clicked_at: new Date().toISOString() })
    .eq('id', id)
    .is('clicked_at', null)
}

export async function markMagicLinkCompleted(id: string) {
  await adminDb
    .from('magic_links')
    .update({ completed_at: new Date().toISOString() })
    .eq('id', id)
}

export async function createRescheduleMagicLink({
  applicationId,
  token,
  expiresAt,
  replacesInterviewId,
}: {
  applicationId: string
  token: string
  expiresAt: Date
  replacesInterviewId: string
}): Promise<MagicLink> {
  return createMagicLink({
    type: 'schedule',
    applicationId,
    token,
    expiresAt,
    isReschedule: true,
    replacesInterviewId,
  })
}

export async function markMagicLinkUsed(id: string) {
  await adminDb
    .from('magic_links')
    .update({ used_at: new Date().toISOString() })
    .eq('id', id)
}

function mapMagicLink(row: Record<string, unknown>): MagicLink {
  return {
    id: row.id as string,
    type: row.type as MagicLinkType,
    applicationId: row.application_id as string,
    token: row.token as string,
    expiresAt: (row.expires_at as string | null) ?? null,
    clickedAt: (row.clicked_at as string | null) ?? null,
    completedAt: (row.completed_at as string | null) ?? null,
    usedAt: (row.used_at as string | null) ?? null,
    earliestBookable: (row.earliest_bookable as string | null) ?? null,
    isReschedule: (row.is_reschedule as boolean) ?? false,
    replacesInterviewId: (row.replaces_interview_id as string | null) ?? null,
  }
}
