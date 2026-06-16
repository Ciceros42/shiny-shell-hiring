import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { buildAssistantConfig } from '@/lib/vapi/assistant'
import { invalidateCompany } from '@/lib/db/companies'

const vapiConfigSchema = z.object({
  assistantPersonaName: z.string().min(1),
  companyName: z.string().min(1),
  jobTitle: z.string().min(1),
  voiceId: z.string().min(1),
  openingLine: z.string().min(1),
  closingLine: z.string().min(1),
  payAndScheduleResponse: z.string().min(1),
  maxCallDurationMinutes: z.number().int().min(1).max(30),
  tone: z.enum(['friendly', 'professional', 'casual']),
})

export async function POST(req: Request) {
  const { error, profile } = await requireAdmin()
  if (error) return error

  const apiKey = process.env.VAPI_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'VAPI_API_KEY not set' }, { status: 500 })

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  if (!baseUrl) return NextResponse.json({ error: 'NEXT_PUBLIC_BASE_URL not set' }, { status: 500 })

  let body: z.infer<typeof vapiConfigSchema>
  try {
    const raw = await req.json()
    body = vapiConfigSchema.parse(raw)
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 422 })
  }

  if (!profile?.companyId) {
    return NextResponse.json({ error: 'No company found for user' }, { status: 400 })
  }

  // Get existing settings (to find assistantId if already deployed)
  const { data: company } = await adminDb
    .from('companies')
    .select('settings')
    .eq('id', profile.companyId)
    .single()

  const vapiSettings = (company?.settings as Record<string, Record<string, unknown>> | null)?.vapi
  const existingAssistantId: string | undefined =
    typeof vapiSettings?.assistantId === 'string' ? vapiSettings.assistantId : undefined

  // Push to Vapi
  const vapiConfig = buildAssistantConfig(body, `${baseUrl}/api/webhooks/vapi`)

  let vapiRes: Response
  try {
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
  } catch {
    return NextResponse.json({ error: 'Vapi API error' }, { status: 500 })
  }

  if (!vapiRes.ok) {
    return NextResponse.json({ error: 'Vapi API error' }, { status: 500 })
  }

  const vapiData = await vapiRes.json()
  const assistantId: string = vapiData.id

  // Persist validated config + assistantId to companies.settings.vapi
  const validatedVapiSettings = {
    assistantPersonaName: body.assistantPersonaName,
    companyName: body.companyName,
    jobTitle: body.jobTitle,
    voiceId: body.voiceId,
    openingLine: body.openingLine,
    closingLine: body.closingLine,
    payAndScheduleResponse: body.payAndScheduleResponse,
    maxCallDurationMinutes: body.maxCallDurationMinutes,
    tone: body.tone,
    assistantId,
  }

  await adminDb
    .from('companies')
    .update({
      settings: {
        ...(company?.settings as object ?? {}),
        vapi: validatedVapiSettings,
      },
    })
    .eq('id', profile.companyId)

  invalidateCompany(profile.companyId)
  return NextResponse.json({ ok: true, assistantId, isNew: !existingAssistantId })
}
