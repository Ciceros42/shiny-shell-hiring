export default function SubmittedPage() {
  return (
    <div className="flex flex-col items-center py-12 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-green-100">
        <svg
          className="h-10 w-10 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>

      <h2 className="text-2xl font-bold text-gray-900">Check your phone!</h2>
      <p className="mt-3 max-w-sm text-gray-600">
        We just texted you a link to start your 3-minute phone screening. Tap the link when
        you&apos;re ready — it&apos;s valid for 24 hours.
      </p>

      <div className="mt-8 rounded-lg bg-blue-50 px-6 py-4 text-sm text-blue-700">
        <p className="font-medium">What happens next?</p>
        <ol className="mt-2 space-y-1 text-left text-blue-600">
          <li>1. Tap the link we texted you</li>
          <li>2. We&apos;ll call you for a quick 3-minute screening</li>
          <li>3. If you qualify, pick your interview time online</li>
        </ol>
      </div>
    </div>
  )
}
