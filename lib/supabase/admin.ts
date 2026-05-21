import { createClient } from '@supabase/supabase-js'

// Service-role client — bypasses RLS. Only use in:
// - Webhook handlers (app/api/webhooks/*)
// - Cron jobs (app/api/cron/*)
// - Server-side DB helpers in lib/db/*
// Never expose to the browser or use in client components.
export const adminDb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
)
