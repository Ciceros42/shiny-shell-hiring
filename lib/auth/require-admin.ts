import { createClient } from '@/lib/supabase/server'
import { adminDb } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { cache } from 'react'

export interface AdminProfile {
  role: 'dev' | 'company_admin' | 'location_manager'
  companyId: string
  locationId: string | null
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// PostgREST returns this code from .single() when zero rows match — i.e. the user
// genuinely has no profile. Any other error code is a transient DB failure.
const NO_ROWS = 'PGRST116'

type ProfileRow = { role: string; company_id: string; location_id: string | null }

// Fetch the profile with a single retry on transient failure. A "no rows" result
// is definitive (not retried); a connection/timeout error is retried once.
async function fetchProfile(userId: string): Promise<{ data: ProfileRow | null; transientError: boolean }> {
  let transient = false
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await adminDb
      .from('profiles')
      .select('role, company_id, location_id')
      .eq('id', userId)
      .single()

    if (!error) return { data: data as ProfileRow, transientError: false }
    if ((error as { code?: string }).code === NO_ROWS) return { data: null, transientError: false }
    transient = true // retry
  }
  return { data: null, transientError: transient }
}

// Wrapped in React cache() so that within a single request the auth round-trip
// (supabase.auth.getUser) + profiles lookup runs exactly once — even though the
// admin layout, the page, and any nested server helpers all call requireAdmin().
export const requireAdmin = cache(async (): Promise<
  | { user: { id: string }; profile: AdminProfile; error: null }
  | { user: null; profile: null; error: NextResponse }
> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile, transientError } = await fetchProfile(user.id)

  // Transient DB failure (NOT "no such profile") → 503 so the caller can retry and
  // the admin layout can show a recoverable error instead of logging the user out.
  if (transientError) {
    return { user: null, profile: null, error: NextResponse.json({ error: 'Profile lookup failed, please retry' }, { status: 503 }) }
  }

  if (!profile || !['dev', 'company_admin', 'location_manager'].includes(profile.role)) {
    return { user: null, profile: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  // Dev users switch company context via the active_company_id cookie. Only honor a
  // well-formed UUID; a stale/garbage value is ignored so we never silently scope
  // every query to a non-existent company (which would render empty pages).
  let companyId = profile.company_id
  if (profile.role === 'dev') {
    const cookieStore = await cookies()
    const active = cookieStore.get('active_company_id')?.value
    if (active && UUID_RE.test(active)) companyId = active
  }

  return {
    user: { id: user.id },
    profile: {
      role: profile.role as AdminProfile['role'],
      companyId,
      locationId: profile.location_id,
    },
    error: null,
  }
})
