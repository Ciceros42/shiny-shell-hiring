'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const NAV_LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/applicants', label: 'Applicants' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/questions', label: 'Questions' },
  { href: '/analytics', label: 'Analytics' },
  { href: '/settings', label: 'Settings' },
]

interface Props {
  companyName: string
}

export default function AdminNav({ companyName }: Props) {
  const pathname = usePathname()
  const router = useRouter()

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
        <p className="text-xs text-gray-500">Hiring Portal</p>
      </div>

      <ul className="flex-1 py-3 space-y-0.5 px-2">
        {NAV_LINKS.map(({ href, label }) => {
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
