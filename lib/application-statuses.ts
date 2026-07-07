// Single source of truth for application status constants.
// Import from here rather than defining locally in components or route handlers.

export const ACTIVE_PIPELINE_STATUSES = [
  'applied', 'sms_sent', 'screen_link_clicked', 'screening',
  'screen_complete', 'passed', 'scheduled', 'interviewed',
] as const

export const STATUS_LABEL: Record<string, string> = {
  applied: 'Applied',
  sms_sent: 'SMS sent',
  screen_link_clicked: 'Link clicked',
  screening: 'Screening',
  screen_complete: 'Screened',
  passed: 'Passed',
  failed: 'Failed',
  scheduled: 'Scheduled',
  interviewed: 'Interviewed',
  hired: 'Hired',
  no_show: 'No show',
  rejected: 'Rejected',
  dismissed: 'Dismissed',
}

export const STATUS_COLOR: Record<string, string> = {
  hired: 'bg-green-100 text-green-700',
  passed: 'bg-emerald-50 text-emerald-700',
  scheduled: 'bg-teal-50 text-teal-700',
  interviewed: 'bg-purple-50 text-purple-700',
  screen_complete: 'bg-amber-50 text-amber-700',
  failed: 'bg-gray-100 text-gray-500',
  rejected: 'bg-gray-100 text-gray-500',
  no_show: 'bg-gray-100 text-gray-500',
  dismissed: 'bg-gray-100 text-gray-500',
}
