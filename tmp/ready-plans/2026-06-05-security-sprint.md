# Security Sprint — Implementation Plan

**Date:** 2026-06-05
**Priority:** Must complete before culture/skill split (adds more routes that would inherit all vulnerabilities)

---

## Overview

Five concrete fixes: (1) `requireAdmin()` role check, (2) IDOR company scoping on all admin routes, (3) optimistic UI rollback with error handling, (4) advance idempotency guard, (5) migration data loss fix for question deletion.

---

## Files Being Changed

```
lib/
  auth/
    require-admin.ts                              ← MODIFIED

app/
  api/
    admin/
      applications/
        [id]/
          advance/route.ts                        ← MODIFIED
          reject/route.ts                         ← MODIFIED
          detail/route.ts                         ← MODIFIED
      jobs/
        route.ts                                  ← MODIFIED
        [id]/route.ts                             ← MODIFIED
      questions/
        route.ts                                  ← MODIFIED
        [setId]/route.ts                          ← MODIFIED
        [setId]/questions/route.ts                ← MODIFIED
        [setId]/questions/[qId]/route.ts          ← MODIFIED
      slots/route.ts                              ← MODIFIED
      slots/[slotId]/route.ts                     ← MODIFIED
      locations/[locationId]/route.ts             ← MODIFIED
      settings/mode/route.ts                      ← MODIFIED
      vapi/deploy/route.ts                        ← MODIFIED
      test/simulate-call/route.ts                 ← MODIFIED

lib/
  actions/
    advance-applicant.ts                          ← MODIFIED

components/
  admin/
    applicants/
      ApplicantsTree.tsx                          ← MODIFIED

supabase/migrations/
  0008_soft_delete_questions.sql                  ← NEW
```

---

## Architecture Overview

```
requireAdmin() now returns { user, profile, error }
  profile = { role: 'company_admin' | 'location_manager', company_id, location_id }

Every admin route:
  const { user, profile, error } = await requireAdmin()
  if (error) return error
  // profile.company_id is now trusted for all subsequent queries

IDOR guard pattern:
  adminDb.from('applications').select(...).eq('id', id).eq('company_id', profile.company_id)
  → Returns null if application belongs to a different company → 404
```

---

## Task 1 — `lib/auth/require-admin.ts` (MODIFIED)

Add profile query and role check. Return `profile` so all callers get `company_id` without a second DB hit.

```typescript
import { createClient } from '@/lib/supabase/server'
import { adminDb } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export interface AdminProfile {
  role: 'company_admin' | 'location_manager'
  companyId: string
  locationId: string | null
}

export async function requireAdmin(): Promise<
  | { user: { id: string }; profile: AdminProfile; error: null }
  | { user: null; profile: null; error: NextResponse }
> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return { user: null, profile: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data: profile } = await adminDb
    .from('profiles')
    .select('role, company_id, location_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['company_admin', 'location_manager'].includes(profile.role as string)) {
    return { user: null, profile: null, error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return {
    user: { id: user.id },
    profile: {
      role: profile.role as AdminProfile['role'],
      companyId: profile.company_id as string,
      locationId: profile.location_id as string | null,
    },
    error: null,
  }
}
```

**Note:** All existing callers currently destructure `{ error }` and ignore `user`. After this change they continue to compile. Callers that need `companyId` now destructure `{ profile, error }`.

---

## Task 2 — IDOR fix: `app/api/admin/applications/[id]/detail/route.ts`

```typescript
export async function GET(_req: Request, { params }: Params) {
  const { profile, error } = await requireAdmin()
  if (error) return error
  const { id } = await params

  const { data: app } = await adminDb
    .from('applications')
    .select(`id, status, created_at, job_id, ...`)
    .eq('id', id)
    .eq('company_id', profile.companyId)   // ← IDOR guard
    .single()

  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  // rest unchanged
}
```

---

## Task 3 — IDOR fix: `app/api/admin/applications/[id]/advance/route.ts`

