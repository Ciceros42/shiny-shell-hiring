import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { handleOAuthCallback, verifyState } from '@/lib/google-calendar/sync'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const stateParam = searchParams.get('state')
  const oauthError = searchParams.get('error')

  const base = `${process.env.NEXT_PUBLIC_BASE_URL}/calendar`

  if (oauthError) {
    return NextResponse.redirect(`${base}?calendar_error=${encodeURIComponent(oauthError)}`)
  }

  if (!code || !stateParam) {
    return NextResponse.redirect(`${base}?calendar_error=missing_params`)
  }

  const userId = verifyState(stateParam)
  if (!userId) {
    Sentry.captureMessage('OAuth callback: invalid or forged state parameter', { extra: { state: stateParam } })
    return NextResponse.redirect(`${base}?calendar_error=invalid_state`)
  }

  try {
    await handleOAuthCallback(code, userId)
    return NextResponse.redirect(`${base}?connected=1`)
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.redirect(`${base}?calendar_error=callback_failed`)
  }
}
