import { redirect } from 'next/navigation'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getCompanyTheme, listAllCompanies } from '@/lib/db/companies'
import { DEFAULT_THEME, themeToCSS } from '@/lib/types/theme'
import AdminNav from '@/components/admin/AdminNav'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Reuses the cached requireAdmin() — the page's own requireAdmin() call in the
  // same request returns this identical result with no extra auth/DB round-trips.
  // requireAdmin already resolves the dev active_company_id cookie into companyId.
  const { profile, error } = await requireAdmin()
  if (error) {
    // 5xx = transient lookup failure → let the error boundary show a retry UI
    // rather than bouncing a valid user to /login. 401/403 → genuine auth failure.
    if (error.status >= 500) throw new Error('Admin auth check failed — please retry')
    redirect('/login')
  }
  if (!profile) redirect('/login')

  const { role, companyId } = profile

  let theme = DEFAULT_THEME
  let companies: { id: string; name: string; displayName: string }[] = []

  try {
    if (role === 'dev') {
      companies = await listAllCompanies()
      if (companyId) theme = await getCompanyTheme(companyId)
    } else if (companyId) {
      theme = await getCompanyTheme(companyId)
    }
  } catch {}

  return (
    <div className="h-screen flex overflow-hidden" style={{ backgroundColor: 'var(--ui-content-bg)' }}>
      <style>{`:root { ${themeToCSS(theme)} }`}</style>
      <AdminNav
        companyName={theme.displayName}
        role={role}
        companies={companies}
        activeCompanyId={companyId}
      />
      <main className="flex-1 overflow-auto flex flex-col">{children}</main>
    </div>
  )
}
