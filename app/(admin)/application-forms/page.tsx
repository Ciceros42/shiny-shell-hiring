import Link from 'next/link'
import { requireAdmin } from '@/lib/auth/require-admin'
import { listApplicationForms } from '@/lib/db/application-forms'
import { redirect } from 'next/navigation'

export const revalidate = 0

export default async function ApplicationFormsPage() {
  const { profile, error } = await requireAdmin()
  if (error) redirect('/login')

  const forms = await listApplicationForms(profile.companyId)

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Applications</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Reusable question sets shown on the apply page. Assign them to jobs.
          </p>
        </div>
        <Link
          href="/application-forms/new"
          className="rounded-md px-4 py-2 text-sm font-semibold text-white transition-colors"
          style={{ backgroundColor: 'var(--brand-primary)' }}
        >
          + New application
        </Link>
      </div>

      {forms.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 py-12 text-center">
          <p className="text-sm text-gray-400">No application forms yet.</p>
          <p className="text-xs text-gray-400 mt-1">Create one to add custom questions to your apply page.</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <ul className="divide-y divide-gray-100">
            {forms.map((form) => (
              <li key={form.id}>
                <Link
                  href={`/application-forms/${form.id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{form.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {form.questions.length} question{form.questions.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">Edit →</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
