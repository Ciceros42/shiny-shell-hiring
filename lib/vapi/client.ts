import { adminDb } from '@/lib/supabase/admin'
import type { AssistantOverrides } from './assistant'

export interface InitiateVapiCallParams {
  toPhone: string
  assistantId: string
  phoneNumberId: string
  assistantOverrides: AssistantOverrides
}

export async function initiateVapiCall({
  toPhone,
  assistantId,
  phoneNumberId,
  assistantOverrides,
}: InitiateVapiCallParams): Promise<{ vapiCallId: string }> {
  const res = await fetch('https://api.vapi.ai/call', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.VAPI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      assistantId,
      phoneNumberId,
      customer: { number: toPhone },
      assistantOverrides,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Vapi call initiation failed: ${res.status} ${body}`)
  }

  const data = await res.json()
  return { vapiCallId: data.id as string }
}

export async function checkDailyCallLimit(): Promise<boolean> {
  const limit = parseInt(process.env.DAILY_CALL_LIMIT ?? '100', 10)

  const { count, error } = await adminDb
    .from('screen_calls')
    .select('*', { count: 'exact', head: true })
    .gte('started_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

  if (error) throw new Error(`checkDailyCallLimit failed: ${error.message}`)

  return (count ?? 0) < limit
}
