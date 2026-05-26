import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { buildAssistantConfig } from '@/lib/vapi/assistant'

export async function POST(req: Request) {
  const { error } = await requireAdmin()
  if (error) return error

  const apiKey = process.env.VAPI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'VAPI_API_KEY not set' }, { status: 500 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  if (!baseUrl) {
    return NextResponse.json({ error: 'NEXT_PUBLIC_BASE_URL not set' }, { status: 500 })
  }

  const config = buildAssistantConfig(`${baseUrl}/api/webhooks/vapi`)

  const existingId = process.env.VAPI_ASSISTANT_ID

  let res: Response
  if (existingId) {
    res = await fetch(`https://api.vapi.ai/assistant/${existingId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })
  } else {
    res = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    })
  }

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Vapi API error: ${text}` }, { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json({ ok: true, assistantId: data.id, isNew: !existingId })
}
