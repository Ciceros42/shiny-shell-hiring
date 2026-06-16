import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { createRetentionCheckins } from '@/lib/db/retention'
import { sendSMS } from '@/lib/twilio/sms'
import { SMS } from '@/lib/twilio/messages'
import { getCompanyConfig } from '@/lib/db/companies'

type RouteContext = { params: Promise<{ appId: string }> }

export async function POST(_req: Request, { params }: RouteContext) {
  const { error, profile } = await requireAdmin()
  if (error) return error

  const { appId } = await params

  const { data: app } = await adminDb
    .from('applications')
    .select('id, status, applicants(phone, name, sms_opted_out), locations(timezone)')
    .eq('id', appId)
    .eq('company_id', profile.companyId)
    .maybeSingle()

  if (!app) return NextResponse.json({ error: 'Application not found' }, { status: 404 })
  if (app.status === 'hired') return NextResponse.json({ ok: true, alreadyHired: true })

  const { error: updateError } = await adminDb
    .from('applications')
    .update({ status: 'hired' })
    .eq('id', appId)

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  await createRetentionCheckins(appId)

  // Copy onboarding template items for this company
  const { data: templates } = await adminDb
    .from('onboarding_templates')
    .select('text, order_index')
    .eq('company_id', profile.companyId)
    .order('order_index', { ascending: true })
  if (templates && templates.length > 0) {
    await adminDb.from('onboarding_items').insert(
      templates.map((t) => ({ application_id: appId, text: t.text, order_index: t.order_index }))
    )
  }

  try {
    const applicant = app.applicants as unknown as { phone: string; name: string; sms_opted_out: boolean } | null
    const location = app.locations as unknown as { timezone: string } | null
    if (applicant && !applicant.sms_opted_out && location) {
      const { displayName: companyName } = await getCompanyConfig(profile.companyId)
      await sendSMS(
        applicant.phone,
        SMS.hired(applicant.name, companyName),
        appId,
        'hired',
        location.timezone,
        { bypassQuietHours: true }
      )
    }
  } catch {}

  return NextResponse.json({ ok: true })
}
