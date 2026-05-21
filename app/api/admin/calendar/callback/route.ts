import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { handleOAuthCallback } from '@/lib/google-calendar/sync'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const code = searchParams.get('code')
  const userId = searchParams.get('state')
  const oauthError = searchParams.get('error')

  if (oauthError) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin/settings?calendar_error=${encodeURIComponent(oauthError)}`
    )
  }

  if (!code || !userId) {
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin/settings?calendar_error=missing_params`
    )
  }

  try {
    await handleOAuthCallback(code, userId)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin/settings?calendar_connected=1`
    )
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_BASE_URL}/admin/settings?calendar_error=callback_failed`
    )
  }
}
