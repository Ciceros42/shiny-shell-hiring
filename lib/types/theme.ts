export interface CompanyTheme {
  displayName: string
  primaryColor: string
  primaryForeground: string
  primaryMuted: string
  fontFamily: string
  logoUrl: string | null
  borderRadius: string
}

export const DEFAULT_THEME: CompanyTheme = {
  displayName: 'Hiring Portal',
  primaryColor: '#1e3c6c',
  primaryForeground: '#ffffff',
  primaryMuted: 'rgba(255,255,255,0.7)',
  fontFamily: "'Gotham', Arial, sans-serif",
  logoUrl: null,
  borderRadius: '0.375rem',
}

export function themeToCSS(theme: CompanyTheme): string {
  return [
    `--brand-primary: ${theme.primaryColor}`,
    `--brand-primary-fg: ${theme.primaryForeground}`,
    `--brand-primary-muted: ${theme.primaryMuted}`,
    `--brand-font: ${theme.fontFamily}`,
    `--brand-radius: ${theme.borderRadius}`,
  ].join('; ')
}
