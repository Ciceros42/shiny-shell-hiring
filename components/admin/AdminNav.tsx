'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

// Set NEXT_PUBLIC_COMPANY_LOGO_URL in your environment (.env.local or Vercel dashboard)
// to display a custom logo in the sidebar and on the applicant apply form header.
// If not set, the company display name initials are shown as a colored avatar.
const LOGO_URL = process.env.NEXT_PUBLIC_COMPANY_LOGO_URL ?? null

type Role = 'dev' | 'company_admin' | 'location_manager'

const NAV_LINKS: { href: string; label: string; icon: string; minRole?: Role }[] = [
  { href: '/dashboard',          label: 'Dashboard',    icon: 'dashboard' },
  { href: '/pipeline',           label: 'Pipeline',     icon: 'pipeline' },
  { href: '/applicants',         label: 'Applicants',   icon: 'applicants' },
  { href: '/calendar',           label: 'Calendar',     icon: 'calendar' },
  { href: '/jobs',               label: 'Jobs',         icon: 'jobs' },
  { href: '/application-forms',  label: 'Applications', icon: 'forms' },
  { href: '/questions',          label: 'Questions',    icon: 'questions' },
  { href: '/analytics',          label: 'Analytics',    icon: 'analytics' },
  { href: '/team',               label: 'Team',         icon: 'team',      minRole: 'company_admin' },
  { href: '/locations',          label: 'Locations',    icon: 'locations', minRole: 'company_admin' },
  { href: '/companies',          label: 'Companies',    icon: 'companies', minRole: 'dev' },
  { href: '/settings',           label: 'Settings',     icon: 'settings' },
]

const ROLE_RANK: Record<Role, number> = { location_manager: 0, company_admin: 1, dev: 2 }

// Heroicons outline paths (24×24 viewBox, strokeLinecap=round, strokeLinejoin=round)
const ICONS: Record<string, string> = {
  dashboard:  'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6',
  pipeline:   'M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2',
  applicants: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  calendar:   'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  jobs:       'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  forms:      'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
  questions:  'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  analytics:  'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  team:       'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
  locations:  'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0zM15 11a3 3 0 11-6 0 3 3 0 016 0z',
  companies:  'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-2 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4',
  settings:   'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z',
  signout:    'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1',
}

function NavIcon({ name }: { name: string }) {
  const d = ICONS[name] ?? ''
  return (
    <svg
      width="15" height="15" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round"
      className="shrink-0" aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}

const PALETTE_ACCENTS: Record<string, string> = {
  '1': '#5B5BD6',
  '2': '#059669',
  '3': '#D97706',
}

interface Props {
  companyName: string
  role: Role
  companies?: { id: string; name: string; displayName: string }[]
  activeCompanyId?: string | null
}

export default function AdminNav({ companyName, role, companies = [], activeCompanyId }: Props) {
  const visibleLinks = NAV_LINKS.filter(
    (l) => !l.minRole || ROLE_RANK[role] >= ROLE_RANK[l.minRole]
  )
  const pathname = usePathname()
  const router = useRouter()
  const [currentTheme, setCurrentTheme] = useState('1')

  useEffect(() => {
    const stored = localStorage.getItem('ui-theme') ?? '1'
    setCurrentTheme(stored)
  }, [])

  function switchTheme(t: string) {
    document.documentElement.dataset.theme = t
    localStorage.setItem('ui-theme', t)
    setCurrentTheme(t)
  }

  async function switchCompany(companyId: string) {
    await fetch('/api/admin/switch-company', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    })
    router.refresh()
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = companyName
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('')

  return (
    <nav
      className="w-[220px] flex flex-col shrink-0"
      style={{
        backgroundColor: 'var(--ui-sidebar-bg)',
        borderRight: '1px solid var(--ui-sidebar-divider)',
      }}
    >
      {/* Logo / identity */}
      <div
        className="px-4 py-[14px] flex items-center gap-3"
        style={{ borderBottom: '1px solid var(--ui-sidebar-divider)' }}
      >
        {LOGO_URL ? (
          <img src={LOGO_URL} alt={companyName} className="h-7 w-7 rounded object-contain shrink-0" />
        ) : (
          <div
            className="h-7 w-7 rounded flex items-center justify-center text-[11px] font-bold shrink-0"
            style={{ backgroundColor: 'var(--ui-accent)', color: 'var(--ui-accent-fg)' }}
          >
            {initials || '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {role === 'dev' && companies.length > 1 ? (
            <select
              value={activeCompanyId ?? ''}
              onChange={(e) => switchCompany(e.target.value)}
              className="w-full bg-transparent text-[13px] font-semibold focus:outline-none cursor-pointer"
              style={{ color: 'var(--ui-sidebar-active-text)' }}
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id} className="bg-gray-900 text-white">
                  {c.displayName}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--ui-sidebar-active-text)' }}>
              {companyName}
            </p>
          )}
          <p className="text-[11px]" style={{ color: 'var(--ui-sidebar-text)' }}>Hiring Portal</p>
        </div>
      </div>

      {/* Nav links */}
      <ul className="flex-1 py-2.5 px-2 space-y-px overflow-y-auto">
        {visibleLinks.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <li key={href}>
              <Link
                href={href}
                className="group flex items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100"
                style={
                  active
                    ? {
                        backgroundColor: 'var(--ui-sidebar-active-bg)',
                        color: 'var(--ui-sidebar-active-text)',
                        boxShadow: 'inset 2px 0 0 var(--ui-sidebar-active-border)',
                      }
                    : { color: 'var(--ui-sidebar-text)' }
                }
              >
                <span
                  className="transition-colors duration-100"
                  style={active ? { color: 'var(--ui-sidebar-active-border)' } : {}}
                >
                  <NavIcon name={icon} />
                </span>
                {label}
              </Link>
            </li>
          )
        })}
      </ul>

      {/* Footer */}
      <div
        className="px-2 py-3 space-y-1"
        style={{ borderTop: '1px solid var(--ui-sidebar-divider)' }}
      >
        {/* Palette switcher */}
        <div className="flex items-center gap-2 px-2.5 py-1.5">
          <span className="text-[11px] mr-1" style={{ color: 'var(--ui-sidebar-text)' }}>Theme</span>
          {Object.entries(PALETTE_ACCENTS).map(([t, color]) => (
            <button
              key={t}
              onClick={() => switchTheme(t)}
              title={`Palette ${t}`}
              className="h-3 w-3 rounded-full transition-transform duration-150 hover:scale-125"
              style={{
                backgroundColor: color,
                boxShadow:
                  currentTheme === t
                    ? `0 0 0 2px var(--ui-sidebar-bg), 0 0 0 3.5px ${color}`
                    : 'none',
              }}
            />
          ))}
        </div>

        <button
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] text-[13px] font-medium transition-colors duration-100 hover:text-white"
          style={{ color: 'var(--ui-sidebar-text)' }}
        >
          <NavIcon name="signout" />
          Sign out
        </button>
      </div>
    </nav>
  )
}
