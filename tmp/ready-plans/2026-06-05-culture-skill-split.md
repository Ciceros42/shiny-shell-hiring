# Culture / Skill Split — Implementation Plan

**Date:** 2026-06-05
**Prerequisite:** `2026-06-05-security-sprint.md` must be implemented first (requireAdmin returns profile, all routes use profile.companyId).

---

## Overview

Split the question/scoring system into Culture (values alignment, company-wide but assigned per job) and Skill (job-specific rubric, current setup). Both produce separate scores blended by configurable weights into a final score. Pass threshold moves from `question_sets` to `jobs`. AI produces separate culture and skill briefings. Label "Job Title" on question set editor becomes "Set Name".

**Key architectural decision (from reviewer consensus):** Use a single `questions` table with a `kind: 'culture' | 'skill'` column rather than a parallel `culture_questions` table. This eliminates the dual-FK `screen_answers` split, keeps `upsertScreenAnswer` and `recordAnswer` handler unchanged, and removes five categories of scoring bugs.

---

## Settled Design Decisions

- Multiple culture sets per company; each job gets a nullable `culture_set_id` FK
- Culture questions: scored-only — no `hard_filter` type, no `fail_value`
- `kind` column on `questions` table: `'skill'` (default, backward compat) or `'culture'`
- `culture_question_sets` table mirrors `question_sets` but without `job_title` and `pass_threshold`
- AI produces two separate briefings: `culture_briefing` and `skill_briefing` (copy to `manager_briefing` in code, don't ask GPT for it twice)
- Pass threshold belongs on `jobs`, not `question_sets`
- Culture questions first in Vapi question script, then skill questions (both sorted by `order_index`)
- When `culture_set_id` is null on a job: `cultureWeight = 0`, `skillWeight = 100`
- Hard filters live in skill questions only

---

## Files Being Changed

```
supabase/migrations/
  0009_culture_skill_split.sql                   ← NEW (was 0007; 0008 used by security sprint)

lib/
  db/
    culture-question-sets.ts                     ← NEW
    scoring-context.ts                           ← NEW
    jobs.ts                                      ← MODIFIED
    screen-results.ts                            ← MODIFIED
    question-sets.ts                             ← MODIFIED
    applications.ts                              ← MODIFIED
  scoring/
    engine.ts                                    ← MODIFIED
  cron/
    process-events.ts                            ← MODIFIED
    scheduled-calls.ts                           ← MODIFIED
  vapi/
    assistant.ts                                 ← MODIFIED

app/
  api/
    admin/
      culture-questions/
        route.ts                                 ← NEW
        [setId]/
          route.ts                               ← NEW
          questions/
            route.ts                             ← NEW
            [qId]/
              route.ts                           ← NEW
      questions/
        route.ts                                 ← MODIFIED
        [setId]/
          route.ts                               ← MODIFIED
      jobs/
        route.ts                                 ← MODIFIED
        [id]/
          route.ts                               ← MODIFIED
      test/
        simulate-call/
          route.ts                               ← MODIFIED
      applications/
        [id]/
          detail/
            route.ts                             ← MODIFIED
    screen/
      [token]/
        route.ts                                 ← MODIFIED

  (admin)/
    questions/
      page.tsx                                   ← MODIFIED
      [setId]/
        page.tsx                                 ← MODIFIED
      culture/
        [setId]/
          page.tsx                               ← NEW
    jobs/
      page.tsx                                   ← MODIFIED

components/
  admin/
    questions/
      QuestionSetEditor.tsx                      ← MODIFIED
      NewSetButton.tsx                           ← MODIFIED
    jobs/
      JobsClient.tsx                             ← MODIFIED
    applicants/
      ApplicantPanel.tsx                         ← MODIFIED
```

---

## Architecture Overview

```
questions table (extended):
  kind: 'skill' (default) | 'culture'
  question_set_id → question_sets (skill questions)
  culture_set_id  → culture_question_sets (culture questions, one nullable)
  Both can coexist in same table — screen_answers.question_id FK unchanged

culture_question_sets:
  id, company_id, name, is_active, created_at
  (no job_title, no pass_threshold)

jobs (extended):
  culture_set_id  → culture_question_sets (nullable)
  pass_threshold  (moved from question_sets)
  culture_weight  (0–100, default 50)
  skill_weight    (0–100, default 50)

Scoring pipeline:
  getJobScoringContext(applicationId)
    → single Supabase join: application → job → (culture_set + skill_set + questions)
    → returns { skillQuestions, cultureQuestions, passThreshold, cultureWeight, skillWeight }

  batchScoreAndSummarize(answers, skillQuestions, cultureQuestions)
    → tags each ScoredAnswer with setType: 'culture' | 'skill'
    → GPT returns culture_briefing + skill_briefing (not manager_briefing)
    → managerBriefing = skillBriefing in code

  runPassFailEngine(scoredAnswers, { passThreshold, cultureWeight, skillWeight, skillQuestions })
    → hard filters: skill only
    → cultureScore = weighted avg of culture answers
    → skillScore = weighted avg of skill scored answers
    → finalScore = blend(cultureScore × cultureWeight + skillScore × skillWeight)
    → passed = finalScore >= passThreshold

screen_results (extended, all new columns nullable):
  culture_score, skill_score, final_score
  culture_weight_at_time, skill_weight_at_time
  culture_briefing, skill_briefing
  (total_score = finalScore for backward compat)
```

---

## Task 1 — `supabase/migrations/0009_culture_skill_split.sql` (NEW)

```sql
-- ── Culture question sets ──────────────────────────────────────────────────
create table culture_question_sets (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id),
  name text not null,
  is_active bool not null default true,
  created_at timestamptz not null default now()
);

-- ── Extend questions table with kind + culture_set_id ─────────────────────
alter table questions
  add column kind text not null default 'skill'
    check (kind in ('skill', 'culture')),
  add column culture_set_id uuid references culture_question_sets(id);

-- Existing rows are all skill questions — kind = 'skill' by default. Good.

-- ── Jobs: threshold + weights + culture FK ────────────────────────────────
alter table jobs
  add column pass_threshold int not null default 70
    check (pass_threshold between 0 and 100),
  add column culture_weight int not null default 50
    check (culture_weight between 0 and 100),
  add column skill_weight int not null default 50
    check (skill_weight between 0 and 100),
  add column culture_set_id uuid references culture_question_sets(id);

-- Backfill pass_threshold from linked question_sets
update jobs j
set pass_threshold = qs.pass_threshold
from question_sets qs
where qs.id = j.question_set_id;

-- ── Screen results: split scores + briefings ──────────────────────────────
alter table screen_results
  add column culture_score int check (culture_score between 0 and 100),
  add column skill_score int check (skill_score between 0 and 100),
  add column final_score int check (final_score between 0 and 100),
  add column culture_weight_at_time int,
  add column skill_weight_at_time int,
  add column culture_briefing text,
  add column skill_briefing text;

-- ── applications.job_id ON DELETE SET NULL (if not already done in 0008) ──
-- (0008_soft_delete_questions.sql adds this — skip here if already present)

-- ── RLS for culture_question_sets ────────────────────────────────────────
alter table culture_question_sets enable row level security;

create policy "manager_culture_question_sets" on culture_question_sets
  for all using (
    company_id in (select company_id from profiles where id = auth.uid())
  );

-- culture_questions are rows in the questions table with kind='culture'
-- They inherit the existing questions RLS policy via question_set_id = null,
-- BUT questions policy filters by question_set_id — culture questions have
-- question_set_id = null so they would be invisible.
-- Fix: update the existing questions RLS to also cover kind='culture' via culture_set_id.
drop policy if exists "manager_questions" on questions;
create policy "manager_questions" on questions
  for all using (
    -- skill questions: via question_set
    question_set_id in (
      select id from question_sets
      where company_id in (select company_id from profiles where id = auth.uid())
    )
    or
    -- culture questions: via culture_set
    culture_set_id in (
      select id from culture_question_sets
      where company_id in (select company_id from profiles where id = auth.uid())
    )
  );

-- ── Indexes ───────────────────────────────────────────────────────────────
create index on culture_question_sets(company_id);
create index on questions(culture_set_id) where culture_set_id is not null;
create index on jobs(culture_set_id) where culture_set_id is not null;
```

**Gotchas:**
- `questions.question_set_id` stays NOT NULL for skill questions. Culture questions have `question_set_id = null` and `culture_set_id = <uuid>`. The existing NOT NULL constraint must be relaxed: `alter table questions alter column question_set_id drop not null;`
- `screen_answers.question_id` FK still points to `questions(id)` — unchanged since both skill and culture questions share the same table.

Add to migration:
```sql
alter table questions alter column question_set_id drop not null;
-- Check constraint: exactly one of question_set_id / culture_set_id must be set
alter table questions add constraint questions_exactly_one_parent
  check (
    (question_set_id is not null and culture_set_id is null) or
    (question_set_id is null and culture_set_id is not null)
  );
```

---

## Task 2 — `lib/db/culture-question-sets.ts` (NEW)

```typescript
import { adminDb } from '@/lib/supabase/admin'

export interface CultureQuestion {
  id: string
  variants: string[]
  rubric: string | null
  weight: number
  order_index: number
}

export interface CultureQuestionSet {
  id: string
  name: string
  companyId: string
  isActive: boolean
  createdAt: string
  questions?: CultureQuestion[]
}

export async function getCultureQuestionSets(companyId: string): Promise<CultureQuestionSet[]> {
  const { data } = await adminDb
    .from('culture_question_sets')
    .select('id, name, company_id, is_active, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
  return (data ?? []).map(mapSet)
}

export async function getCultureSetWithQuestions(setId: string): Promise<CultureQuestionSet> {
  const { data, error } = await adminDb
    .from('culture_question_sets')
    .select('id, name, company_id, is_active, created_at')
    .eq('id', setId)
    .single()
  if (error || !data) throw new Error(`getCultureSetWithQuestions: not found ${setId}`)

  const { data: questions } = await adminDb
    .from('questions')
    .select('id, variants, rubric, weight, order_index')
    .eq('culture_set_id', setId)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  return { ...mapSet(data), questions: (questions ?? []) as CultureQuestion[] }
}

export async function createCultureSet(companyId: string, name: string): Promise<{ id: string }> {
  const { data, error } = await adminDb
    .from('culture_question_sets')
    .insert({ company_id: companyId, name })
    .select('id')
    .single()
  if (error) throw new Error(`createCultureSet: ${error.message}`)
  return { id: data.id as string }
}

export async function updateCultureSet(setId: string, patch: { name?: string; is_active?: boolean }): Promise<void> {
  await adminDb.from('culture_question_sets').update(patch).eq('id', setId)
}

function mapSet(row: Record<string, unknown>): CultureQuestionSet {
  return {
    id: row.id as string,
    name: row.name as string,
    companyId: row.company_id as string,
    isActive: row.is_active as boolean,
    createdAt: row.created_at as string,
  }
}
```

**Culture question CRUD uses the main `questions` table** — no separate CRUD functions needed. Insert with `{ culture_set_id: setId, kind: 'culture', question_set_id: null, ... }`. Update/soft-delete same as skill questions.

---

## Task 3 — `lib/db/scoring-context.ts` (NEW)

Single Supabase join instead of 3 round-trips:

```typescript
import { adminDb } from '@/lib/supabase/admin'

export interface QuestionForScoring {
  id: string
  kind: 'skill' | 'culture'
  type: 'hard_filter' | 'scored' | 'informational'  // informational only on skill
  variants: string[]
  rubric: string | null
  fail_value: string | null  // only populated for skill hard_filter
  weight: number
  order_index: number
}

export interface ScoringContext {
  skillQuestions: QuestionForScoring[]
  cultureQuestions: QuestionForScoring[]
  passThreshold: number
  cultureWeight: number
  skillWeight: number
}

export async function getJobScoringContext(applicationId: string): Promise<ScoringContext> {
  // Single join: application → job → culture_set questions + skill questions
  const { data: app } = await adminDb
    .from('applications')
    .select(`
      question_set_id,
      jobs(
        pass_threshold, culture_weight, skill_weight, culture_set_id
      )
    `)
    .eq('id', applicationId)
    .single()

  if (!app) throw new Error(`getJobScoringContext: application not found ${applicationId}`)

  const job = app.jobs as {
    pass_threshold: number; culture_weight: number; skill_weight: number; culture_set_id: string | null
  } | null

  const passThreshold = job?.pass_threshold ?? 70
  const cultureSetId = job?.culture_set_id ?? null
  const cultureWeight = cultureSetId ? (job?.culture_weight ?? 50) : 0
  const skillWeight = cultureSetId ? (job?.skill_weight ?? 50) : 100

  // Load skill questions
  const { data: skillRaw } = await adminDb
    .from('questions')
    .select('id, kind, type, variants, rubric, fail_value, weight, order_index')
    .eq('question_set_id', app.question_set_id)
    .is('deleted_at', null)
    .order('order_index', { ascending: true })

  const skillQuestions = ((skillRaw ?? []) as QuestionForScoring[])
    .map(q => ({ ...q, kind: 'skill' as const }))

  // Load culture questions
  let cultureQuestions: QuestionForScoring[] = []
  if (cultureSetId) {
    const { data: cultureRaw } = await adminDb
      .from('questions')
      .select('id, kind, variants, rubric, weight, order_index')
      .eq('culture_set_id', cultureSetId)
      .is('deleted_at', null)
      .order('order_index', { ascending: true })

    cultureQuestions = ((cultureRaw ?? []) as QuestionForScoring[]).map(q => ({
      ...q,
      kind: 'culture' as const,
      type: 'scored' as const,  // culture questions are always scored
      fail_value: null,
    }))
  }

  return { skillQuestions, cultureQuestions, passThreshold, cultureWeight, skillWeight }
}
```

---

## Task 4 — `lib/db/jobs.ts` (MODIFIED)

Add to `Job` interface:
```typescript
passThreshold: number
cultureWeight: number
skillWeight: number
cultureSetId: string | null
```

Update all `select(...)` strings to include `pass_threshold, culture_weight, skill_weight, culture_set_id`.

Update `mapJob`:
```typescript
passThreshold: (row.pass_threshold as number) ?? 70,
cultureWeight: (row.culture_weight as number) ?? 0,
skillWeight: (row.skill_weight as number) ?? 100,
cultureSetId: (row.culture_set_id as string | null) ?? null,
```

---

## Task 5 — `lib/db/screen-results.ts` (MODIFIED)

Add to `ScreenResult` interface (all nullable for back-compat):
```typescript
cultureScore: number | null
skillScore: number | null
finalScore: number | null
cultureWeightAtTime: number | null
skillWeightAtTime: number | null
cultureBriefing: string | null
skillBriefing: string | null
```

Add corresponding optional params to `saveScreenResult` and map them in the upsert body and `mapScreenResult`. Keep `totalScore`, `thresholdAtTime`, `managerBriefing` as-is.

---

## Task 6 — `lib/scoring/engine.ts` (MODIFIED)

### 6a — Updated interfaces

```typescript
export interface ScoredAnswer {
  questionId: string
  answerText: string
  score: number
  reasoning: string
  questionType: 'hard_filter' | 'scored' | 'informational'
  weight: number
  setType: 'culture' | 'skill'  // NEW
}

export interface BatchScoringResult {
  scoredAnswers: ScoredAnswer[]
  inflectionNotes: string
  qualitativeSummary: string
  managerBriefing: string    // = skillBriefing, kept for backward compat
  cultureBriefing: string    // NEW
  skillBriefing: string      // NEW
}

export interface PassFailResult {
  passed: boolean
  failReason: string | null
  qualitativeSummary: string
  totalScore: number          // = finalScore, backward compat
  cultureScore: number | null
  skillScore: number | null
  finalScore: number
}

export interface PassFailInput {
  passThreshold: number
  cultureWeight: number
  skillWeight: number
  skillQuestions: QuestionForScoring[]  // for hard-filter fail_value lookup
}
```

### 6b — Updated `batchScoreAndSummarize`

New signature: `batchScoreAndSummarize(answers, skillQuestions, cultureQuestions)`

Label scheme: pre-build a label map at prompt construction time:
```typescript
// Build labelled list for prompt
const cultureEntries = cultureQuestions.map((q, i) => {
  const a = answers.find(a => a.questionId === q.id)
  return a ? { label: `C${i+1}`, q, a } : null
}).filter(Boolean)

const skillEntries = skillQuestions
  .filter(q => q.type === 'scored')
  .map((q, i) => {
    const a = answers.find(a => a.questionId === q.id)
    return a ? { label: `S${i+1}`, q, a } : null
  }).filter(Boolean)

const allEntries = [...cultureEntries, ...skillEntries]
if (allEntries.length === 0) {
  return { scoredAnswers: [], inflectionNotes: '', qualitativeSummary: '',
           managerBriefing: '', cultureBriefing: '', skillBriefing: '' }
}
```

GPT prompt (extend existing structure):
```
You are evaluating an applicant. Score 0-100 per rubric. Most answers: 40-75. 85+ only for genuinely strong.

Section A — Culture (values alignment): C1, C2 ...
Section B — Skill (job requirements): S1, S2 ...

Provide:
- scores: [{ label: "C1", score: 80, reasoning: "..." }, ...]
- inflection_notes (2 sentences)
- qualitative_summary (1-2 sentences)
- skill_briefing (max 60 words): "Strengths: ... Concern: ... Suggested question: ..."
- culture_briefing (max 40 words): values alignment + one concern

JSON only:
{
  "scores": [...],
  "inflection_notes": "...",
  "qualitative_summary": "...",
  "skill_briefing": "...",
  "culture_briefing": "..."
}
```

After parsing, build `ScoredAnswer[]` using the pre-built label map — O(1) lookup:
```typescript
const labelToEntry = new Map(allEntries.map(e => [e.label, e]))
const scoredAnswers: ScoredAnswer[] = parsed.scores.map(s => {
  const entry = labelToEntry.get(s.label)!
  return {
    questionId: entry.q.id,
    answerText: entry.a.answerText,
    score: s.score,
    reasoning: s.reasoning,
    questionType: entry.q.kind === 'culture' ? 'scored' : entry.q.type,
    weight: entry.q.weight ?? 1,
    setType: entry.q.kind,
  }
})
```

Return:
```typescript
return {
  scoredAnswers,
  inflectionNotes: parsed.inflection_notes ?? '',
  qualitativeSummary: parsed.qualitative_summary ?? '',
  skillBriefing: parsed.skill_briefing ?? '',
  cultureBriefing: parsed.culture_briefing ?? '',
  managerBriefing: parsed.skill_briefing ?? '',  // backward compat
}
```

### 6c — Updated `runPassFailEngine`

```typescript
export function runPassFailEngine(
  scoredAnswers: ScoredAnswer[],
  input: PassFailInput,
  qualitativeSummary: string
): PassFailResult {
  // Hard filters — skill only
  const skillAnswers = scoredAnswers.filter(a => a.setType === 'skill')
  for (const answer of skillAnswers) {
    const q = input.skillQuestions.find(q => q.id === answer.questionId)
    if (q?.type === 'hard_filter' && q.fail_value &&
        answer.answerText.trim().toLowerCase() === q.fail_value.trim().toLowerCase()) {
      return { passed: false, failReason: `hard_filter:${answer.questionId}`,
               qualitativeSummary, totalScore: 0,
               cultureScore: null, skillScore: null, finalScore: 0 }
    }
  }

  function computeWeightedAvg(answers: ScoredAnswer[]): number | null {
    const scored = answers.filter(a => a.questionType === 'scored')
    if (scored.length === 0) return null
    const totalW = scored.reduce((s, a) => s + a.weight, 0)
    return totalW > 0 ? scored.reduce((s, a) => s + (a.score * a.weight) / totalW, 0) : 0
  }

  const cultureAvg = computeWeightedAvg(scoredAnswers.filter(a => a.setType === 'culture'))
  const skillAvg = computeWeightedAvg(skillAnswers)

  let finalScore: number
  if (cultureAvg === null && skillAvg === null) {
    return { passed: false, failReason: 'no_scored_answers', qualitativeSummary,
             totalScore: 0, cultureScore: null, skillScore: null, finalScore: 0 }
  } else if (cultureAvg === null) {
    finalScore = skillAvg!
  } else if (skillAvg === null) {
    finalScore = cultureAvg
  } else {
    const total = input.cultureWeight + input.skillWeight
    finalScore = total > 0
      ? (cultureAvg * input.cultureWeight + skillAvg * input.skillWeight) / total
      : (cultureAvg + skillAvg) / 2
  }

  const rounded = Math.round(finalScore)
  return {
    passed: rounded >= input.passThreshold,
    failReason: rounded >= input.passThreshold ? null : `score_below_threshold:${rounded}`,
    qualitativeSummary,
    totalScore: rounded,
    cultureScore: cultureAvg !== null ? Math.round(cultureAvg) : null,
    skillScore: skillAvg !== null ? Math.round(skillAvg) : null,
    finalScore: rounded,
  }
}
```

### 6d — Updated `reconcileAnswersFromTranscript`

New signature:
```typescript
export async function reconcileAnswersFromTranscript(
  screenCallId: string,
  allQuestions: Array<{ id: string; type?: string; kind: 'skill' | 'culture' }>,
  transcript: string
)
```

Change the missing filter:
```typescript
const missing = allQuestions.filter(
  q => !answeredIds.has(q.id) && q.type !== 'informational'
)
```

`upsertScreenAnswer` is unchanged since all questions share the same `questions` table and `screen_answers.question_id` points to it.

---

## Task 7 — `lib/cron/process-events.ts` (MODIFIED)

Replace `getQuestionSetWithQuestions` with `getJobScoringContext`. Also snapshot `pipelineMode` at the top of `processEndOfCall` (audit item 17 — TOCTOU fix):

```typescript
// At the TOP of processEndOfCall, before any external calls:
const pipelineMode = await getCompanyPipelineMode(application.companyId)

// Replace line ~151:
const ctx = await getJobScoringContext(screenCall.applicationId)

// Merge for reconcile:
const allQuestions = [
  ...ctx.cultureQuestions.map(q => ({ ...q, kind: 'culture' as const })),
  ...ctx.skillQuestions,
]
await reconcileAnswersFromTranscript(screenCall.id, allQuestions, transcript)

const batchResult = await batchScoreAndSummarize(answers, ctx.skillQuestions, ctx.cultureQuestions)

const passFailResult = runPassFailEngine(
  batchResult.scoredAnswers,
  {
    passThreshold: ctx.passThreshold,
    cultureWeight: ctx.cultureWeight,
    skillWeight: ctx.skillWeight,
    skillQuestions: ctx.skillQuestions,
  },
  batchResult.qualitativeSummary
)

await saveScreenResult({
  applicationId: application.id,
  passed: passFailResult.passed,
  failReason: passFailResult.failReason,
  qualitativeSummary: passFailResult.qualitativeSummary,
  managerBriefing: batchResult.skillBriefing,
  cultureBriefing: batchResult.cultureBriefing,
  skillBriefing: batchResult.skillBriefing,
  scoredAnswers: batchResult.scoredAnswers,
  totalScore: passFailResult.finalScore,
  cultureScore: passFailResult.cultureScore,
  skillScore: passFailResult.skillScore,
  finalScore: passFailResult.finalScore,
  thresholdAtTime: ctx.passThreshold,
  cultureWeightAtTime: ctx.cultureWeight,
  skillWeightAtTime: ctx.skillWeight,
})

// Use the snapshotted pipelineMode (not a second call):
if (pipelineMode === 'suggestion') { ... } else { ... }
```

Remove the duplicate `getCompanyPipelineMode` call later in the function (audit item 22).

---

## Task 8 — `app/api/admin/test/simulate-call/route.ts` (MODIFIED)

Apply identical scoring path changes as Task 7. For fake answer generation:
```typescript
const cultureIds = new Set(ctx.cultureQuestions.map(q => q.id))
const allQuestions = [...ctx.cultureQuestions, ...ctx.skillQuestions]
const answerRows = allQuestions.map(q => ({
  screen_call_id: screenCall.id,
  question_id: q.id,  // same FK for both — single table
  answer_text: pickAnswer(q.type ?? 'scored', Math.random()),
  order_index: q.order_index,
}))
```

---

## Task 9 — `lib/vapi/assistant.ts` + callers (MODIFIED)

```typescript
export function buildAssistantOverrides(
  applicantName: string,
  skillQuestions: QuestionForScoring[],
  cultureQuestions: QuestionForScoring[] = []
): AssistantOverrides {
  const sortedCulture = [...cultureQuestions].sort((a, b) => a.order_index - b.order_index)
  const sortedSkill = skillQuestions
    .filter(q => q.type !== 'informational')
    .sort((a, b) => a.order_index - b.order_index)

  const allQuestions = [...sortedCulture, ...sortedSkill]
  const questionScript = allQuestions
    .map((q, i) => {
      const variant = q.variants[Math.floor(Math.random() * q.variants.length)]
      return `Question ${i + 1} [questionId: "${q.id}"]: ${variant}`
    })
    .join('\n')
  // rest unchanged
}
```

**Update callers:**

`app/api/screen/[token]/route.ts`:
```typescript
// Replace getApplicationWithDetails → getJobScoringContext:
const ctx = await getJobScoringContext(magicLink.application_id)
const overrides = buildAssistantOverrides(applicantName, ctx.skillQuestions, ctx.cultureQuestions)
```

`lib/cron/scheduled-calls.ts`:
```typescript
// Replace getQuestionSetWithQuestions:
const ctx = await getJobScoringContext(call.application_id)
const overrides = buildAssistantOverrides(applicantName, ctx.skillQuestions, ctx.cultureQuestions)
```

---

## Task 10 — Culture Question Set API Routes (NEW)

### `app/api/admin/culture-questions/route.ts`
```typescript
// GET: list company's culture sets
// POST: create new culture set
// Uses profile.companyId from requireAdmin() for company scoping (security sprint prerequisite)
const CreateSchema = z.object({ name: z.string().min(1).max(100) })
// POST insert: { company_id: profile.companyId, name }
```

### `app/api/admin/culture-questions/[setId]/route.ts`
```typescript
const PatchSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  is_active: z.boolean().optional(),
})
// Verify set.company_id === profile.companyId before update
```

### `app/api/admin/culture-questions/[setId]/questions/route.ts`
Culture questions are rows in the `questions` table with `kind: 'culture'`:
```typescript
const CreateSchema = z.object({
  variants: z.array(z.string().min(1)).min(1).max(4),
  rubric: z.string().optional().nullable(),
  weight: z.number().int().min(1).max(5).default(1),
  order_index: z.number().int().min(0),
})
// Insert: { kind: 'culture', culture_set_id: setId, question_set_id: null, type: 'scored', fail_value: null, ...body }
```

### `app/api/admin/culture-questions/[setId]/questions/[qId]/route.ts`
```typescript
// PATCH: update variants, rubric, weight, order_index
// DELETE: soft-delete via { deleted_at: new Date().toISOString() }
// Verify question.culture_set_id === setId AND set.company_id === profile.companyId
```

---

## Task 11 — Jobs API routes (MODIFIED)

### `app/api/admin/jobs/[id]/route.ts`
Add to PATCH whitelist (with Zod-style validation):
```typescript
if (typeof body.pass_threshold === 'number' &&
    Number.isInteger(body.pass_threshold) &&
    body.pass_threshold >= 0 && body.pass_threshold <= 100) {
  allowed.pass_threshold = body.pass_threshold
}
if (typeof body.culture_weight === 'number' &&
    Number.isInteger(body.culture_weight) &&
    body.culture_weight >= 0 && body.culture_weight <= 100) {
  allowed.culture_weight = body.culture_weight
}
if (typeof body.skill_weight === 'number' &&
    Number.isInteger(body.skill_weight) &&
    body.skill_weight >= 0 && body.skill_weight <= 100) {
  allowed.skill_weight = body.skill_weight
}
if ('culture_set_id' in body) {
  allowed.culture_set_id = body.culture_set_id || null
  // Enforce: when unsetting culture_set, reset weights
  if (!body.culture_set_id) {
    allowed.culture_weight = 0
    allowed.skill_weight = 100
  }
}
// Enforce weight sum = 100 when both are provided:
if ('culture_weight' in allowed && 'skill_weight' in allowed) {
  if ((allowed.culture_weight as number) + (allowed.skill_weight as number) !== 100) {
    return NextResponse.json({ error: 'culture_weight + skill_weight must equal 100' }, { status: 400 })
  }
}
```

### `app/api/admin/jobs/route.ts` (POST)
Add `pass_threshold` (default 70), `culture_weight` (default 50), `skill_weight` (default 50), `culture_set_id` (nullable) to create body and insert.

---

## Task 12 — Skill question set API routes (MODIFIED)

### `app/api/admin/questions/route.ts`
Remove `pass_threshold: 70` from the insert.

### `app/api/admin/questions/[setId]/route.ts`
Remove `pass_threshold` from `PatchSchema`.

---

## Task 13 — `components/admin/questions/QuestionSetEditor.tsx` (MODIFIED)

```typescript
type Props = {
  setId: string
  initialName: string       // renamed from initialJobTitle
  isCulture: boolean        // NEW
  initialQuestions: QuestionRow[]
  // initialThreshold REMOVED
}
```

Changes:
1. Rename `jobTitle`/`setJobTitle` state → `name`/`setName`
2. Remove `threshold` state entirely
3. Label: `isCulture ? 'Culture Set Name' : 'Set Name'`
4. Remove pass threshold slider entirely
5. PATCH endpoint: `isCulture ? '/api/admin/culture-questions/${setId}' : '/api/admin/questions/${setId}'`
6. PATCH body: `isCulture ? { name } : { job_title: name }`
7. Question form endpoint: `isCulture ? '/api/admin/culture-questions/${setId}/questions' : '/api/admin/questions/${setId}/questions'`
8. When `isCulture`: hide type radio buttons, hide `fail_value` field, omit `type` and `fail_value` from POST body
9. `DraftQuestion` type: when `isCulture`, initialize `type: 'scored'` (never shown)

---

## Task 14 — `components/admin/questions/NewSetButton.tsx` (MODIFIED)

```typescript
interface Props { isCulture?: boolean }

export default function NewSetButton({ isCulture = false }: Props) {
  async function handleCreate() {
    const url = isCulture ? '/api/admin/culture-questions' : '/api/admin/questions'
    const body = isCulture ? { name: 'New Culture Set' } : {}
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    router.push(isCulture ? `/questions/culture/${json.id}` : `/questions/${json.id}`)
  }
}
```

---

## Task 15 — `components/admin/jobs/JobsClient.tsx` (MODIFIED)

Add prop: `cultureSets: { id: string; name: string }[]`

Add state per form: `newPassThreshold`, `newCultureSetId`, `newCultureWeight` (default 50), `newSkillWeight` (default 50).

Auto-balance: `onChange` on either weight slider sets the other to `100 - value`.

New form fields (after question set selector):
- Pass Threshold: range slider 0–100 step 5, displays `{value}%`
- Culture Set: select with `— None —` option + list of culture sets
- Culture/Skill weights: two linked sliders, visible only when culture set is selected

POST body: include `passThreshold`, `cultureSetId`, `cultureWeight`, `skillWeight`.

Job list row: show `Pass: {job.passThreshold}%` and culture/skill weight when culture set assigned.

---

## Task 16 — `app/(admin)/questions/page.tsx` (MODIFIED)

Fetch culture sets using `adminDb` or user supabase client (match existing pattern in this file):
```typescript
const { data: cultureSets } = await supabase
  .from('culture_question_sets')
  .select('id, name, is_active, created_at')
  .order('created_at', { ascending: false })
```

Remove `pass_threshold` from skill set select string and from the row display.

Layout:
```tsx
{/* Culture Sets section — NEW */}
<div className="mb-10">
  <div className="flex items-center justify-between mb-4">
    <div>
      <h2>Culture Sets</h2>
      <p className="text-sm text-gray-500">Shared across jobs — values alignment</p>
    </div>
    <NewSetButton isCulture />
  </div>
  {/* list with links to /questions/culture/[id] */}
</div>

{/* Skill Sets section — existing, renamed */}
<div>
  <div className="flex items-center justify-between mb-4">
    <h2>Skill Sets</h2>
    <NewSetButton />
  </div>
  {/* existing list — pass_threshold display removed */}
</div>
```

---

## Task 17 — `app/(admin)/questions/culture/[setId]/page.tsx` (NEW)

```typescript
import { createClient } from '@/lib/supabase/server'   // matches skill set page pattern
// ...
const { data: set } = await supabase
  .from('culture_question_sets')
  .select('id, name, is_active')
  .eq('id', setId)
  .maybeSingle()

if (!set) notFound()

const { data: questions } = await supabase
  .from('questions')
  .select('id, variants, rubric, weight, order_index')
  .eq('culture_set_id', setId)
  .is('deleted_at', null)
  .order('order_index', { ascending: true })

const questionRows = (questions ?? []).map(q => ({
  ...q, type: 'scored' as const, fail_value: null, kind: 'culture',
}))

return (
  <div className="p-8 max-w-3xl">
    <QuestionSetEditor
      setId={setId}
      initialName={set.name as string}
      isCulture={true}
      initialQuestions={questionRows}
    />
  </div>
)
```

---

## Task 18 — `app/(admin)/questions/[setId]/page.tsx` (MODIFIED)

```tsx
<QuestionSetEditor
  setId={setId}
  initialName={set.job_title as string}   // prop renamed
  isCulture={false}
  initialQuestions={...}
  // initialThreshold REMOVED
/>
```

Remove `pass_threshold` from the select string and from the destructured fields.

---

## Task 19 — `components/admin/applicants/ApplicantPanel.tsx` (MODIFIED)

Updated `ScreenResult` interface (add nullable fields):
```typescript
culture_score: number | null
skill_score: number | null
final_score: number | null
culture_weight_at_time: number | null
skill_weight_at_time: number | null
culture_briefing: string | null
skill_briefing: string | null
```

Score display JSX — replace current single-score section:
```tsx
{/* Split scores for new records, legacy bar for old */}
{detail.screenResult.final_score !== null ? (
  <>
    {detail.screenResult.culture_score !== null && (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">
            Culture Score
            {detail.screenResult.culture_weight_at_time != null && (
              <span className="text-xs text-gray-400 ml-1">
                ({detail.screenResult.culture_weight_at_time}% weight)
              </span>
            )}
          </span>
        </div>
        <ScoreBar score={detail.screenResult.culture_score} max={100} />
      </div>
    )}
    {detail.screenResult.skill_score !== null && (
      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-sm text-gray-600">
            Skill Score
            {detail.screenResult.skill_weight_at_time != null && (
              <span className="text-xs text-gray-400 ml-1">
                ({detail.screenResult.skill_weight_at_time}% weight)
              </span>
            )}
          </span>
        </div>
        <ScoreBar score={detail.screenResult.skill_score} max={100} />
      </div>
    )}
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-medium text-gray-700">Final Score</span>
        <span className="text-xs text-gray-400">
          threshold: {detail.screenResult.threshold_at_time ?? '—'}
        </span>
      </div>
      <ScoreBar score={detail.screenResult.final_score} max={100} />
    </div>
  </>
) : (
  detail.screenResult.total_score !== null && (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-gray-600">Score</span>
        <span className="text-xs text-gray-400">
          threshold: {detail.screenResult.threshold_at_time ?? '—'}
        </span>
      </div>
      <ScoreBar score={detail.screenResult.total_score} max={100} />
    </div>
  )
)}
```

Briefings section — replace current `manager_briefing` block:
```tsx
{detail.screenResult.culture_briefing && (
  <div>
    <p className="text-xs text-gray-400 mb-1">Culture Fit</p>
    <p className="text-sm text-gray-700 leading-relaxed">
      {detail.screenResult.culture_briefing}
    </p>
  </div>
)}
{(detail.screenResult.skill_briefing ?? detail.screenResult.manager_briefing) && (
  <div>
    <p className="text-xs text-gray-400 mb-1">
      {detail.screenResult.skill_briefing ? 'Skill Briefing' : 'Manager Briefing'}
    </p>
    <p className="text-sm text-gray-700 leading-relaxed">
      {detail.screenResult.skill_briefing ?? detail.screenResult.manager_briefing}
    </p>
  </div>
)}
```

Also add error state to the detail fetch (audit item 13):
```typescript
const [fetchError, setFetchError] = useState(false)

// In useEffect:
fetch(`/api/admin/applications/${appId}/detail`)
  .then(r => r.ok ? r.json() : Promise.reject(r))
  .then(d => setDetail(d))
  .catch(() => setFetchError(true))
  .finally(() => setLoading(false))

// In JSX:
{fetchError && (
  <div className="flex flex-col items-center justify-center h-32 gap-2">
    <p className="text-sm text-gray-400">Failed to load details.</p>
    <button
      onClick={() => { setFetchError(false); setLoading(true); /* re-trigger useEffect */ }}
      className="text-xs text-blue-600 hover:underline"
    >
      Retry
    </button>
  </div>
)}
```

---

## Task 20 — `app/api/admin/applications/[id]/detail/route.ts` (MODIFIED)

Update `screen_results` select:
```typescript
.select(`
  application_id, passed,
  total_score, threshold_at_time,
  culture_score, skill_score, final_score,
  culture_weight_at_time, skill_weight_at_time,
  qualitative_summary, manager_briefing,
  culture_briefing, skill_briefing
`)
```

---

## Task 21 — `lib/db/question-sets.ts` (MODIFIED)

Remove `passThreshold` from `QuestionSet` interface and from the select string. The column remains in the DB. Check for any remaining callers after Tasks 7 and 8 — if none, the function can be deleted.

---

## Task 22 — `lib/db/applications.ts` (MODIFIED)

Update `getApplicationWithDetails` — remove `pass_threshold` from the `question_sets(...)` embed since it's now job-level. Also stop embedding `questions(*)` here since the scoring path now uses `getJobScoringContext` directly.

The screen-start route (`app/api/screen/[token]/route.ts`) must use `getJobScoringContext` instead of relying on the embedded questions from `getApplicationWithDetails` (Task 9 already covers this).

---

## Jobs Admin Page — `app/(admin)/jobs/page.tsx` (MODIFIED)

Fetch culture sets and pass to `JobsClient`:
```typescript
const { data: cultureSets } = await supabase
  .from('culture_question_sets')
  .select('id, name')
  .order('created_at', { ascending: false })

<JobsClient jobs={...} questionSets={...} cultureSets={cultureSets ?? []} />
```

---

## Deprecated / Remove

| Item | Action |
|------|--------|
| `question_sets.pass_threshold` DB column | Keep in DB; stop reading/writing in code |
| `QuestionSet.passThreshold` TypeScript field | Remove from interface (Task 21) |
| `QuestionSetEditor` `initialThreshold` prop | Remove (Task 13) |
| Pass threshold slider in QuestionSetEditor | Remove (Task 13) |
| `pass_threshold` in questions PATCH/POST routes | Remove from schemas (Task 12) |
| `screen_results.manager_briefing` as sole briefing | Keep populating; stop showing as only display |
| `getQuestionSetWithQuestions` in process-events | Replace with `getJobScoringContext` (Task 7) |
| `getQuestionSetWithQuestions` in simulate-call | Replace with `getJobScoringContext` (Task 8) |
| `getQuestionSetWithQuestions` in scheduled-calls | Replace with `getJobScoringContext` (Task 9) |
| Duplicate `getCompanyPipelineMode` call in process-events | Remove second call, use snapshotted value (Task 7) |
| `saveScreenAnswers` in `lib/scoring/engine.ts` | Dead function — delete (Task 6) |

---

## Implementation Order

```
Task 1  (migration — prerequisite for everything)
  ├─► Task 2  (culture-question-sets.ts)
  ├─► Task 4  (jobs.ts)
  └─► Task 5  (screen-results.ts)
       └─► Task 3  (scoring-context.ts) — depends on 1, 4
             └─► Task 6  (engine.ts)
                   ├─► Task 7  (process-events) — depends on 3, 5, 6
                   └─► Task 8  (simulate-call) — depends on 3, 5, 6
Task 9  (vapi/assistant + callers) — depends on 3
Task 10 (culture API routes) — depends on 2
Task 11 (jobs PATCH route) — depends on 1
Task 12 (skill set cleanup) — independent
Task 13 (QuestionSetEditor) — depends on 10, 12
Task 14 (NewSetButton) — depends on 10
Task 15 (JobsClient) — depends on 11
Task 16 (questions page) — depends on 13, 14
Task 17 (culture set page) — depends on 13
Task 18 (skill set page) — depends on 13
Task 19 (ApplicantPanel) — depends on 5
Task 20 (detail API route) — depends on 1
Task 21 (question-sets.ts cleanup) — depends on 7, 8, 9
Task 22 (applications.ts) — depends on 9
Jobs page update — depends on 15
```
