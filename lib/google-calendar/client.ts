import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { google } from 'googleapis'
import { adminDb } from '@/lib/supabase/admin'

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex || hex.length !== 64) throw new Error('ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
  return Buffer.from(hex, 'hex')
}

// Fix 19: AES-256-GCM — must call getAuthTag() after final(), store iv:ct:tag
export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('hex')}:${encrypted.toString('hex')}:${tag.toString('hex')}`
}

// Fix 19: must call setAuthTag() before final()
export function decrypt(stored: string): string {
  const parts = stored.split(':')
  if (parts.length !== 3) throw new Error('Invalid encrypted token format')
  const [ivHex, ctHex, tagHex] = parts
  const key = getKey()
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'))
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'))
  return Buffer.concat([
    decipher.update(Buffer.from(ctHex, 'hex')),
    decipher.final(),
  ]).toString('utf8')
}

export function createOAuth2Client() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID!,
    process.env.GOOGLE_CLIENT_SECRET!,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/calendar/callback`
  )
}

// Fix 8: token is on profiles, not locations — one Google account per manager
export async function getAccessToken(userId: string): Promise<string> {
  const { data: profile, error } = await adminDb
    .from('profiles')
    .select('calendar_token_encrypted, calendar_token_created_at')
    .eq('id', userId)
    .single()

  if (error || !profile?.calendar_token_encrypted) {
    throw new Error('No calendar token for user — manager must connect Google Calendar')
  }

  const tokens = JSON.parse(decrypt(profile.calendar_token_encrypted))
  const createdAt = new Date(profile.calendar_token_created_at as string).getTime()

  // Refresh if token is within 100s of expiry (tokens expire after ~3600s)
  if (Date.now() - createdAt > 3500 * 1000) {
    const oauth2Client = createOAuth2Client()
    oauth2Client.setCredentials(tokens)
    const { credentials } = await oauth2Client.refreshAccessToken()
    const newEncrypted = encrypt(JSON.stringify(credentials))
    await adminDb
      .from('profiles')
      .update({
        calendar_token_encrypted: newEncrypted,
        calendar_token_created_at: new Date().toISOString(),
      })
      .eq('id', userId)
    return credentials.access_token!
  }

  return tokens.access_token as string
}