```typescript
export async function POST(_req: Request, { params }: Params) {
  const { profile, error } = await requireAdmin()
  if (error) return error
  const { id } = await params

  // Verify ownership before acting
  const { data: app } = await adminDb
    .from('applications')
    .select('id, company_id')
    .eq('id', id)
    .eq('company_id', profile.companyId)
    .single()
  if (!app) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  try {
    await advanceApplicant(id)
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Note:** Do not return `String(err)` to the client — leaks internal error messages (audit item 23).

---

## Task 4 — IDOR fix: `app/api/admin/applications/[id]/reject/route.ts`

Same pattern as Task 3 — verify `company_id` before acting.

---

## Task 5 — IDOR fix: `app/api/admin/jobs/[id]/route.ts`

```typescript
export async function PATCH(req: Request, { params }: Params) {
  const { profile, error } = await requireAdmin()
  if (error) return error
  const { id } = await params

  // Verify job belongs to caller's company
  const { data: job } = await adminDb
    .from('jobs')
    .select('id')
    .eq('id', id)
    .eq('company_id', profile.companyId)
    .single()
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = await req.json()
  // ... allowed fields whitelist unchanged
  const { error: updateError } = await adminDb
    .from('jobs')
    .update(allowed)
    .eq('id', id)
    .eq('company_id', profile.companyId)   // double-check on write

  if (updateError) return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

---

## Task 6 — IDOR fix: remaining admin routes

Apply the same company-scope guard to every route that reads or writes per-company data using `adminDb`. For each route:

1. Destructure `profile` from `requireAdmin()`
2. Add `.eq('company_id', profile.companyId)` to the primary record lookup
3. Return 404 if not found (do not distinguish "wrong company" from "doesn't exist")
4. Replace `{ error: String(err) }` or `{ error: updateError.message }` responses with `{ error: 'Internal server error' }`

Affected routes:
- `app/api/admin/questions/route.ts` — POST: add `company_id: profile.companyId` to insert
- `app/api/admin/questions/[setId]/route.ts` — PATCH: scope by company via joined question_sets
- `app/api/admin/questions/[setId]/questions/route.ts` — POST: verify set belongs to company
- `app/api/admin/questions/[setId]/questions/[qId]/route.ts` — PATCH/DELETE: verify via set
- `app/api/admin/slots/route.ts` — GET/POST: scope by location(s) owned by company
- `app/api/admin/slots/[slotId]/route.ts` — PATCH/DELETE: verify slot's location belongs to company
- `app/api/admin/locations/[locationId]/route.ts` — verify location belongs to company
- `app/api/admin/settings/mode/route.ts` — already uses company_id from profile (verify)
- `app/api/admin/vapi/deploy/route.ts` — verify assistant belongs to company
- `app/api/admin/jobs/route.ts` — POST: add `company_id: profile.companyId` to insert
- `app/api/admin/applications/[appId]/hire/route.ts` — add ownership check

**Pattern for nested resources (questions inside a question set):**
```typescript
// Verify the parent set belongs to the caller's company before mutating a child
const { data: set } = await adminDb
  .from('question_sets')
  .select('id')
  .eq('id', setId)
  .eq('company_id', profile.companyId)
  .single()
if (!set) return NextResponse.json({ error: 'Not found' }, { status: 404 })
// then proceed with question mutation
```

---

## Task 7 — Optimistic UI rollback: `components/admin/applicants/ApplicantsTree.tsx`

Replace fire-and-forget advance/reject with response check and rollback:

```typescript
async function handleAdvance(appId: string) {
  setActionLoading(appId)
  // Optimistic update
  setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'passed' } : a))
  if (selectedAppId === appId) setSelectedAppId(null)

  try {
    const res = await fetch(`/api/admin/applications/${appId}/advance`, { method: 'POST' })
    if (!res.ok) {
      // Rollback
      setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'screen_complete' } : a))
      setError(`Failed to advance applicant. Please try again.`)
    }
  } catch {
    setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'screen_complete' } : a))
    setError('Network error. Please check your connection.')
  } finally {
    setActionLoading(null)
  }
}

async function handleReject(appId: string) {
  setActionLoading(appId)
  setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'rejected' } : a))
  if (selectedAppId === appId) setSelectedAppId(null)

  try {
    const res = await fetch(`/api/admin/applications/${appId}/reject`, { method: 'POST' })
    if (!res.ok) {
      setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'screen_complete' } : a))
      setError('Failed to reject applicant. Please try again.')
    }
  } catch {
    setApps((prev) => prev.map((a) => a.id === appId ? { ...a, status: 'screen_complete' } : a))
    setError('Network error. Please check your connection.')
  } finally {
    setActionLoading(null)
  }
}
```

Add `error` state and a dismissible error banner at the top of the tree:
```typescript
const [error, setError] = useState<string | null>(null)

// In JSX, above the buckets:
{error && (
  <div className="mb-3 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
    <span>{error}</span>
    <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600">×</button>
  </div>
)}
```

Also change `actionLoading` from `string | null` to `Set<string>` so concurrent actions on different rows don't block each other:
```typescript
const [actionLoading, setActionLoading] = useState<Set<string>>(new Set())

// Start: setActionLoading(prev => new Set([...prev, appId]))
// End:   setActionLoading(prev => { const s = new Set(prev); s.delete(appId); return s })
// Check: actionLoading.has(appId)
```

---

## Task 8 — Advance idempotency: `lib/actions/advance-applicant.ts`

Add two guards before creating a magic link:

```typescript
export async function advanceApplicant(applicationId: string): Promise<void> {
  const { data: app } = await adminDb
    .from('applications')
    .select('status, applicant_id, location_id, applicants(id, phone, email, sms_opted_out, name), locations(id, timezone)')
    .eq('id', applicationId)
    .single()

  if (!app) throw new Error('Application not found')

  // Idempotency guard 1: only advance from screen_complete
  if (app.status !== 'screen_complete') {
    if (app.status === 'passed') return  // already advanced — no-op
    throw new Error(`Cannot advance application in status: ${app.status}`)
  }

  const applicant = app.applicants as unknown as { ... } | null
  const location = app.locations as unknown as { ... } | null
  if (!applicant || !location) throw new Error('Applicant or location not found')

  await updateApplicationStatus(applicationId, 'passed')

  try {
    // Idempotency guard 2: don't create a second schedule link if one already exists
    const { data: existingLink } = await adminDb
      .from('magic_links')
      .select('id')
      .eq('application_id', applicationId)
      .eq('type', 'schedule')
      .is('completed_at', null)
      .maybeSingle()

    if (!existingLink) {
      const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url')
      const expiresAt = new Date(Date.now() + 72 * 60 * 60 * 1000)
      const earliestBookable = new Date(Date.now() + 30 * 60 * 1000)
      await createMagicLink({ type: 'schedule', applicationId, token, expiresAt, earliestBookable })

      const scheduleUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/schedule/${token}`
      const useEmail = applicant.sms_opted_out && !!applicant.email
      if (useEmail) {
        await sendPassEmail({ to: applicant.email!, name: applicant.name, scheduleUrl })
      } else {
        await sendSMS(applicant.phone, SMS.pass(scheduleUrl), applicationId, 'pass', location.timezone, { bypassQuietHours: true })
      }
    }

    await addToTalentPool(applicant.id, location.id, 'passed_no_schedule')
  } catch (err) {
    console.error('[advanceApplicant] notification failed:', err)
  }
}
```

---

## Task 9 — `supabase/migrations/0008_soft_delete_questions.sql` (NEW)

The current `0005_carwash_associate_questions.sql` hard-deletes questions. Questions with live `screen_answers` references must never be hard-deleted. The `questions` table already has a `deleted_at` column — it just isn't used by the migration.

This migration documents the constraint and adds a DB-level guard:

```sql
-- Prevent hard-deleting questions that have live screen_answers
-- The questions table already has deleted_at for soft-delete.
-- This function enforces the pattern via a trigger.

