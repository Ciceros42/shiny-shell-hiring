export default function ConfirmedPage() {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <svg className="h-10 w-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-gray-900">Interview confirmed!</h2>
      <p className="mt-3 max-w-sm text-gray-600">
        You&apos;ll receive a text confirmation shortly with your interview time and location.
      </p>

      <div className="mt-8 rounded-lg bg-blue-50 px-6 py-4 text-sm text-blue-700 text-left w-full max-w-sm">
        <p className="font-medium">Before your interview:</p>
        <ul className="mt-2 space-y-1 text-blue-600">
          <li>• Plan to arrive 5 minutes early</li>
          <li>• Bring a valid ID</li>
          <li>• Reply R to your confirmation text if you need to reschedule</li>
        </ul>
      </div>
    </div>
  )
}
