import { getCompanyTheme, getCompanyThemeBySlug, getThemeByToken } from '@/lib/db/companies'
import { getLocationBySlug } from '@/lib/db/locations'
import { DEFAULT_THEME, themeToCSS, type CompanyTheme } from '@/lib/types/theme'

interface Props {
  children: React.ReactNode
  params: Promise<{ locationSlug?: string; companySlug?: string; token?: string }>
}

export default async function ApplicantLayout({ children, params }: Props) {
  const { locationSlug, companySlug, token } = await params

  let theme: CompanyTheme = DEFAULT_THEME
  try {
    if (companySlug && locationSlug) {
      // 3-segment route: /apply/companySlug/locationSlug/jobSlug
      const location = await getLocationBySlug(locationSlug, companySlug)
      theme = await getCompanyTheme(location.companyId)
    } else if (companySlug) {
      // 2-segment route (landing page): /apply/companySlug/locationSlug
      // companySlug param is present from [companySlug] folder
      theme = await getCompanyThemeBySlug(companySlug)
    } else if (locationSlug) {
      // Old single-segment: /apply/locationSlug — try as location slug first, fallback to company slug
      try {
        const location = await getLocationBySlug(locationSlug)
        theme = await getCompanyTheme(location.companyId)
      } catch {
        theme = await getCompanyThemeBySlug(locationSlug)
      }
    } else if (token) {
      theme = await getThemeByToken(token)
    }
  } catch {}

  return (
    <div className="min-h-screen bg-white">
      <style>{`:root { ${themeToCSS(theme)} }`}</style>
      <header className="px-4 py-4 text-center" style={{ backgroundColor: 'var(--brand-primary)' }}>
        <h1 className="text-xl font-bold" style={{ color: 'var(--brand-primary-fg)' }}>
          {theme.displayName}
        </h1>
        <p className="text-sm" style={{ color: 'var(--brand-primary-muted)' }}>
          Now Hiring
        </p>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">{children}</main>
    </div>
  )
}
