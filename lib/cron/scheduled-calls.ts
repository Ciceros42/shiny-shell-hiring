import * as Sentry from '@sentry/nextjs'
import { adminDb } from '@/lib/supabase/admin'
import { initiateVapiCall, checkDailyCallLimit } from '@/lib/vapi/client'
import { buildAssistantOverrides } from '@/lib/vapi/assistant'
import { getQuestionSetWithQuestions } from '@/lib/db/question-sets'

// Feature D: re-dial candidates who requested a callback during screening
export async function processScheduledCalls(): Promise<void> {
  // Reset stuck 'initiated' rows older than 10 min — crashed attempts retry
  await adminDb
    .from('scheduled_calls')
    .update({ status: 'pending', updated_at: new Date().toISOString() })
    .eq('status', 'initiated')
    .lt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())

  // Atomically claim due pending rows
  const { data: rows, error } = await adminDb
    .from('scheduled_calls')
    .update({ status: 'initiated', updated_at: new Date().toISOString() })
    .eq('status', 'pending')
    .lte('scheduled_for', new Date().toISOString())
    .select()

  if (error) { Sentry.captureException(error); return }

  for (const row of rows ?? []) {
    try {
      const withinLimit = await checkDailyCallLimit()
      if (!withinLimit) {
        await adminDb.from('scheduled_calls').update({ status: 'pending' }).eq('id', row.id)
        break
      }

      // Feature D call path: application → applicant phone + question set
      const { data: app } = await adminDb
        .from('applications')
        .select('applicant_id, question_set_id, applicants(phone, name)')
        .eq('id', row.application_id)
        .single()

      if (!app) throw new Error(`Application not found for scheduled_call ${row.id}`)

      const applicant = app.applicants as unknown as { phone: string; name: string } | null
      if (!applicant?.phone) throw new Error(`No phone for application ${row.application_id}`)

      const questionSet = await getQuestionSetWithQuestions(app.question_set_id as string)
      const overrides = buildAssistantOverrides(applicant.name, questionSet.questions)

      const { vapiCallId } = await initiateVapiCall({
        toPhone: applicant.phone,
        assistantId: process.env.VAPI_ASSISTANT_ID!,
        phoneNumberId: process.env.VAPI_PHONE_NUMBER_ID!,
        assistantOverrides: overrides,
      })

      // Create a NEW screen_calls row — each attempt needs its own row for SLA tracking
      await adminDb.from('screen_calls').insert({
        application_id: row.application_id,
        screen_link_id: row.screen_link_id,
        vapi_call_id: vapiCallId,
        status: 'initiated',
        started_at: new Date().toISOString(),
      })
    } catch (err) {
      Sentry.captureException(err, { extra: { scheduledCallId: row.id } })
      await adminDb.from('scheduled_calls').update({ status: 'pending' }).eq('id', row.id)
    }
  }
}
