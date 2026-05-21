import { adminDb } from '@/lib/supabase/admin'

export interface InboundEvent {
  id: string
  source: 'vapi' | 'twilio'
  eventType: string
  payload: Record<string, unknown>
  receivedAt: string
  processedAt: string | null
  failedAt: string | null
  errorText: string | null
  retryCount: number
}

export async function insertInboundEvent({
  source,
  eventType,
  payload,
}: {
  source: 'vapi' | 'twilio'
  eventType: string
  payload: Record<string, unknown>
}): Promise<void> {
  const { error } = await adminDb.from('inbound_events').insert({
    source,
    event_type: eventType,
    payload,
  })
  if (error) throw new Error(`insertInboundEvent failed: ${error.message}`)
}

// Event ordering: tool-calls (0) before end-of-call-report (1) before others (2).
// This ensures screen_answers are written before processEndOfCall reads them.
// Sorting is done in JS since PostgREST doesn't support CASE WHEN in ORDER BY.
export async function getUnprocessedEvents(limit = 50): Promise<InboundEvent[]> {
  const { data, error } = await adminDb
    .from('inbound_events')
    .select('*')
    .is('processed_at', null)
    .is('failed_at', null)
    .lt('retry_count', 5)
    .order('received_at', { ascending: true })
    .limit(limit)

  if (error) throw new Error(`getUnprocessedEvents failed: ${error.message}`)

  const typeOrder = (t: string) => {
    if (t === 'tool-calls') return 0
    if (t === 'end-of-call-report') return 1
    return 2
  }

  return (data ?? [])
    .map(mapEvent)
    .sort((a, b) => typeOrder(a.eventType) - typeOrder(b.eventType) || a.receivedAt.localeCompare(b.receivedAt))
}

export async function markEventProcessed(id: string): Promise<void> {
  const { error } = await adminDb
    .from('inbound_events')
    .update({ processed_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw new Error(`markEventProcessed failed: ${error.message}`)
}

export async function markEventFailed(id: string, errorText: string): Promise<void> {
  // Increment retry_count atomically via RPC — avoids read-modify-write race (Task 10 plan note)
  const { error } = await adminDb.rpc('increment_event_retry', { event_id: id, err: errorText })
  if (error) {
    // Fallback: direct update if RPC doesn't exist yet
    await adminDb
      .from('inbound_events')
      .update({ error_text: errorText })
      .eq('id', id)
  }
}

function mapEvent(row: Record<string, unknown>): InboundEvent {
  return {
    id: row.id as string,
    source: row.source as 'vapi' | 'twilio',
    eventType: row.event_type as string,
    payload: row.payload as Record<string, unknown>,
    receivedAt: row.received_at as string,
    processedAt: (row.processed_at as string | null) ?? null,
    failedAt: (row.failed_at as string | null) ?? null,
    errorText: (row.error_text as string | null) ?? null,
    retryCount: (row.retry_count as number) ?? 0,
  }
}
