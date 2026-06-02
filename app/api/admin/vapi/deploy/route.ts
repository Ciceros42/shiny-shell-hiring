import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { buildAssistantConfig } from '@/lib/vapi/assistant'
import type { VapiAssistantConfig } from '@/lib/types/vapi'

export async function POST(req: Request) {
  const { error, user } = await requireAdmin()
  if (error) return error

  const apiKey = process.env.VAPI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'VAPI_API_KEY not set' }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  if (!baseUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_BASE_URL not set' }, { status: 500 })

  const body = await req.json() as VapiAssistantConfig

  // Get company for this user
  const { data: profile } = await adminDb
    .from('profiles')
    .select('company_id')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'No company found for user' }, { status: 400 })
  }

  // Get existing settings (to find assistantId if already deployed)
  const { data: company } = await adminDb
    .from('companies')
    .select('settings')
    .eq('id', profile.company_id)
    .single()

  const existingAssistantId: string | undefined =
    (company?.settings as Record<string, unknown>)?.vapi &&
    ((company.settings as Record<string, Record<string, unknown>>).vapi?.assistantId as string) ||
    undefined

  // Push to Vapi
  const vapiConfig = buildAssistantConfig(body, `${baseUrl}/api/webhooks/vapi`)

  let vapiRes: Response
  if (existingAssistantId) {
    vapiRes = await fetch(`https://api.vapi.ai/assistant/${existingAssistantId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(vapiConfig),
    })
  } else {
    vapiRes = await fetch('https://api.vapi.ai/assistant', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(vapiConfig),
    })
  }

  if (!vapiRes.ok) {
    const text = await vapiRes.text()
    return NextResponse.json({ error: `Vapi API error: ${text}` }, { status: 500 })
  }

  const vapiData = await vapiRes.json()
  const assistantId: string = vapiData.id

  // Persist config + assistantId to companies.settings.vapi
  await adminDb
    .from('companies')
    .update({
      settings: {
        ...(company?.settings as object ?? {}),
        vapi: { ...body, assistantId },
      },
    })
    .eq('id', profile.company_id)

  return NextResponse.json({ ok: true, assistantId, isNew: !existingAssistantId })
}
