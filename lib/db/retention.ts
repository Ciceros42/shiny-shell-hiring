import { adminDb } from '@/lib/supabase/admin'

export async function recordRetentionResponse(
  applicationId: string,
  isRetained: boolean
): Promise<void> {
  // Update the most recent pending checkin for this application
  const { data: checkin } = await adminDb
    .from('retention_checkins')
    .select('id')
    .eq('application_id', applicationId)
    .not('sent_at', 'is', null)
    .is('responded_at', null)
    .order('scheduled_for', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!checkin) return

  await adminDb
    .from('retention_checkins')
    .update({
      is_retained: isRetained,
      responded_at: new Date().toISOString(),
    })
    .eq('id', checkin.id)
}

export async function createRetentionCheckins(applicationId: string): Promise<void> {
  const now = new Date()
  const rows = [30, 60, 90].map((days) => {
    const scheduledFor = new Date(now)
    scheduledFor.setDate(scheduledFor.getDate() + days)
    return {
      application_id: applicationId,
      period_days: days,
      scheduled_for: scheduledFor.toISOString().split('T')[0],
    }
  })

  await adminDb
    .from('retention_checkins')
    .upsert(rows, { onConflict: 'application_id,period_days', ignoreDuplicates: true })
}
