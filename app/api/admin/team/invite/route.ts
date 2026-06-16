import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { adminDb } from '@/lib/supabase/admin'
import { getCompanyConfig } from '@/lib/db/companies'
import { sendInviteEmail } from '@/lib/email/send'

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

  // Create the auth user without sending Supabase's rate-limited invite email
  const { data: userData, error: createError } = await adminDb.auth.admin.createUser({
    email: email.trim(),
    email_confirm: true,
  })

  if (createError || !userData?.user) {
    const msg = (createError as { message?: string } | null)?.message ?? 'Failed to create user'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  const userId = userData.user.id

  // Insert profile row
  const { error: profileError } = await adminDb.from('profiles').insert({
    id: userId,
    company_id: profile.companyId,
    location_id: locationId ?? null,
    role,
    name: name.trim(),
  })

  if (profileError) {
    await adminDb.auth.admin.deleteUser(userId)
    return NextResponse.json({ error: 'Failed to create profile' }, { status: 500 })
  }

  // Generate a magic link so the new user can log in and set their password
  // This uses our own email (Resend), bypassing Supabase's rate-limited email
  const { data: linkData, error: linkError } = await adminDb.auth.admin.generateLink({
    type: 'magiclink',
    email: email.trim(),
    options: { redirectTo: `${baseUrl}/dashboard` },
  })

  if (linkError || !linkData?.properties?.action_link) {
    // User is created but we couldn't send the email — return the error but don't delete the user
    return NextResponse.json({ error: 'User created but failed to generate invite link. Ask them to use "Forgot password" to log in.' }, { status: 500 })
  }

  const { displayName: companyName } = await getCompanyConfig(profile.companyId)

  await sendInviteEmail({
    to: email.trim(),
    name: name.trim(),
    inviteUrl: linkData.properties.action_link,
    inviterCompany: companyName,
  })

  return NextResponse.json({ ok: true, userId })
}
