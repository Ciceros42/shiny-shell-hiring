import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { adminDb } from '@/lib/supabase/admin'
import { getCompanyTheme } from '@/lib/db/companies'
import { DEFAULT_THEME, themeToCSS } from '@/lib/types/theme'
import AdminNav from '@/components/admin/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  let theme = DEFAULT_THEME
  try {
    const { data: profile } = await adminDb
      .from('profiles')
      .select('company_id')
      .eq('id', user.id)
      .single()
    if (profile?.company_id) {
      theme = await getCompanyTheme(profile.company_id)
    }
  } catch {}

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      <style>{`:root { ${themeToCSS(theme)} }`}</style>
      <AdminNav companyName={theme.displayName} />
      <main className="flex-1 overflow-auto flex flex-col">{children}</main>
    </div>
  )
}
