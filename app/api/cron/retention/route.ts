import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { runRetentionCheckins } from '@/lib/cron/retention'

export async function GET(req: Request) {
  if (req.headers.get('authorization')?.replace('Bearer ', '') !== process.env.CRON_SECRET) {
    return new Response('Unauthorized', { status: 401 })
  }
  try {
    await runRetentionCheckins()
    return NextResponse.json({ ok: true })
  } catch (err) {
    Sentry.captureException(err)
    return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
  }
}
