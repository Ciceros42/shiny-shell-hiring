import { requireAdmin } from '@/lib/auth/require-admin'
import { listLocations } from '@/lib/db/locations'
import { redirect } from 'next/navigation'
import LocationsClient from '@/components/admin/locations/LocationsClient'

export const revalidate = 0

export default async function LocationsPage() {
  const { profile, error } = await requireAdmin()
  if (error) redirect('/login')
  if (profile.role === 'location_manager') redirect('/dashboard')

  const locations = await listLocations(profile.companyId)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ''

  return <LocationsClient initialLocations={locations} baseUrl={baseUrl} />
}
