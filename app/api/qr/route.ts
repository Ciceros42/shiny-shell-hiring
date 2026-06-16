import QRCode from 'qrcode'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const url = searchParams.get('url')
  if (!url) return new Response('Missing url', { status: 400 })

  const png = await QRCode.toBuffer(url, {
    type: 'png',
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  })

  return new Response(Buffer.from(png).buffer, {
    headers: {
      'Content-Type': 'image/png',
      'Content-Disposition': 'attachment; filename="apply-qr.png"',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
