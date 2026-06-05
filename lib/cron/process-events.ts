import * as Sentry from '@sentry/nextjs'
import { adminDb } from '@/lib/supabase/admin'
import { getUnprocessedEvents, markEventProcessed, markEventFailed } from '@/lib/db/inbound-events'
import { getScreenCallByVapiId, updateScreenCall, saveScreenAnswerScores, upsertScreenAnswer } from '@/lib/db/screen'
import { getScreenAnswers } from '@/lib/db/screen'
import { getApplicationById, updateApplicationStatus } from '@/lib/db/applications'
import { getApplicant, addToTalentPool } from '@/lib/db/applicants'
import { getLocationById } from '@/lib/db/locations'
import { getQuestionSetWithQuestions } from '@/lib/db/question-sets'
import { saveScreenResult, getScreenResult, markScreenResultNotified } from '@/lib/db/screen-results'
import { createMagicLink, markMagicLinkCompleted } from '@/lib/db/magic-links'
import { batchScoreAndSummarize, runPassFailEngine, reconcileAnswersFromTranscript } from '@/lib/scoring/engine'
import { sendSMS } from '@/lib/twilio/sms'
import { SMS } from '@/lib/twilio/messages'
import { getCompanyPipelineMode } from '@/lib/db/companies'
import { sendPassEmail, sendFailEmail } from '@/lib/email/send'
import type { InboundEvent } from '@/lib/db/inbound-events'
import type { ScreenResult } from '@/lib/db/screen-results'
import type { ScreenCall } from '@/lib/db/screen'
import type { Applicant } from '@/lib/db/applicants'
import type { Location } from '@/lib/db/locations'

