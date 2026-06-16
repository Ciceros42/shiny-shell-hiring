'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DeleteSetButton({ setId }: { setId: string }) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/admin/questions/${setId}`, { method: 'DELETE' })
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2" onClick={(e) => e.preventDefault()}>
        <span className="text-xs text-gray-500">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs font-medium text-red-600 hover:text-red-800 disabled:opacity-50"
        >
          {deleting ? 'Deleting…' : 'Yes'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          No
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={(e) => { e.preventDefault(); setConfirming(true) }}
      className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-0.5 rounded hover:bg-red-50"
    >
      Delete
    </button>
  )
}
