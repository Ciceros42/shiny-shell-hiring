import { requireAdmin } from '@/lib/auth/require-admin'
import { getApplicationForm, createApplicationForm } from '@/lib/db/application-forms'
import { redirect } from 'next/navigation'
import FormEditor from '@/components/admin/application-forms/FormEditor'

export const revalidate = 0

interface Props { params: Promise<{ formId: string }> }

export default async function ApplicationFormPage({ params }: Props) {
  const { formId } = await params
  const { profile, error } = await requireAdmin()
  if (error) redirect('/login')

  let form
  if (formId === 'new') {
    // Create a new blank form immediately and redirect to it
    const created = await createApplicationForm(profile.companyId, 'Untitled Application')
    redirect(`/application-forms/${created.id}`)
  } else {
    form = await getApplicationForm(formId, profile.companyId)
    if (!form) redirect('/application-forms')
  }

  return (
    <div className="p-8 max-w-3xl">
      <FormEditor form={form!} />
    </div>
  )
}
