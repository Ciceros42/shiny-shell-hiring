import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'

export async function POST(req: Request) {
  const { error, profile } = await requireAdmin()
  if (error) return error
  if (profile.role === 'location_manager') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { name, email, role, locationId } = await req.json()

  if (!name?.trim() || !email?.trim()) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 422 })
  }
  if (!['company_admin', 'location_manager'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 422 })
  }
  if (role === 'location_manager' && !locationId) {
    return NextResponse.json({ error: 'Location is required for location managers' }, { status: 422 })
  }

  // Verify the location belongs to this company if provided
  if (locationId) {
    const { data: loc } = await adminDb
      .from('locations')
      .select('id')
      .eq('id', locationId)
      .eq('company_id', profile.companyId)
      .maybeSingle()
    if (!loc) return NextResponse.json({ error: 'Location not found' }, { status: 404 })
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000'

  // Create auth user and send invite email
  const { data: inviteData, error: inviteError } = await adminDb.auth.admin.inviteUserByEmail(
    email.trim(),
    { redirectTo: `${baseUrl}/dashboard` }
  )

  if (inviteError || !inviteData?.user) {
    const msg = (inviteError as { message?: string } | null)?.message ?? 'Failed to send invite'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const userId = inviteData.user.id

  // Insert profile row immediately so the user has access as soon as they accept
  const { error: profileError } = await adminDb.from('profiles').insert({
    id: userId,
    company_id: profile.companyId,
    location_id: locationId ?? null,
    role,
    name: name.trim(),
  })

  if (profileError) {
    // Roll back the auth user to avoid orphaned accounts
    await adminDb.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, userId })
}