CREATE OR REPLACE FUNCTION prevent_question_hard_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM screen_answers WHERE question_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Cannot delete question % — it has existing screen_answers. Use soft-delete (deleted_at) instead.', OLD.id
      USING ERRCODE = 'foreign_key_violation';
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER enforce_soft_delete_questions
  BEFORE DELETE ON questions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_question_hard_delete();

-- Also add ON DELETE SET NULL to applications.job_id (audit item 20)
ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS applications_job_id_fkey,
  ADD CONSTRAINT applications_job_id_fkey
    FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE SET NULL;
```

**Also update `0005_carwash_associate_questions.sql`** to use soft-delete instead of hard-delete (already done in earlier session but needed for completeness):
The `delete from questions where question_set_id = ...` in that migration must be replaced with:
```sql
UPDATE questions SET deleted_at = now()
WHERE question_set_id = '00000000-0000-0000-0000-000000000002'
  AND deleted_at IS NULL;
```

---

## Implementation Order

```
Task 1 (requireAdmin) — foundation; all other tasks depend on it
  └─► Tasks 2–6 (IDOR guards) — all independent of each other, run in parallel
Task 7 (UI rollback) — independent
Task 8 (advance idempotency) — independent
Task 9 (migration) — independent, run last
```

---

## What This Does NOT Fix (tracked for follow-up)

- Item 10: Vapi deploy body validation — address in culture/skill plan (touches vapi/deploy/route.ts)
- Item 13: ApplicantPanel fetch error state — address in culture/skill plan (touches panel)
- Item 15: 500-row payload — paginated API in a future sprint
- Item 17: TOCTOU pipeline mode — address in culture/skill plan (touches process-events.ts)
- Items 22, 26–28: DB round-trip consolidations — address in culture/skill plan opportunistically
- Items 34–41: UX improvements — future sprint
