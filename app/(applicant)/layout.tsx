import { getCompanyTheme, getCompanyThemeBySlug, getThemeByToken } from '@/lib/db/companies'
import { getLocationBySlug } from '@/lib/db/locations'
import { DEFAULT_THEME, themeToCSS, type CompanyTheme } from '@/lib/types/theme'

// Set NEXT_PUBLIC_COMPANY_LOGO_URL in your environment to display a custom logo
// on the applicant-facing apply form header. Falls back to company display name text.
const LOGO_URL = process.env.NEXT_PUBLIC_COMPANY_LOGO_URL ?? null

interface Props {
  children: React.ReactNode
  params: Promise<{ locationSlug?: string; companySlug?: string; token?: string }>
}

export default async function ApplicantLayout({ children, params }: Props) {
  const { locationSlug, companySlug, token } = await params

  let theme: CompanyTheme = DEFAULT_THEME
  try {
    if (companySlug && locationSlug) {
      const location = await getLocationBySlug(locationSlug, companySlug)
      theme = await getCompanyTheme(location.companyId)
    } else if (companySlug) {
      theme = await getCompanyThemeBySlug(companySlug)
    } else if (locationSlug) {
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
    <div className="min-h-screen" style={{ backgroundColor: '#F4F5F7' }}>
      <style>{`:root { ${themeToCSS(theme)} }`}</style>

      {/* Header */}
      <header
        className="px-4 py-4"
        style={{ backgroundColor: 'var(--brand-primary)' }}
      >
        <div className="mx-auto max-w-lg flex items-center justify-center gap-3">
          {LOGO_URL ? (
            <img
              src={LOGO_URL}
              alt={theme.displayName}
              className="h-8 w-auto object-contain"
            />
          ) : (
            <div className="text-center">
              <h1
                className="text-lg font-bold tracking-tight"
                style={{ color: 'var(--brand-primary-fg)' }}
              >
                {theme.displayName}
              </h1>
              <p className="text-[12px] mt-0.5" style={{ color: 'var(--brand-primary-muted)' }}>
                Now Hiring
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Card container */}
      <main className="mx-auto max-w-[480px] px-4 py-8">
        <div
          className="rounded-2xl px-6 py-8 shadow-sm"
          style={{ backgroundColor: '#ffffff', border: '1px solid rgba(0,0,0,0.06)' }}
        >
          {children}
        </div>
      </main>
    </div>
  )
}