export async function processInboundEvents(): Promise<void> {
  const events = await getUnprocessedEvents(50)

  // Alert if any unprocessed event is older than 5 minutes
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
  const stale = events.filter((e) => e.receivedAt < fiveMinutesAgo)
  if (stale.length > 0) {
    Sentry.captureMessage(`${stale.length} unprocessed Vapi events older than 5 min`, 'warning')
  }

  for (const event of events) {
    try {
      await processEvent(event)
      await markEventProcessed(event.id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      Sentry.captureException(err, { extra: { eventId: event.id, eventType: event.eventType } })
      await markEventFailed(event.id, msg)
    }
  }
}

async function processEvent(event: InboundEvent): Promise<void> {
  if (event.source === 'vapi') {
    await processVapiEvent(event)
  }
}

async function processVapiEvent(event: InboundEvent): Promise<void> {
  // Fix 4: always destructure from event.payload.message
  const msg = event.payload.message as Record<string, unknown>
  if (!msg) return

  const eventType = msg.type as string

  switch (eventType) {
    case 'tool-calls': {
      const call = msg.call as Record<string, unknown>
      const toolCallList = msg.toolCallList as Array<{
        id: string
        name: string
        parameters: Record<string, unknown>
      }>
      const toolCall = toolCallList?.[0]
      if (!toolCall) return

      if (toolCall.name === 'recordAnswer') {
        const screenCall = await getScreenCallByVapiId(call.id as string)
        // Fix 6: throw — event stays unprocessed and retries
        if (!screenCall) throw new Error(`screen_call not found for vapi_call_id ${call.id} — will retry`)
        await upsertScreenAnswer({
          screenCallId: screenCall.id,
          questionId: toolCall.parameters.questionId as string,
          answerText: toolCall.parameters.answerText as string,
        })
      }

      if (toolCall.name === 'requestCallback') {
        // Feature D: schedule a callback 1 hour from now
        const screenCall = await getScreenCallByVapiId(call.id as string)
        if (!screenCall) throw new Error(`screen_call not found for requestCallback — will retry`)
        await adminDb.from('scheduled_calls').insert({
          application_id: screenCall.applicationId,
          screen_link_id: screenCall.screenLinkId,
          scheduled_for: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
          status: 'pending',
        })
      }
      break
    }

    case 'end-of-call-report': {
      await processEndOfCall(event)
      break
    }

    case 'status-update': {
      const call = msg.call as Record<string, unknown>
      const status = msg.status as string
      const screenCall = await getScreenCallByVapiId(call.id as string)
      if (!screenCall) return // status-update may arrive before screen_call is created — safe to skip

      if (status === 'in-progress') {
        await updateScreenCall(screenCall.id, { status: 'in_progress' })
        await updateApplicationStatus(screenCall.applicationId, 'screening')
      }
      break
    }

    default:
      // transcript and other events — no action needed
      break
  }
}

async function processEndOfCall(event: InboundEvent): Promise<void> {
  // Fix 4: destructure from message wrapper, never use new Date() for call timestamp
  const msg = event.payload.message as Record<string, unknown>
  const call = msg.call as Record<string, unknown>
  const artifact = msg.artifact as Record<string, unknown>

  const screenCall = await getScreenCallByVapiId(call.id as string)
  if (!screenCall) throw new Error(`No screen_call for vapi_call_id ${call.id}`)

  const application = await getApplicationById(screenCall.applicationId)

  // Idempotency: skip if already fully processed
  const existing = await getScreenResult(screenCall.applicationId)
  if (existing?.notifiedAt) return // SMS already sent
  if (application.status === 'screen_complete' || application.status === 'passed' || application.status === 'failed') return

  const applicant = await getApplicant(application.applicantId)
  const location = await getLocationById(application.locationId)

  if (!applicant) throw new Error(`Applicant not found for application ${application.id}`)

  if (existing && !existing.notifiedAt) {
    // Scoring done but not yet dispatched — re-enter dispatch
    const pipelineMode = await getCompanyPipelineMode(application.companyId)
    if (pipelineMode === 'suggestion') {
      await updateApplicationStatus(application.id, 'screen_complete')
    } else {
      await updateApplicationStatus(application.id, existing.passed ? 'passed' : 'failed')
      await sendPassFailNotification(existing, applicant, location)
    }
    return
  }

  const questionSet = await getQuestionSetWithQuestions(application.questionSetId)

  // Fix 4: use Vapi event timestamp — never new Date() (cron may run 10 min after event)
  const callEndedAt = new Date(
    (call.endedAt ?? call.ended_at ?? Date.now()) as string | number
  )
  const transcript = (artifact.transcript as string) ?? ''

  // Guard against premature end-of-call events (Vapi can fire these on brief drops).
  // A real screening call transcript should have at least a few hundred characters.
  if (transcript.length < 200) {
    Sentry.captureMessage(`Skipping end-of-call for ${screenCall.id}: transcript too short (${transcript.length} chars) — likely premature event`, 'warning')
    return
  }

  await updateScreenCall(screenCall.id, {
    status: 'completed',
    transcript,
    endedAt: callEndedAt,
    costUsd: (call.cost as number | undefined) ?? null,
  })
  await markMagicLinkCompleted(screenCall.screenLinkId)

  await reconcileAnswersFromTranscript(screenCall.id, questionSet.questions, transcript)

  const answers = await getScreenAnswers(screenCall.id)
  const batchResult = await batchScoreAndSummarize(answers, questionSet.questions)

  await saveScreenAnswerScores(batchResult.scoredAnswers)
  await updateScreenCall(screenCall.id, { inflectionNotes: batchResult.inflectionNotes })

  const passFailResult = runPassFailEngine(
    batchResult.scoredAnswers,
    { pass_threshold: questionSet.passThreshold, questions: questionSet.questions },
    batchResult.qualitativeSummary
  )

  const screenResult = await saveScreenResult({
    applicationId: application.id,
    passed: passFailResult.passed,
    failReason: passFailResult.failReason,
    qualitativeSummary: passFailResult.qualitativeSummary,
    managerBriefing: batchResult.managerBriefing,
    scoredAnswers: batchResult.scoredAnswers,
    totalScore: passFailResult.totalScore,
    thresholdAtTime: questionSet.passThreshold,
  })

  const pipelineMode = await getCompanyPipelineMode(application.companyId)

  if (pipelineMode === 'suggestion') {
    // Hold at screen_complete — admin reviews and manually advances or rejects
    await updateApplicationStatus(application.id, 'screen_complete')
  } else {
    // Assistant mode — act automatically
    await updateApplicationStatus(application.id, passFailResult.passed ? 'passed' : 'failed')
    await sendPassFailNotification(screenResult, applicant, location)
  }
}

async function sendPassFailNotification(
  result: ScreenResult,
  applicant: Applicant,
  location: Location
): Promise<void> {
  const useEmail = applicant.smsOptedOut && !!applicant.email

  if (result.passed) {
    const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
    const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)
    const earliestBookable = new Date(Date.now() + 30 * 60 * 1000)

    await createMagicLink({
      type: 'schedule',
      applicationId: result.applicationId,
      token,
      expiresAt,
      earliestBookable,
    })

    const scheduleUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/schedule/${token}`

    if (useEmail) {
      await sendPassEmail({ to: applicant.email!, name: applicant.name, scheduleUrl })
    } else {
      await sendSMS(applicant.phone, SMS.pass(scheduleUrl), result.applicationId, 'pass', location.timezone, { bypassQuietHours: true })
    }
    await addToTalentPool(applicant.id, location.id, 'passed_no_schedule')
  } else {
    if (useEmail) {
      await sendFailEmail({ to: applicant.email!, name: applicant.name })
    } else {
      await sendSMS(applicant.phone, SMS.fail(), result.applicationId, 'fail', location.timezone, { bypassQuietHours: true })
    }
    await addToTalentPool(applicant.id, location.id, 'failed_screen' as never)
  }

  await markScreenResultNotified(result.applicationId)
}
