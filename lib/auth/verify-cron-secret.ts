import { timingSafeEqual } from 'crypto'

export function verifyCronSecret(req: Request): boolean {
  const expected = process.env.CRON_SECRET ?? ''
  const provided = req.headers.get('authorization')?.replace('Bearer ', '') ?? ''
  if (!expected || !provided) return false
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}
