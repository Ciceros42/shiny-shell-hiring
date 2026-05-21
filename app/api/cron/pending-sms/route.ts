import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { drainPendingSms } from '@/lib/cron/pending-sms'

export async function GET(req: Request) {
  if (req.headers.get('authorization')?.replace('Bearer ', '') !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }
  try {
    await drainPendingSms()
    return NextResponse.json({ ok: true })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
