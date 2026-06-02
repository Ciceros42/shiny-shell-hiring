import { adminDb } from '@/lib/supabase/admin'
import { CompanyTheme, DEFAULT_THEME } from '@/lib/types/theme'

function mergeTheme(name: string, stored: Record<string, unknown>): CompanyTheme {
  return {
    displayName: (stored.displayName as string) ?? name,
    primaryColor: (stored.primaryColor as string) ?? DEFAULT_THEME.primaryColor,
    primaryForeground: (stored.primaryForeground as string) ?? DEFAULT_THEME.primaryForeground,
    primaryMuted: (stored.primaryMuted as string) ?? DEFAULT_THEME.primaryMuted,
    fontFamily: (stored.fontFamily as string) ?? DEFAULT_THEME.fontFamily,
    logoUrl: (stored.logoUrl as string | null) ?? null,
    borderRadius: (stored.borderRadius as string) ?? DEFAULT_THEME.borderRadius,
  }
}

export async function getCompanyTheme(companyId: string): Promise<CompanyTheme> {
  const { data } = await adminDb
    .from('companies')
    .select('name, settings')
    .eq('id', companyId)
    .single()

  if (!data) return DEFAULT_THEME
  return mergeTheme(data.name, ((data.settings as Record<string, unknown>)?.theme ?? {}) as Record<string, unknown>)
}

export async function getThemeByToken(token: string): Promise<CompanyTheme> {
  const { data: link } = await adminDb
    .from('magic_links')
    .select('application_id')
    .eq('token', token)
    .single()

  if (!link) return DEFAULT_THEME

  const { data: app } = await adminDb
    .from('applications')
    .select('company_id')
    .eq('id', link.application_id)
    .single()

  if (!app) return DEFAULT_THEME
  return getCompanyTheme(app.company_id)
}
