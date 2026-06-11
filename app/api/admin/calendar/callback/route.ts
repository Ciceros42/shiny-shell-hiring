import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { handleOAuthCallback } from '@/lib/google-calendar/sync'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const oauthError = searchParams.get('error')

  const base = `${process.env.NEXT_PUBLIC_BASE_URL}/calendar`

  if (oauthError) {
    return NextResponse.redirect(`${base}?calendar_error=${encodeURIComponent(oauthError)}`)
  }

  if (!code || !userId) {
    return NextResponse.redirect(`${base}?calendar_error=missing_params`)
  }

  try {
    await handleOAuthCallback(code, userId)
    return NextResponse.redirect(`${base}?connected=1`)
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.redirect(`${base}?calendar_error=callback_failed`)
  }
}
