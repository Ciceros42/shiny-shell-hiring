import { Resend } from 'resend'
import { adminDb } from '@/lib/supabase/admin'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function renderAvailability(availability: Record<string, string[]> | null): string {
  if (!availability) return 'Not specified'
  const DAY_LABELS: Record<string, string> = {
    mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun',
  }
  const SHIFT_LABELS: Record<string, string> = {
    morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening',
  }
  const lines = Object.entries(availability)
    .filter(([, shifts]) => shifts.length > 0)
    .map(([day, shifts]) => `${DAY_LABELS[day] ?? day}: ${shifts.map(s => SHIFT_LABELS[s] ?? s).join(', ')}`)
  return lines.length > 0 ? lines.join('<br>') : 'Not specified'
}

function infoRow(label: string, value: string, last = false): string {
  const border = last ? '' : 'border-bottom:1px solid #E5E7EB;'
  return `
    <tr>
      <td style="padding:9px 14px;font-size:13px;font-weight:600;color:#6B7280;background:#F9FAFB;${border}white-space:nowrap;width:36%">${label}</td>
      <td style="padding:9px 14px;font-size:14px;color:#111827;${border}">${value}</td>
    </tr>`
}

function buildEmailHtml({
  managerName,
  applicantName,
  applicantPhone,
  applicantEmail,
  locationName,
  jobTitle,
  appliedDate,
  availability,
  hasTransportation,
  screenResult,
  answers,
  otherManagerCount,
}: {
  managerName: string
  applicantName: string
  applicantPhone: string
  applicantEmail: string | null
  locationName: string
  jobTitle: string | null
  appliedDate: string
  availability: Record<string, string[]> | null
  hasTransportation: boolean
  screenResult: {
    passed: boolean
    total_score: number
    threshold_at_time: number
    qualitative_summary: string | null
    manager_briefing: string | null
  } | null
  answers: { questionText: string; answerText: string; score: number | null; type: string }[]
  otherManagerCount: number
}): string {
  const multiNote = otherManagerCount > 0
    ? `<p style="background:#FFF7ED;border:1px solid #FED7AA;border-radius:6px;padding:10px 14px;font-size:13px;color:#9A3412;margin:0 0 20px">
        <strong>Note:</strong> ${otherManagerCount} other location manager${otherManagerCount > 1 ? 's were' : ' was'} also sent this notification.
       </p>`
    : ''

  const infoRows = [
    infoRow('Name', escapeHtml(applicantName)),
    infoRow('Phone', escapeHtml(applicantPhone)),
    applicantEmail ? infoRow('Email', escapeHtml(applicantEmail)) : '',
    jobTitle ? infoRow('Position', escapeHtml(jobTitle)) : '',
    infoRow('Location', escapeHtml(locationName)),
    infoRow('Applied', escapeHtml(appliedDate)),
    infoRow('Transportation', hasTransportation ? 'Yes' : 'No'),
    infoRow('Availability', renderAvailability(availability), true),
  ].join('')

  const screenSection = screenResult ? `
    <h3 style="font-size:13px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin:24px 0 10px;padding-top:20px;border-top:1px solid #E5E7EB">Screening Results</h3>
    <p style="font-size:14px;margin:0 0 12px">
      Result: <strong style="color:${screenResult.passed ? '#059669' : '#DC2626'}">${screenResult.passed ? 'PASS' : 'FAIL'}</strong>
      &nbsp;·&nbsp; Score: <strong>${screenResult.total_score}</strong> / ${screenResult.threshold_at_time} to pass
    </p>
    ${screenResult.manager_briefing ? `
    <div style="background:#EFF6FF;border-left:3px solid #3B82F6;padding:10px 14px;border-radius:0 6px 6px 0;margin-bottom:12px">
      <p style="font-size:12px;font-weight:600;color:#1D4ED8;margin:0 0 4px">MANAGER BRIEFING</p>
      <p style="font-size:14px;color:#1E40AF;margin:0;line-height:1.6">${escapeHtml(screenResult.manager_briefing)}</p>
    </div>` : ''}
    ${screenResult.qualitative_summary ? `
    <div style="margin-bottom:12px">
      <p style="font-size:12px;font-weight:600;color:#6B7280;margin:0 0 4px">AI SUMMARY</p>
      <p style="font-size:14px;color:#374151;margin:0;line-height:1.6;font-style:italic">${escapeHtml(screenResult.qualitative_summary)}</p>
    </div>` : ''}
  ` : ''

  const answersSection = answers.length > 0 ? `
    <h3 style="font-size:13px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin:20px 0 10px">Screen Answers</h3>
    ${answers.map(a => `
      <div style="margin-bottom:10px;padding:10px 12px;background:#F9FAFB;border:1px solid #E5E7EB;border-radius:6px">
        <p style="font-size:12px;color:#6B7280;margin:0 0 4px">${escapeHtml(a.questionText)}</p>
        <p style="font-size:14px;color:#111827;margin:0">${escapeHtml(a.answerText)}</p>
        ${a.score !== null && a.type === 'scored' ? `<p style="font-size:12px;color:#9CA3AF;margin:4px 0 0">Score: ${a.score}/100</p>` : ''}
      </div>
    `).join('')}
  ` : ''

  return `
    <div style="font-family:sans-serif;max-width:580px;margin:0 auto;padding:24px;color:#111827">
      <div style="background:#F0FDF4;border:1px solid #BBF7D0;border-radius:8px;padding:14px 18px;margin-bottom:20px">
        <p style="font-size:16px;font-weight:700;color:#065F46;margin:0">🎉 New Hire: ${escapeHtml(applicantName)}</p>
        <p style="font-size:13px;color:#047857;margin:3px 0 0">${escapeHtml(locationName)}</p>
      </div>

      <p style="font-size:14px;color:#374151;margin:0 0 8px">Hi ${escapeHtml(managerName)},</p>
      <p style="font-size:14px;color:#374151;margin:0 0 20px">
        ${escapeHtml(applicantName)} has been marked as hired at ${escapeHtml(locationName)}. Here is their full information.
      </p>

      ${multiNote}

      <h3 style="font-size:13px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:.05em;margin:0 0 10px">Applicant Information</h3>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;margin-bottom:4px">
        ${infoRows}
      </table>

      ${screenSection}
      ${answersSection}

      <p style="font-size:12px;color:#9CA3AF;margin-top:28px;padding-top:14px;border-top:1px solid #E5E7EB">
        Sent by Shiny Shell Hiring
      </p>
    </div>
  `
}

