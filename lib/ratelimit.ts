import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

let ratelimit: Ratelimit | null = null

function getRatelimit() {
  if (!ratelimit) {
    ratelimit = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.slidingWindow(20, '15 m'),
    })
  }
  return ratelimit
}

export async function isRateLimited(ip: string): Promise<boolean> {
  try {
    const { success } = await getRatelimit().limit(ip)
    return !success
  } catch {
    // If Redis is unavailable, fail open — don't block legitimate submissions
    return false
  }
}
