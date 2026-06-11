'use client'

import { useState } from 'react'
import { VOICE_OPTIONS, TONE_OPTIONS, type VapiAssistantConfig } from '@/lib/types/vapi'

interface Props {
  initialConfig: VapiAssistantConfig
  assistantId: string | null
}

interface FieldProps {
  label: string
  hint: string
  children: React.ReactNode
}

function Field({ label, hint, children }: FieldProps) {
  return (
    <div className="grid grid-cols-[200px_1fr] gap-x-6 py-4 border-b border-gray-100 last:border-0">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5 leading-snug">{hint}</p>
      </div>
      <div className="flex items-start">{children}</div>
    </div>
  )
}

const inputClass =
  'w-full rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0'
const textareaClass =
  'w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:border-gray-400 focus:outline-none focus:ring-0 resize-none'
const selectClass =
  'rounded-md border border-gray-200 px-3 py-1.5 text-sm text-gray-900 focus:border-gray-400 focus:outline-none bg-white'

export default function VapiAssistantConfig({ initialConfig, assistantId: initialAssistantId }: Props) {
  const [config, setConfig] = useState<VapiAssistantConfig>(initialConfig)
  const [assistantId, setAssistantId] = useState<string | null>(initialAssistantId)
  const [state, setState] = useState<'idle' | 'deploying' | 'done' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState<string | null>(null)

  function set<K extends keyof VapiAssistantConfig>(key: K, value: VapiAssistantConfig[K]) {
    setConfig((c) => ({ ...c, [key]: value }))
  }

  async function handleDeploy() {
    setState('deploying')
    setErrMsg(null)
    const res = await fetch('/api/admin/vapi/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
    })
    const json = await res.json()
    if (!res.ok) {
      setErrMsg(json.error ?? 'Deploy failed')
      setState('error')
      return
    }
    setAssistantId(json.assistantId)
    setState('done')
  }

  return (
    <div className="space-y-0">
      {/* Status bar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-2 w-2 rounded-full ${assistantId ? 'bg-green-400' : 'bg-gray-300'}`} />
          <span className="text-xs text-gray-500">
            {assistantId ? `Deployed · ID ${assistantId.slice(0, 8)}…` : 'Not yet deployed'}
          </span>
        </div>
      </div>

      {/* Persona section */}
      <div className="rounded-md border border-gray-200 bg-white divide-y divide-gray-100 mb-4">
        <div className="px-5 py-3 bg-gray-50 rounded-t-md">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Persona</p>
        </div>
        <div className="px-5">
          <Field label="Assistant name" hint="First name the caller hears. Keep it simple.">
            <input
              className={inputClass}
              value={config.assistantPersonaName}
              onChange={(e) => set('assistantPersonaName', e.target.value)}
              placeholder="Alex"
            />
          </Field>
          <Field label="Company name" hint="How the assistant refers to your business on the call.">
            <input
              className={inputClass}
              value={config.companyName}
              onChange={(e) => set('companyName', e.target.value)}
              placeholder="Shiny Shell Carwash"
            />
          </Field>
          <Field label="Position title" hint="The role being hired for, as mentioned during the call.">
            <input
              className={inputClass}
              value={config.jobTitle}
              onChange={(e) => set('jobTitle', e.target.value)}
              placeholder="Carwash Associate"
            />
          </Field>
          <Field label="Tone" hint="Sets the personality and energy of the assistant's responses.">
            <select
              className={selectClass}
              value={config.tone}
              onChange={(e) => set('tone', e.target.value as VapiAssistantConfig['tone'])}
            >
              {TONE_OPTIONS.map((o) => (
                <option key={o.id} value={o.id}>{o.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Voice section */}
      <div className="rounded-md border border-gray-200 bg-white divide-y divide-gray-100 mb-4">
        <div className="px-5 py-3 bg-gray-50 rounded-t-md">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Voice</p>
        </div>
        <div className="px-5">
          <Field label="Voice" hint="The ElevenLabs voice used for the call. Changes take effect on the next deploy.">
            <select
              className={selectClass}
              value={config.voiceId}
              onChange={(e) => set('voiceId', e.target.value)}
            >
              {VOICE_OPTIONS.map((v) => (
                <option key={v.id} value={v.id}>{v.label}</option>
              ))}
            </select>
          </Field>
        </div>
      </div>

      {/* Script section */}
      <div className="rounded-md border border-gray-200 bg-white divide-y divide-gray-100 mb-4">
        <div className="px-5 py-3 bg-gray-50 rounded-t-md">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Script</p>
        </div>
        <div className="px-5">
          <Field
            label="Opening line"
            hint="First thing the assistant says. Use {{applicantName}} to personalize."
          >
            <textarea
              className={textareaClass}
              rows={3}
              value={config.openingLine}
              onChange={(e) => set('openingLine', e.target.value)}
            />
          </Field>
          <Field
            label="Closing message"
            hint="What the assistant says after all questions are answered."
          >
            <textarea
              className={textareaClass}
              rows={3}
              value={config.closingLine}
              onChange={(e) => set('closingLine', e.target.value)}
            />
          </Field>
          <Field
            label="Pay & schedule response"
            hint="What to say if the applicant asks about pay, hours, or schedule during the call."
          >
            <textarea
              className={textareaClass}
              rows={2}
              value={config.payAndScheduleResponse}
              onChange={(e) => set('payAndScheduleResponse', e.target.value)}
            />
          </Field>
        </div>
      </div>

      {/* Call settings */}
      <div className="rounded-md border border-gray-200 bg-white divide-y divide-gray-100 mb-6">
        <div className="px-5 py-3 bg-gray-50 rounded-t-md">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Call Settings</p>
        </div>
        <div className="px-5">
          <Field label="Max call duration" hint="The assistant will wrap up before this limit.">
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={2}
                max={15}
                className={`${inputClass} w-20`}
                value={config.maxCallDurationMinutes}
                onChange={(e) => set('maxCallDurationMinutes', parseInt(e.target.value) || 5)}
              />
              <span className="text-sm text-gray-400">minutes</span>
            </div>
          </Field>
        </div>
      </div>

      {/* Deploy button */}
      <div className="flex items-center justify-between">
        <div>
          {state === 'done' && (
            <p className="text-sm text-green-700">
              {assistantId ? 'Assistant updated successfully.' : 'Assistant deployed successfully.'}
            </p>
          )}
          {state === 'error' && (
            <p className="text-sm text-red-600">{errMsg}</p>
          )}
        </div>
        <button
          onClick={handleDeploy}
          disabled={state === 'deploying' || !config.assistantPersonaName || !config.companyName}
          className="rounded-lg px-4 py-2 text-sm font-semibold disabled:opacity-50 transition-colors"
          style={{ backgroundColor: 'var(--ui-accent)', color: 'var(--ui-accent-fg)' }}
        >
          {state === 'deploying'
            ? 'Deploying…'
            : assistantId
            ? 'Redeploy Assistant'
            : 'Deploy Assistant to Vapi'}
        </button>
      </div>
    </div>
  )
}
