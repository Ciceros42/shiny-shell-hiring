'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Role = 'dev' | 'company_admin' | 'location_manager'

const NAV_LINKS: { href: string; label: string; minRole?: Role }[] = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/applicants', label: 'Applicants' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/application-forms', label: 'Applications' },
  { href: '/questions', label: 'Questions' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/locations', label: 'Locations', minRole: 'company_admin' },
  { href: '/companies', label: 'Companies', minRole: 'dev' },
  { href: '/settings', label: 'Settings' },
]

const ROLE_RANK: Record<Role, number> = { location_manager: 0, company_admin: 1, dev: 2 }

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

  return (
    <nav className="w-56 bg-white border-r border-gray-200 flex flex-col shrink-0">
      <div className="px-4 py-5 border-b border-gray-200">
        <p className="text-sm font-bold text-gray-900">{companyName}</p>
        {role === 'dev' && companies.length > 1 ? (
          <select
            value={activeCompanyId ?? ''}
            onChange={(e) => switchCompany(e.target.value)}
            className="mt-1 w-full text-xs text-gray-500 bg-transparent border-none outline-none cursor-pointer"
          >
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.displayName}</option>
            ))}
          </select>
        ) : (
          <p className="text-xs text-gray-500">Hiring Portal</p>
        )}
      </div>

      <ul className="flex-1 py-3 space-y-0.5 px-2">
        {visibleLinks.map(({ href, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <li key={href}>
              <Link
                href={href}
                className={`block rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  active ? '' : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                }`}
                style={
                  active
                    ? {
                        backgroundColor: 'color-mix(in srgb, var(--brand-primary) 12%, transparent)',
                        color: 'var(--brand-primary)',
                      }
                    : undefined
                }
              >
                {label}
              </Link>
            </li>
          )
        })}
      </ul>

      <div className="px-2 py-3 border-t border-gray-200">
        <button
          onClick={handleSignOut}
          className="w-full rounded-md px-3 py-2 text-sm font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors text-left"
        >
          Sign out
        </button>
      </div>
    </nav>
  )
}
