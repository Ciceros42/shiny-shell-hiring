import { createClient } from '@/lib/supabase/server'
import { adminDb } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export interface AdminProfile {
  role: 'dev' | 'company_admin' | 'location_manager'
  companyId: string
  locationId: string | null
}

export async function requireAdmin(): Promise<
  | { user: { id: string }; profile: AdminProfile; error: null }
  | { user: null; profile: null; error: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await adminDb
    .from('profiles')
    .select('role, company_id, location_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['dev', 'company_admin', 'location_manager'].includes(profile.role as string)) {
    return { user: null, profile: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  // Dev users use the active_company_id cookie to switch company context
  let companyId = profile.company_id as string
  if (profile.role === 'dev') {
    const cookieStore = await cookies()
    const active = cookieStore.get('active_company_id')?.value
    if (active) companyId = active
  }

  return {
    user: { id: user.id },
    profile: {
      role: profile.role as AdminProfile['role'],
      companyId,
      locationId: profile.location_id as string | null,
    },
    error: null,
  }
}
