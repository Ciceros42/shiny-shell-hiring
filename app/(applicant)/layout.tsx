export default function ApplicantLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="bg-blue-600 px-4 py-4 text-center">
        <h1 className="text-xl font-bold text-white">Shiny Shell Carwash</h1>
        <p className="text-sm text-blue-100">Now Hiring</p>
      </header>
      <main className="mx-auto max-w-lg px-4 py-8">{children}</main>
    </div>
  )
}
