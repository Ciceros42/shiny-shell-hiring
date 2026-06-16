import { Resend } from 'resend'

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

export async function sendPassEmail({
  to,
  name,
  scheduleUrl,
  companyName = 'Shiny Shell Carwash',
}: {
  to: string
  name: string
  scheduleUrl: string
  companyName?: string
}) {
  const resend = getResend()
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'hiring@shiny-shell.com',
    to,
    subject: `Next step: schedule your interview with ${companyName}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px">Hi ${name},</h2>
        <p style="color:#444;margin:0 0 24px">
          Thank you for your interest in ${companyName}! Please use the link below to
          schedule a follow-up interview with one of our managers.
        </p>
        <a href="${scheduleUrl}"
           style="display:inline-block;background:#1e3c6c;color:#fff;text-decoration:none;
                  padding:14px 28px;border-radius:8px;font-weight:600;font-size:16px">
          Schedule My Interview →
        </a>
        <p style="color:#888;font-size:12px;margin-top:32px">
          This link expires in 72 hours.
        </p>
      </div>
    `,
  })
}

export async function sendFailEmail({
  to,
  name,
  companyName = 'Shiny Shell Carwash',
}: {
  to: string
  name: string
  companyName?: string
}) {
  const resend = getResend()
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'hiring@shiny-shell.com',
    to,
    subject: `Your ${companyName} application`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px">Hi ${name},</h2>
        <p style="color:#444;margin:0 0 24px">
          Thank you for your application to ${companyName}. We appreciate your time
          and wish you all the best.
        </p>
      </div>
    `,
  })
}

export async function sendInviteEmail({
  to,
  name,
  inviteUrl,
  inviterCompany,
}: {
  to: string
  name: string
  inviteUrl: string
  inviterCompany: string
}) {
  const resend = getResend()
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'hiring@shiny-shell.com',
    to,
    subject: `You've been invited to ${inviterCompany} Hiring`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px">
        <h2 style="margin:0 0 8px">Hi ${name},</h2>
        <p style="color:#444;margin:0 0 24px">
          You've been invited to manage hiring for <strong>${inviterCompany}</strong>.
          Click the button below to set your password and access the portal.
        </p>
        <a href="${inviteUrl}"
           style="display:inline-block;background:#1e3c6c;color:#fff;text-decoration:none;
                  padding:14px 28px;border-radius:8px;font-weight:600;font-size:16px">
          Accept Invitation →
        </a>
        <p style="color:#888;font-size:12px;margin-top:32px">
          This link expires in 24 hours. If you weren't expecting this, you can ignore it.
        </p>
      </div>
    `,
  })
}

export async function sendScreenLinkEmail({
  to,
  name,
  screenUrl,
  locationName,
  companyName = 'Shiny Shell',
}: {
  to: string
  name: string
  screenUrl: string
  locationName: string
  companyName?: string
}) {
  const resend = getResend()
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL ?? 'hiring@shiny-shell.com',
    to,
    subject: `Your ${companyName} application — start your phone screen`,
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
          This link expires in 24 hours. If you didn't apply to ${companyName}, ignore this email.
        </p>
      </div>
    `,
  })
}
