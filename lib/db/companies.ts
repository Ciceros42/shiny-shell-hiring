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

export async function getCompanyPipelineMode(companyId: string): Promise<'suggestion' | 'assistant'> {
  const { data } = await adminDb
    .from('companies')
    .select('settings')
    .eq('id', companyId)
    .single()

  const mode = (data?.settings as Record<string, unknown> | null)?.pipeline_mode
  return mode === 'assistant' ? 'assistant' : 'suggestion'
}

export async function getCompanyConfig(companyId: string): Promise<{
  theme: CompanyTheme
  pipelineMode: 'suggestion' | 'assistant'
  displayName: string
  settings: Record<string, unknown>
}> {
  const { data } = await adminDb
    .from('companies')
    .select('name, settings')
    .eq('id', companyId)
    .single()

  if (!data) {
    return { theme: DEFAULT_THEME, pipelineMode: 'suggestion', displayName: '', settings: {} }
  }

  const rawSettings = (data.settings as Record<string, unknown>) ?? {}
  const theme = mergeTheme(data.name, (rawSettings.theme ?? {}) as Record<string, unknown>)
  const pipelineMode: 'suggestion' | 'assistant' =
    (data.settings as any)?.pipeline_mode === 'assistant' ? 'assistant' : 'suggestion'

  return { theme, pipelineMode, displayName: theme.displayName, settings: rawSettings }
}

export async function listAllCompanies(): Promise<{ id: string; name: string; displayName: string; primaryColor: string; createdAt: string }[]> {
  const { data } = await adminDb.from('companies').select('id, name, settings, created_at').order('created_at', { ascending: true })
  return (data ?? []).map((row) => {
    const theme = ((row.settings as Record<string, unknown>)?.theme ?? {}) as Record<string, unknown>
    return {
      id: row.id,
      name: row.name,
      displayName: (theme.displayName as string) ?? row.name,
      primaryColor: (theme.primaryColor as string) ?? DEFAULT_THEME.primaryColor,
      createdAt: row.created_at,
    }
  })
}

export async function createCompany(name: string, displayName: string, brandColor: string): Promise<string> {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const settings = { theme: { displayName, primaryColor: brandColor, primaryForeground: '#ffffff', primaryMuted: 'rgba(255,255,255,0.7)' } }
  const { data, error } = await adminDb
    .from('companies')
    .insert({ name, slug, is_active: true, settings })
    .select('id')
    .single()
  if (error || !data) throw new Error(error?.message ?? 'Failed to create company')
  return data.id
}

export async function getCompanyThemeBySlug(slug: string): Promise<CompanyTheme> {
  const { data } = await adminDb
    .from('companies')
    .select('name, settings')
    .eq('slug', slug)
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
