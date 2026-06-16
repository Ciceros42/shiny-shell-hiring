import { createHmac } from 'crypto'

export function makeStatusToken(appId: string): string {
  return createHmac('sha256', process.env.ENCRYPTION_KEY!).update(appId).digest('hex').slice(0, 20)
}

export function verifyStatusToken(appId: string, token: string): boolean {
  return makeStatusToken(appId) === token
}
