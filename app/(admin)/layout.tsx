import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { adminDb } from '@/lib/supabase/admin'
import { getCompanyTheme, listAllCompanies } from '@/lib/db/companies'
import { DEFAULT_THEME, themeToCSS } from '@/lib/types/theme'
import AdminNav from '@/components/admin/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let theme = DEFAULT_THEME
  let role: 'dev' | 'company_admin' | 'location_manager' = 'location_manager'
  let activeCompanyId: string | null = null
  let companies: { id: string; name: string; displayName: string }[] = []

  try {
    const { data: profile } = await adminDb
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single()

    if (profile?.role) role = profile.role as 'dev' | 'company_admin' | 'location_manager'

    if ((role as string) === 'dev') {
      const cookieStore = await cookies()
      activeCompanyId = cookieStore.get('active_company_id')?.value ?? profile?.company_id ?? null
      companies = await listAllCompanies()
      if (activeCompanyId) theme = await getCompanyTheme(activeCompanyId)
    } else if (profile?.company_id) {
      activeCompanyId = profile.company_id
      theme = await getCompanyTheme(profile.company_id)
    }
  } catch {}

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      <style>{`:root { ${themeToCSS(theme)} }`}</style>
      <AdminNav
        companyName={theme.displayName}
        role={role}
        companies={companies}
        activeCompanyId={activeCompanyId}
      />
      <main className="flex-1 overflow-auto flex flex-col">{children}</main>
    </div>
  )
}
