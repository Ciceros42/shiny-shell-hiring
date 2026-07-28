import { NextResponse } from 'next/server'
import { verifyCronSecret } from '@/lib/auth/verify-cron-secret'

// Retention cron removed. Route kept to avoid 404s from any lingering cron calls.
export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return new Response('Unauthorized', { status: 401 })
  }
  return NextResponse.json({ ok: true, message: 'Retention cron removed' })
}
