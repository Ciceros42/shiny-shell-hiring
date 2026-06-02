import { getCompanyTheme, getThemeByToken } from '@/lib/db/companies'
import { getLocationBySlug } from '@/lib/db/locations'
import { DEFAULT_THEME, themeToCSS, type CompanyTheme } from '@/lib/types/theme'

interface Props {
  children: React.ReactNode
  params: Promise<{ locationSlug?: string; token?: string }>
}

export default async function ApplicantLayout({ children, params }: Props) {
  const { locationSlug, token } = await params

  let theme: CompanyTheme = DEFAULT_THEME
  try {
    if (locationSlug) {
      const location = await getLocationBySlug(locationSlug)
      theme = await getCompanyTheme(location.companyId)
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
