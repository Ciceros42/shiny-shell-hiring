import { adminDb } from '@/lib/supabase/admin'
import { CompanyTheme, DEFAULT_THEME } from '@/lib/types/theme'

// ---------------------------------------------------------------------------
// Lightweight module-scope TTL cache. Company rows (name, theme, pipeline mode,
// vapi settings) change rarely but are read on every admin navigation. Caching
// them on the (warm) server instance makes repeated navigation and the
// company-switch refresh near-instant. Values are company-level (never
// user-specific), so sharing them across requests on the same instance is safe.
// TTL bounds cross-instance staleness; explicit invalidation clears the local
// instance immediately after a mutation.
// ---------------------------------------------------------------------------
const TTL_MS = 60_000
type CacheEntry = { value: unknown; expires: number }
const store = new Map<string, CacheEntry>()

async function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key)
  if (hit && hit.expires > Date.now()) return hit.value as T
  const value = await fn()
  store.set(key, { value, expires: Date.now() + TTL_MS })
  return value
}

function clearByPrefix(prefix: string): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k)
}

/** Purge all cached reads for one company (theme, config) + the list + slug themes. */
export function invalidateCompany(companyId: string): void {
  store.delete(`theme:${companyId}`)
  store.delete(`config:${companyId}`)
  store.delete('list')
  clearByPrefix('theme-slug:')
}

/** Purge just the company list + slug themes (e.g. after creating a company). */
export function invalidateCompaniesList(): void {
  store.delete('list')
  clearByPrefix('theme-slug:')
}

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

// ---- uncached implementations -------------------------------------------------

async function _getCompanyTheme(companyId: string): Promise<CompanyTheme> {
  const { data } = await adminDb
    .from('companies')
    .select('name, settings')
    .eq('id', companyId)
    .single()

  if (!data) return DEFAULT_THEME
  return mergeTheme(data.name, ((data.settings as Record<string, unknown>)?.theme ?? {}) as Record<string, unknown>)
}

async function _getCompanyConfig(companyId: string): Promise<{
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
    (rawSettings as { pipeline_mode?: string }).pipeline_mode === 'assistant' ? 'assistant' : 'suggestion'

  return { theme, pipelineMode, displayName: theme.displayName, settings: rawSettings }
}

async function _listAllCompanies(): Promise<{ id: string; name: string; displayName: string; primaryColor: string; createdAt: string }[]> {
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

async function _getCompanyThemeBySlug(slug: string): Promise<CompanyTheme> {
  const { data } = await adminDb
    .from('companies')
    .select('name, settings')
    .eq('slug', slug)
    .single()

  if (!data) return DEFAULT_THEME
  return mergeTheme(data.name, ((data.settings as Record<string, unknown>)?.theme ?? {}) as Record<string, unknown>)
}

// ---- cached public API --------------------------------------------------------
// unstable_cache is created per-call as a closure so the dynamic id/slug becomes
// part of both the cache key (keyParts) and the invalidation tag.

export function getCompanyTheme(companyId: string): Promise<CompanyTheme> {
  return cached(`theme:${companyId}`, () => _getCompanyTheme(companyId))
}

export function getCompanyConfig(companyId: string) {
  return cached(`config:${companyId}`, () => _getCompanyConfig(companyId))
}

export async function getCompanyPipelineMode(companyId: string): Promise<'suggestion' | 'assistant'> {
  const { pipelineMode } = await getCompanyConfig(companyId)
  return pipelineMode
}

export function listAllCompanies(): Promise<{ id: string; name: string; displayName: string; primaryColor: string; createdAt: string }[]> {
  return cached('list', () => _listAllCompanies())
}

export function getCompanyThemeBySlug(slug: string): Promise<CompanyTheme> {
  return cached(`theme-slug:${slug}`, () => _getCompanyThemeBySlug(slug))
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
  invalidateCompaniesList()
  return data.id
}

/** Returns true if the given id maps to a real company row. Used to validate the dev company-switch cookie. */
export async function companyExists(companyId: string): Promise<boolean> {
  const { data } = await adminDb.from('companies').select('id').eq('id', companyId).maybeSingle()
  return !!data
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
