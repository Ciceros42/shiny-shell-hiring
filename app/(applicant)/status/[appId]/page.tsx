import { notFound } from 'next/navigation'
import { adminDb } from '@/lib/supabase/admin'
import { verifyStatusToken } from '@/lib/auth/status-token'

interface Props {
  params: Promise<{ appId: string }>
  searchParams: Promise<{ t?: string }>
}

const STAGES = [
  {
    key: 'received',
    label: 'Application Received',
    detail: 'We have your application on file.',
    statuses: ['applied', 'sms_sent'],
  },
  {
    key: 'screening',
    label: 'Phone Screen',
    detail: 'Complete the short phone screen to move forward.',
    statuses: ['screen_link_clicked', 'screening', 'screen_complete'],
  },
  {
    key: 'interview',
    label: 'Interview',
    detail: 'You\'ve been selected — book your interview slot.',
    statuses: ['passed', 'scheduled', 'interviewed'],
  },
  {
    key: 'decision',
    label: 'Decision',
    detail: 'Final hiring decision.',
    statuses: ['hired'],
  },
]

const TERMINAL_NEGATIVE = ['rejected', 'failed', 'no_show']

function getStageIndex(status: string): number {
  for (let i = 0; i < STAGES.length; i++) {
    if (STAGES[i].statuses.includes(status)) return i
  }
  return -1
}

export default async function StatusPage({ params, searchParams }: Props) {
  const { appId } = await params
  const { t } = await searchParams

  if (!t || !verifyStatusToken(appId, t)) return notFound()

  const { data: app } = await adminDb
    .from('applications')
    .select('id, status, created_at, jobs(title), locations(name), applicants(name)')
    .eq('id', appId)
    .maybeSingle()

  if (!app) return notFound()

  const status = app.status as string
  const isTerminalNegative = TERMINAL_NEGATIVE.includes(status)
  const isHired = status === 'hired'
  const currentStageIdx = getStageIndex(status)

  const applicantName = (app.applicants as unknown as { name: string } | null)?.name ?? ''
  const jobTitle = (app.jobs as unknown as { title: string } | null)?.title ?? 'the position'
  const locationName = (app.locations as unknown as { name: string } | null)?.name ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">
          {isHired ? `Congratulations, ${applicantName.split(' ')[0]}!` : `Hi ${applicantName.split(' ')[0]},`}
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {isHired
            ? `You've been hired for ${jobTitle}${locationName ? ` at ${locationName}` : ''}.`
            : isTerminalNegative
            ? `Thank you for your interest in ${jobTitle}.`
            : `Here's where your ${jobTitle} application stands${locationName ? ` at ${locationName}` : ''}.`}
        </p>
      </div>

      {isTerminalNegative ? (
        <div className="rounded-xl bg-gray-50 border border-gray-200 px-5 py-4">
          <p className="text-sm text-gray-600">
            We appreciate your time and interest. We won't be moving forward at this time, but we wish you the best.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {STAGES.map((stage, idx) => {
            const done = idx < currentStageIdx
            const active = idx === currentStageIdx
            const upcoming = idx > currentStageIdx

            return (
              <div
                key={stage.key}
                className="flex items-start gap-4 rounded-xl border px-5 py-4 transition-colors"
                style={{
                  backgroundColor: active ? 'color-mix(in srgb, var(--brand-primary) 6%, white)' : 'white',
                  borderColor: active ? 'var(--brand-primary)' : '#E5E7EB',
                  opacity: upcoming ? 0.45 : 1,
                }}
              >
                {/* Step indicator */}
                <div
                  className="mt-0.5 h-6 w-6 rounded-full flex items-center justify-center shrink-0 text-xs font-bold"
                  style={{
                    backgroundColor: done ? '#10B981' : active ? 'var(--brand-primary)' : '#E5E7EB',
                    color: done || active ? '#fff' : '#9CA3AF',
                  }}
                >
                  {done ? '✓' : idx + 1}
                </div>
                <div className="min-w-0">
                  <p
                    className="text-sm font-semibold"
                    style={{ color: active ? 'var(--brand-primary)' : '#111827' }}
                  >
                    {stage.label}
                    {active && (
                      <span className="ml-2 text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: 'var(--brand-primary)', color: 'white' }}>
                        Current
                      </span>
                    )}
                  </p>
                  {(active || done) && (
                    <p className="text-xs text-gray-500 mt-0.5">{stage.detail}</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">
        Applied {new Date(app.created_at as string).toLocaleDateString()} · Text STATUS to {process.env.TWILIO_PHONE_NUMBER ?? 'our number'} anytime for an update
      </p>
    </div>
  )
}
