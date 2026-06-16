import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import TeamClient from '@/components/admin/team/TeamClient'

export const revalidate = 0

export default async function TeamPage() {
  const { profile, error } = await requireAdmin()
  if (error) redirect('/login')
  if (profile.role === 'location_manager') redirect('/dashboard')
  const { companyId } = profile

  // Fetch all profiles for this company
  const { data: profileRows } = await adminDb
    .from('profiles')
    .select('id, role, name, phone, location_id, locations(name)')
    .eq('company_id', companyId)
    .order('name')

  // Fetch emails from auth.users for each profile
  const { data: { users: authUsers } } = await adminDb.auth.admin.listUsers({ perPage: 200 })
  const emailMap: Record<string, string> = {}
  for (const u of authUsers ?? []) {
    if (u.email) emailMap[u.id] = u.email
  }

  // Fetch all locations for the location picker
  const { data: locations } = await adminDb
    .from('locations')
    .select('id, name')
    .eq('company_id', companyId)
    .order('name')

  type ProfileRow = {
    id: string
    role: string
    name: string
    phone: string | null
    location_id: string | null
    locations: { name: string } | null
  }

  const members = ((profileRows ?? []) as unknown as ProfileRow[]).map((p) => ({
    id: p.id,
    name: p.name,
    email: emailMap[p.id] ?? '—',
    role: p.role as 'company_admin' | 'location_manager',
    phone: p.phone,
    locationId: p.location_id,
    locationName: (p.locations as { name: string } | null)?.name ?? null,
  }))

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team</h1>
        <p className="text-sm text-gray-500 mt-0.5">Manage admins and location managers for your account.</p>
      </div>
      <TeamClient
        members={members}
        locations={(locations ?? []) as { id: string; name: string }[]}
        currentUserId={profile.role === 'dev' ? '' : ''}
      />
    </div>
  )
}
