import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendScreenLinkEmail({
  to,
  name,
  screenUrl,
  locationName,
}: {
  to: string
  name: string
  screenUrl: string
  locationName: string
}) {
  const resend = getResend()
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'hiring@shiny-shell.com',
    to,
    subject: `Your Shiny Shell application — start your phone screen`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px">Hi ${name},</h2>
        <p style="color:#444;margin:0 0 24px">
          Thanks for applying to ${locationName}! Click below to start your 3-minute phone screening —
          it's the next step to getting hired.
        </p>
        <a href="${screenUrl}"
           style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
                  padding:14px 28px;border-radius:8px;font-weight:600;font-size:16px">
          Start My Phone Screen →
        </a>
        <p style="color:#888;font-size:12px;margin-top:32px">
          This link expires in 24 hours. If you didn't apply to Shiny Shell, ignore this email.
        </p>
      </div>
    `,
  })
}
