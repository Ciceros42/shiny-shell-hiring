'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Member = {
  id: string
  name: string
  email: string
  role: 'company_admin' | 'location_manager'
  phone: string | null
  locationId: string | null
  locationName: string | null
}

type Location = { id: string; name: string }

const ROLE_LABEL: Record<string, string> = {
  company_admin: 'Admin',
  location_manager: 'Location Manager',
}

const ROLE_STYLE: Record<string, string> = {
  company_admin: 'bg-purple-50 text-purple-700',
  location_manager: 'bg-blue-50 text-blue-700',
}

export default function TeamClient({
  members: initialMembers,
  locations,
}: {
  members: Member[]
  locations: Location[]
  currentUserId: string
}) {
  const router = useRouter()
  const [members, setMembers] = useState(initialMembers)
  const [showInvite, setShowInvite] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'company_admin' | 'location_manager'>('location_manager')
  const [locationId, setLocationId] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState<string | null>(null)
  const [inviteSuccess, setInviteSuccess] = useState(false)
  const [removingId, setRemovingId] = useState<string | null>(null)

  const inputClass = 'w-full rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none'

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteError(null)
    setInviting(true)

    const res = await fetch('/api/admin/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        email: email.trim(),
        role,
        locationId: role === 'location_manager' ? locationId : null,
      }),
    })

    const json = await res.json()
    setInviting(false)

    if (!res.ok) {
      setInviteError(json.error ?? 'Failed to send invite')
      return
    }

    setInviteSuccess(true)
    setName('')
    setEmail('')
    setRole('location_manager')
    setLocationId('')
    router.refresh()
    // Reload members list after a brief delay (server revalidate)
    setTimeout(() => {
      fetch('/api/admin/team/invite') // no-op GET not implemented; we just reload
        .catch(() => {})
      router.refresh()
    }, 800)
  }

  async function handleRemove(member: Member) {
    if (!confirm(`Remove ${member.name} (${member.email}) from your team? They will lose access immediately.`)) return
    setRemovingId(member.id)
    const res = await fetch(`/api/admin/team/${member.id}`, { method: 'DELETE' })
    if (res.ok) {
      setMembers((prev) => prev.filter((m) => m.id !== member.id))
    }
    setRemovingId(null)
  }

  return (
    <div className="space-y-5">
      {/* Member list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {members.length === 0 && (
          <p className="px-6 py-10 text-center text-sm text-gray-400">No team members yet.</p>
        )}
        <ul className="divide-y divide-gray-100">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between px-5 py-4 gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-sm font-medium text-gray-900">{member.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_STYLE[member.role] ?? ''}`}>
                    {ROLE_LABEL[member.role] ?? member.role}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {member.email}
                  {member.locationName && <> · {member.locationName}</>}
                </p>
              </div>
              <button
                onClick={() => handleRemove(member)}
                disabled={removingId === member.id}
                className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded hover:bg-red-50 disabled:opacity-40 shrink-0"
              >
                {removingId === member.id ? 'Removing…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Invite form */}
      {!showInvite && !inviteSuccess && (
        <button
          onClick={() => setShowInvite(true)}
          className="rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          + Invite team member
        </button>
      )}

      {inviteSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 flex items-center justify-between">
          <p className="text-sm text-green-800 font-medium">Invite sent! They'll receive an email to set their password and log in.</p>
          <button
            onClick={() => { setInviteSuccess(false); setShowInvite(true) }}
            className="text-xs text-green-700 underline ml-4 shrink-0"
          >
            Invite another
          </button>
        </div>
      )}

      {showInvite && !inviteSuccess && (
        <form
          onSubmit={handleInvite}
          className="bg-white rounded-lg border border-gray-200 p-5 space-y-4"
        >
          <h3 className="text-sm font-semibold text-gray-900">Invite a team member</h3>
          <p className="text-xs text-gray-400 -mt-2">
            They'll receive an email with a link to set their password and access the portal.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full name *</label>
              <input
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Jane Smith"
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
              <input
                type="email"
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@example.com"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Role *</label>
            <div className="flex gap-3">
              {(['location_manager', 'company_admin'] as const).map((r) => (
                <label
                  key={r}
                  className={`flex-1 flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer transition-colors text-sm ${
                    role === r ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="role"
                    value={r}
                    checked={role === r}
                    onChange={() => setRole(r)}
                    className="mt-0.5 accent-blue-600 shrink-0"
                  />
                  <div>
                    <p className="font-medium text-gray-900">{ROLE_LABEL[r]}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {r === 'company_admin'
                        ? 'Full access to all locations and settings.'
                        : 'Access to one location — calendar, applicants, slots.'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {role === 'location_manager' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Location *</label>
              {locations.length === 0 ? (
                <p className="text-sm text-amber-600">No locations exist yet. Create a location first.</p>
              ) : (
                <select
                  className={inputClass + ' bg-white'}
                  value={locationId}
                  onChange={(e) => setLocationId(e.target.value)}
                  required
                >
                  <option value="">— Select a location —</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {inviteError && (
            <p className="text-sm text-red-600 bg-red-50 rounded-md px-3 py-2">{inviteError}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={inviting || (role === 'location_manager' && !locationId)}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 transition-colors"
              style={{ backgroundColor: 'var(--brand-primary)' }}
            >
              {inviting ? 'Sending invite…' : 'Send invite'}
            </button>
            <button
              type="button"
              onClick={() => { setShowInvite(false); setInviteError(null) }}
              className="rounded-md px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
