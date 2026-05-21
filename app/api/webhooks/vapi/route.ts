import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import * as Sentry from '@sentry/nextjs'
import { insertInboundEvent } from '@/lib/db/inbound-events'

// Fix 11: shared-secret auth only — Vapi HMAC signing is unreliable (header often absent despite config)
export async function POST(req: Request) {
  // Must read raw body FIRST before any other operation
  const rawBody = await req.text()

  // Only verify secret if one is configured — Vapi dashboard may not expose a secret field
  const expected = process.env.VAPI_WEBHOOK_SECRET ?? ''
  if (expected) {
    const provided = req.headers.get('x-vapi-secret') ?? ''
    const a = Buffer.from(provided)
    const b = Buffer.from(expected)
    if (a.length === 0 || a.length !== b.length || !timingSafeEqual(a, b)) {
      Sentry.captureMessage('Vapi webhook auth failed', {
        extra: { headers: Object.fromEntries(req.headers) },
      })
      return new Response('Unauthorized', { status: 401 })
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  // All Vapi events are wrapped under a top-level `message` object
  const msg = payload.message as Record<string, unknown> | undefined
  if (!msg || typeof msg.type !== 'string') {
    return new Response('Bad Request', { status: 400 })
  }

  const eventType = msg.type

  // tool-calls must respond with { result } synchronously — the AI call stalls if we 500
  if (eventType === 'tool-calls') {
    try {
      await insertInboundEvent({ source: 'vapi', eventType, payload })
    } catch (err) {
      Sentry.captureException(err)
      // Still return success so the call isn't stalled
    }
    return NextResponse.json({ result: 'Recorded, continue.' })
  }

  // All other events (end-of-call-report, status-update, transcript) go to outbox
  try {
    await insertInboundEvent({ source: 'vapi', eventType, payload })
  } catch (err) {
    Sentry.captureException(err)
    return new Response('Internal Server Error', { status: 500 })
  }

  return NextResponse.json({ received: true })
}
