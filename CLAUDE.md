# Shiny Shell Hiring

AI-powered hiring tool for Shiny Shell Carwash.

## Stack
- Next.js 16 (App Router)
- Supabase (Postgres + Auth + RLS)
- Vapi.ai (AI voice screening)
- Twilio (SMS)
- OpenAI GPT-4o-mini (scoring)
- Google Calendar API (scheduling)

## Key conventions
- All webhook/cron routes use service-role Supabase client (`lib/supabase/admin.ts`)
- All user-facing API routes use `requireAdmin()` from `lib/auth/require-admin.ts`
- SMS always goes through `sendSMS()` in `lib/twilio/sms.ts` — never call Twilio directly
- Vapi events land in `inbound_events` table first, processed by cron (outbox pattern)
- Multi-tenant: every table has `company_id` + `location_id`