export async function sendHireNotification(appId: string, companyId: string): Promise<void> {
  const { data: app } = await adminDb
    .from('applications')
    .select(`
      id, created_at, availability, has_transportation,
      applicants(name, phone, email),
      locations(id, name),
      jobs(title)
    `)
    .eq('id', appId)
    .eq('company_id', companyId)
    .single()

  if (!app) return

  const applicant = app.applicants as { name: string; phone: string; email: string | null } | null
  const location = app.locations as { id: string; name: string } | null
  const job = app.jobs as { title: string } | null
  if (!applicant || !location) return

  const { data: sr } = await adminDb
    .from('screen_results')
    .select('passed, total_score, threshold_at_time, qualitative_summary, manager_briefing')
    .eq('application_id', appId)
    .maybeSingle()

  let answers: { questionText: string; answerText: string; score: number | null; type: string }[] = []
  const { data: screenCalls } = await adminDb
    .from('screen_calls')
    .select('id')
    .eq('application_id', appId)
    .eq('status', 'completed')

  if (screenCalls && screenCalls.length > 0) {
    const { data: rawAnswers } = await adminDb
      .from('screen_answers')
      .select('answer_text, score, order_index, questions(variants, type)')
      .in('screen_call_id', screenCalls.map(s => s.id))
      .order('order_index', { ascending: true })

    answers = (rawAnswers ?? []).map(a => {
      const q = a.questions as { variants: string[]; type: string } | null
      return {
        questionText: q?.variants?.[0] ?? '—',
        answerText: a.answer_text,
        score: a.score as number | null,
        type: q?.type ?? 'scored',
      }
    })
  }

  const { data: managers } = await adminDb
    .from('profiles')
    .select('id, name')
    .eq('role', 'location_manager')
    .eq('location_id', location.id)
    .eq('company_id', companyId)

  if (!managers || managers.length === 0) return

  const emailResults = await Promise.all(managers.map(m => adminDb.auth.admin.getUserById(m.id)))
  const managerEmails = emailResults
    .map((r, i) => ({ email: r.data.user?.email ?? null, name: managers[i].name }))
    .filter((m): m is { email: string; name: string } => m.email !== null)

  if (managerEmails.length === 0) return

  const resend = getResend()
  const appliedDate = new Date(app.created_at).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  })

  await Promise.all(managerEmails.map(manager =>
    resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? 'onboarding@resend.dev',
      to: manager.email,
      subject: `New Hire: ${applicant.name} — ${location.name}`,
      html: buildEmailHtml({
        managerName: manager.name,
        applicantName: applicant.name,
        applicantPhone: applicant.phone,
        applicantEmail: applicant.email,
        locationName: location.name,
        jobTitle: job?.title ?? null,
        appliedDate,
        availability: app.availability as Record<string, string[]> | null,
        hasTransportation: app.has_transportation,
        screenResult: sr ?? null,
        answers,
        otherManagerCount: managerEmails.length - 1,
      }),
    })
  ))
}
