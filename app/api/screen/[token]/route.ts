import { NextResponse } from 'next/server'
import { getMagicLink, markMagicLinkClicked } from '@/lib/db/magic-links'
import { createScreenCall } from '@/lib/db/screen'
import { updateApplicationStatus } from '@/lib/db/applications'
import { getApplicationWithDetails } from '@/lib/db/applications'
import { checkDailyCallLimit, initiateVapiCall } from '@/lib/vapi/client'
import { buildAssistantOverrides } from '@/lib/vapi/assistant'
import { adminDb } from '@/lib/supabase/admin'

interface Params {
  params: Promise<{ token: string }>
}

export async function POST(_req: Request, { params }: Params) {
  const { token } = await params

  const magicLink = await getMagicLink(token)

  if (!magicLink) {
    return NextResponse.json({ error: 'Link not found' }, { status: 404 })
  }

  if (magicLink.type !== 'screen') {
    return NextResponse.json({ error: 'Invalid link type' }, { status: 400 })
  }

  if (magicLink.expiresAt && new Date(magicLink.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'expired' }, { status: 410 })
  }

  if (magicLink.completedAt) {
    return NextResponse.json({ error: 'already-done' }, { status: 409 })
  }

  // Check daily spend limit before Vapi call
  const withinLimit = await checkDailyCallLimit()
  if (!withinLimit) {
    return NextResponse.json({ error: 'Daily call limit reached. Please try again tomorrow.' }, { status: 429 })
  }

  // Load application + questions
  const appDetails = await getApplicationWithDetails(magicLink.applicationId)

  const questions = (appDetails.question_sets?.questions ?? []).filter(
    (q: { deleted_at?: string | null }) => !q.deleted_at
  )
  const applicantName: string = appDetails.applicants?.name ?? 'there'
  const applicantPhone: string = appDetails.applicants?.phone

  if (!applicantPhone) {
    return NextResponse.json({ error: 'Applicant phone not found' }, { status: 500 })
  }

  const overrides = buildAssistantOverrides(applicantName, questions)

  // Look up company's Vapi assistant ID from DB
  const companyId = (appDetails.locations as { company_id: string } | null)?.company_id
  if (!companyId) {
    return NextResponse.json({ error: 'Company not found for this application' }, { status: 500 })
  }

  const { data: company } = await adminDb
    .from('companies')
    .select('settings')
    .eq('id', companyId)
    .single()

  const assistantId: string | undefined =
    (company?.settings as Record<string, Record<string, unknown>> | null)?.vapi?.assistantId as string | undefined

  if (!assistantId) {
    return NextResponse.json(
      { error: 'No AI assistant configured for this company. Ask your admin to deploy the assistant in Settings.' },
      { status: 503 }
    )
  }

  // Initiate Vapi call — this returns immediately (Vapi dials asynchronously)
  const { vapiCallId } = await initiateVapiCall({
    toPhone: applicantPhone,
    assistantId,
    phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID!,
    assistantOverrides: overrides,
  })

  // Fix 5: screen_link_id is NOT NULL — always pass magicLink.id
  // Feature C: started_at is set inside createScreenCall before Vapi responds
  await createScreenCall({
    applicationId: magicLink.applicationId,
    screenLinkId: magicLink.id,
    vapiCallId,
  })

  await markMagicLinkClicked(magicLink.id)
  await updateApplicationStatus(magicLink.applicationId, 'screen_link_clicked')

  return NextResponse.json({ status: 'calling' })
}
