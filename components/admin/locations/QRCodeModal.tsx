'use client'

import { useState } from 'react'

interface Props {
  locationName: string
  applyUrl: string
}

export default function QRCodeModal({ locationName, applyUrl }: Props) {
  const [open, setOpen] = useState(false)
  const qrSrc = `/api/qr?url=${encodeURIComponent(applyUrl)}`

  async function handleDownload() {
    const res = await fetch(qrSrc)
    const blob = await res.blob()
    const obj = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = obj
    a.download = `${locationName.toLowerCase().replace(/\s+/g, '-')}-apply-qr.png`
    a.click()
    URL.revokeObjectURL(obj)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-gray-400 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors"
      >
        QR Code
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm text-center space-y-4">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-xl leading-none"
            >
              ×
            </button>

            <div>
              <h3 className="text-base font-semibold text-gray-900">{locationName} — Apply QR</h3>
              <p className="text-xs text-gray-400 mt-1">
                Print and post in-store, on receipts, or in job listings.
              </p>
            </div>

            {/* QR image */}
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSrc}
                alt={`QR code for ${locationName} apply page`}
                width={200}
                height={200}
                className="rounded-lg border border-gray-100"
              />
            </div>

            {/* Apply URL */}
            <p className="text-[11px] font-mono text-gray-400 break-all">{applyUrl}</p>

            <div className="flex gap-2 justify-center">
              <button
                onClick={handleDownload}
                className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition-colors"
                style={{ backgroundColor: 'var(--brand-primary)' }}
              >
                Download PNG
              </button>
              <button
                onClick={() => navigator.clipboard?.writeText(applyUrl)}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Copy URL
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
