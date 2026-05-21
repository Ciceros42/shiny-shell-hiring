import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export const revalidate = 0

export default async function QuestionsPage() {
  const supabase = await createClient()

  const { data: sets } = await supabase
    .from('question_sets')
    .select('id, job_title, pass_threshold, is_active, created_at, questions(id)')
    .order('created_at', { ascending: false })

  type SetRow = {
    id: string
    job_title: string
    pass_threshold: number
    is_active: boolean
    created_at: string
    questions: { id: string }[]
  }

  const rows = (sets ?? []) as unknown as SetRow[]

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Question Sets</h1>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        {rows.length === 0 && (
          <p className="px-6 py-12 text-center text-sm text-gray-400">No question sets found.</p>
        )}
        <ul className="divide-y divide-gray-100">
          {rows.map((set) => (
            <li key={set.id}>
              <Link
                href={`/admin/questions/${set.id}`}
                className="flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-900">{set.job_title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {set.questions?.length ?? 0} questions · pass at {set.pass_threshold}%
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {set.is_active && (
                    <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      active
                    </span>
                  )}
                  <span className="text-gray-400 text-sm">→</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
