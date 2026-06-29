# Match Result Auto-Update Cron Job Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a Vercel Cron Job that fires at the 30-minute and 90-minute marks after each World Cup match is expected to finish, detects matches missing results in the database, fetches scores from ESPN's public soccer API (no API key required), and writes `home_score`, `away_score`, `result_final`, `predictions_locked`, and `penalty_winner` back to Supabase.

**Architecture:** A Next.js App Router route handler at `GET /api/cron/update-results` is secured with a shared `CRON_SECRET` bearer token. Vercel's cron scheduler calls it on a fixed schedule targeting the 30-min and 90-min windows after typical World Cup kickoff end times. The handler delegates to `lib/updateMatchResults.ts`, which (1) queries Supabase for matches where `result_final = false` AND `kickoff_at ≤ now − 90 min`, (2) groups them by UTC date, (3) calls ESPN's unofficial soccer scoreboard API for each date, (4) matches ESPN events to DB rows by normalising team names, and (5) writes results back via the service-role Supabase client. The job is fully idempotent — re-running on an already-updated match is a no-op.

**Tech Stack:** Next.js 16.2.9 App Router (route.ts), Vercel Cron (`vercel.json`), `@supabase/supabase-js` v2 with service role key, ESPN unofficial soccer API (no key required), Vitest for unit tests.

## Global Constraints

- Next.js version: 16.2.9 — App Router only. Read `node_modules/next/dist/docs/` before writing any code; heed deprecation notices.
- Supabase project: `dltgbifqdwnynimhiguf`. URL: `https://dltgbifqdwnynimhiguf.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY` must NEVER be exposed to the browser — server-side/cron only. Start with `sb_secret_`.
- `CRON_SECRET` env var must be set in Vercel dashboard AND in `.env.local`. Never commit either to git.
- Vercel **Pro plan** required for `*/30 * * * *` cron frequency. Hobby plan supports at most once per day. See the fallback schedule note in Task 1.
- No changes to existing RLS policies — the service-role key bypasses RLS, which is correct for a cron updating match data.
- The `.eq('result_final', false)` guard in the UPDATE call prevents overwriting a result that was set by another concurrent run.
- Team names in the DB (`home_team`, `away_team`) may differ slightly from ESPN `displayName`. Use the `normalizeTeamName` function defined below as the single source of truth for matching.

---

### Task 1: Add `CRON_SECRET` env var and `vercel.json` cron config

**Files:**
- Create: `vercel.json`
- Modify: `.env.local` (instruction only — never commit)

**Interfaces:**
- Produces: `CRON_SECRET` available as `process.env.CRON_SECRET` in the route handler
- Produces: Vercel cron that sends `GET /api/cron/update-results` with header `Authorization: Bearer {CRON_SECRET}` on the configured schedule

- [ ] **Step 1: Generate a random secret**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Expected: a 64-character hex string. Copy it.

- [ ] **Step 2: Add `CRON_SECRET` to `.env.local`**

Append this line to `.env.local` (create the file if it doesn't exist — do **not** commit it):
```
CRON_SECRET=<paste the generated hex value here>
```

- [ ] **Step 3: Add `CRON_SECRET` to Vercel dashboard**

Go to https://vercel.com/dashboard → your project → Settings → Environment Variables → add:
- Key: `CRON_SECRET`
- Value: same hex value from Step 1
- Environments: Production, Preview, Development

- [ ] **Step 4: Create `vercel.json`**

World Cup 2026 is hosted in USA/Canada/Mexico. Typical UTC kickoff times: 16:00, 19:00, 22:00, 00:00, 01:00. Expected match end (kickoff + 2h): 18:00, 21:00, 00:00, 02:00, 03:00. The schedule below fires at T+30min and T+90min for each of those end times.

```json
{
  "crons": [
    {
      "path": "/api/cron/update-results",
      "schedule": "30 18,19,21,22,0,1,2,3,4 * * *"
    }
  ]
}
```

> **Hobby plan fallback:** Hobby only supports one cron firing per day. Change the schedule to `0 5 * * *` (5:00 AM UTC, after all games from the previous day are done) and the job will catch every result in one daily sweep. Results may be delayed by up to ~14 hours compared to the Pro schedule.
>
> **Simpler alternative (Pro):** `*/30 * * * *` runs every 30 minutes and is equally correct — the job skips runs where no matches need updating. Use this if uncertain about kickoff time distribution.

- [ ] **Step 5: Commit**

```bash
git add vercel.json
git commit -m "feat: add vercel cron schedule for match result updates"
```

---

### Task 2: Create Supabase service-role client helper

**Files:**
- Create: `lib/supabase/service.ts`

**Interfaces:**
- Consumes: `process.env.NEXT_PUBLIC_SUPABASE_URL`, `process.env.SUPABASE_SERVICE_ROLE_KEY`
- Produces: `createServiceClient(): SupabaseClient<Database>` — bypasses RLS, must only be called in server-side code

- [ ] **Step 1: Create `lib/supabase/service.ts`**

```typescript
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types'

export function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors output.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/service.ts
git commit -m "feat: add service-role supabase client for server-side use"
```

---

### Task 3: Implement `lib/updateMatchResults.ts` with ESPN fetch and DB update logic

**Files:**
- Create: `lib/updateMatchResults.ts`
- Create: `lib/updateMatchResults.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (add vitest, add `test` script)

**Interfaces:**
- Consumes: `createServiceClient()` from `@/lib/supabase/service`
- Consumes: `Match` type from `@/lib/types`
- Produces: `updateMatchResults(): Promise<{ updated: number; skipped: number; errors: string[] }>`
- Produces (exported for tests): `normalizeTeamName(name: string): string`
- Produces (exported for tests): `parseESPNPenaltyWinner(notes: Array<{ text: string }>): string | null`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest @vitest/coverage-v8
```

Expected: vitest appears in `devDependencies` in `package.json`.

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
```

- [ ] **Step 3: Add `test` script to `package.json`**

In the `"scripts"` section of `package.json`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write failing tests in `lib/updateMatchResults.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import { normalizeTeamName, parseESPNPenaltyWinner } from './updateMatchResults'

describe('normalizeTeamName', () => {
  it('lowercases and strips non-alphanumeric', () => {
    expect(normalizeTeamName('Netherlands')).toBe('netherlands')
  })

  it('maps "United States" to "usa"', () => {
    expect(normalizeTeamName('United States')).toBe('usa')
  })

  it('handles accented characters by stripping the accent', () => {
    // NFD decomposition: 'ô' → 'o' + combining circumflex → strip combining → 'o'
    expect(normalizeTeamName('Côte d\'Ivoire')).toBe('cotedivoire')
  })

  it('strips hyphens from compound names', () => {
    expect(normalizeTeamName('Bosnia-Herzegovina')).toBe('bosniaherzegovina')
  })

  it('handles already-normalised input', () => {
    expect(normalizeTeamName('brazil')).toBe('brazil')
  })
})

describe('parseESPNPenaltyWinner', () => {
  it('returns null when notes array is empty', () => {
    expect(parseESPNPenaltyWinner([])).toBeNull()
  })

  it('returns null when notes contain no penalty mention', () => {
    expect(parseESPNPenaltyWinner([{ text: 'Attendance: 80,000' }])).toBeNull()
  })

  it('extracts single-word team from "Spain won on penalties"', () => {
    expect(parseESPNPenaltyWinner([{ text: 'Spain won on penalties' }])).toBe('Spain')
  })

  it('extracts multi-word team from "South Korea won on penalties"', () => {
    expect(parseESPNPenaltyWinner([{ text: 'South Korea won on penalties' }])).toBe('South Korea')
  })

  it('handles "penalty shootout" phrasing', () => {
    expect(parseESPNPenaltyWinner([{ text: 'France won after penalty shootout' }])).toBe('France')
  })

  it('ignores non-penalty notes and returns null', () => {
    expect(parseESPNPenaltyWinner([
      { text: 'Germany won on penalties' }
    ])).toBe('Germany')
  })
})
```

- [ ] **Step 5: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — "Cannot find module './updateMatchResults'".

- [ ] **Step 6: Implement `lib/updateMatchResults.ts`**

```typescript
import { createServiceClient } from '@/lib/supabase/service'
import type { Match } from '@/lib/types'

// ─── ESPN API types ──────────────────────────────────────────────────────────

type ESPNNote = { text: string }

type ESPNCompetitor = {
  homeAway: 'home' | 'away'
  team: { displayName: string; abbreviation: string }
  score: string
}

type ESPNEvent = {
  date: string
  status: { type: { name: string; completed: boolean } }
  competitions: Array<{
    competitors: ESPNCompetitor[]
    notes?: ESPNNote[]
  }>
}

// ─── Team name normalisation ─────────────────────────────────────────────────

// Overrides applied AFTER the generic strip — add any mismatches found in production.
const OVERRIDES: Record<string, string> = {
  unitedstates: 'usa',
  unitedstatesofamerica: 'usa',
  unitedkingdom: 'england',
  republicofkorea: 'southkorea',
  korearepublic: 'southkorea',
  democraticrepublicofthecongo: 'drcongo',
}

export function normalizeTeamName(name: string): string {
  // Decompose accented chars (ô → o + combining circumflex), then strip combinings
  const ascii = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return OVERRIDES[ascii] ?? ascii
}

// ─── Penalty winner extraction ───────────────────────────────────────────────

export function parseESPNPenaltyWinner(notes: ESPNNote[]): string | null {
  for (const note of notes) {
    const lower = note.text.toLowerCase()
    if (!lower.includes('penalt') && !lower.includes('shootout')) continue
    // "South Korea won on penalties" → capture everything before " won"
    const m = note.text.match(/^(.+?)\s+won\b/i)
    if (m) return m[1]
  }
  return null
}

// ─── ESPN API fetch ──────────────────────────────────────────────────────────

// dateStr format: YYYYMMDD (e.g. "20261014")
// ESPN competition slug for FIFA World Cup: verify this URL is still correct for
// WC 2026 before deploying. Alternative slug to try: "fifa.worldcup"
async function fetchESPNScoreboard(dateStr: string): Promise<ESPNEvent[]> {
  const url =
    `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard` +
    `?dates=${dateStr}&limit=50`
  const res = await fetch(url, {
    headers: { 'User-Agent': 'prode-international-cron/1.0' },
    cache: 'no-store',
  })
  if (!res.ok) {
    throw new Error(`ESPN API responded ${res.status} for date ${dateStr}`)
  }
  const data = await res.json()
  return (data.events ?? []) as ESPNEvent[]
}

// ─── DB match → ESPN event matching ─────────────────────────────────────────

function toDateKey(isoString: string): string {
  const d = new Date(isoString)
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('')
}

function findESPNEvent(events: ESPNEvent[], match: Match): ESPNEvent | null {
  const homeNorm = normalizeTeamName(match.home_team)
  const awayNorm = normalizeTeamName(match.away_team)

  return (
    events.find(event => {
      const comp = event.competitions[0]
      if (!comp) return false
      const homeComp = comp.competitors.find(c => c.homeAway === 'home')
      const awayComp = comp.competitors.find(c => c.homeAway === 'away')
      if (!homeComp || !awayComp) return false
      return (
        normalizeTeamName(homeComp.team.displayName) === homeNorm &&
        normalizeTeamName(awayComp.team.displayName) === awayNorm
      )
    }) ?? null
  )
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function updateMatchResults(): Promise<{
  updated: number
  skipped: number
  errors: string[]
}> {
  const supabase = createServiceClient()

  // Only consider matches where at least 90 minutes have passed since kickoff
  const cutoff = new Date(Date.now() - 90 * 60 * 1000).toISOString()

  const { data: pendingMatches, error: queryError } = await supabase
    .from('matches')
    .select('*')
    .eq('result_final', false)
    .lte('kickoff_at', cutoff)

  if (queryError) throw new Error(`Supabase query failed: ${queryError.message}`)
  if (!pendingMatches || pendingMatches.length === 0) {
    return { updated: 0, skipped: 0, errors: [] }
  }

  // Group pending matches by UTC date so we make one ESPN call per date
  const byDate = new Map<string, Match[]>()
  for (const match of pendingMatches as Match[]) {
    const key = toDateKey(match.kickoff_at)
    if (!byDate.has(key)) byDate.set(key, [])
    byDate.get(key)!.push(match)
  }

  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (const [dateKey, matches] of byDate) {
    let events: ESPNEvent[]
    try {
      events = await fetchESPNScoreboard(dateKey)
    } catch (e) {
      errors.push(`ESPN fetch for ${dateKey}: ${(e as Error).message}`)
      skipped += matches.length
      continue
    }

    for (const match of matches) {
      const event = findESPNEvent(events, match)

      if (!event) {
        // Not found in ESPN response — team name mismatch or match not yet listed
        errors.push(`No ESPN event found for: ${match.home_team} vs ${match.away_team} on ${dateKey}`)
        skipped++
        continue
      }

      if (!event.status.type.completed) {
        // Match found but still in progress
        skipped++
        continue
      }

      const comp = event.competitions[0]
      const homeComp = comp.competitors.find(c => c.homeAway === 'home')!
      const awayComp = comp.competitors.find(c => c.homeAway === 'away')!

      const homeScore = parseInt(homeComp.score, 10)
      const awayScore = parseInt(awayComp.score, 10)
      const penaltyWinner = match.is_knockout
        ? parseESPNPenaltyWinner(comp.notes ?? [])
        : null

      const payload: Record<string, unknown> = {
        home_score: homeScore,
        away_score: awayScore,
        result_final: true,
        predictions_locked: true,
      }
      if (penaltyWinner !== null) payload.penalty_winner = penaltyWinner

      // .eq('result_final', false) is a guard: if another concurrent run already
      // wrote the result, this update silently matches 0 rows — that's fine.
      const { error: updateError } = await supabase
        .from('matches')
        .update(payload)
        .eq('id', match.id)
        .eq('result_final', false)

      if (updateError) {
        errors.push(
          `Update failed for ${match.home_team} vs ${match.away_team} (${match.id}): ${updateError.message}`
        )
        skipped++
      } else {
        updated++
      }
    }
  }

  return { updated, skipped, errors }
}
```

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected output:
```
✓ lib/updateMatchResults.test.ts (11)
  ✓ normalizeTeamName (5)
  ✓ parseESPNPenaltyWinner (6)

Test Files  1 passed (1)
Tests  11 passed (11)
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add lib/updateMatchResults.ts lib/updateMatchResults.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat: add match result fetcher with ESPN scoreboard API and unit tests"
```

---

### Task 4: Create the cron route handler

**Files:**
- Create: `app/api/cron/update-results/route.ts`

**Interfaces:**
- Consumes: `updateMatchResults()` from `@/lib/updateMatchResults`
- Consumes: `process.env.CRON_SECRET`
- Produces: `GET /api/cron/update-results`
  - 200 `{ success: true, updated: number, skipped: number, errors: string[] }` on success
  - 401 `{ error: "Unauthorized" }` when bearer token is missing or wrong
  - 500 `{ success: false, error: string }` on thrown exception

- [ ] **Step 1: Check Next.js 16 route handler conventions**

Before writing the file, read:
```bash
cat node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route.md | head -60
```

Confirm: route handlers export named HTTP method functions (`GET`, `POST`, etc.) and receive a `Request` argument. The `runtime` and `maxDuration` exports are route segment config constants.

- [ ] **Step 2: Create `app/api/cron/update-results/route.ts`**

```typescript
import { updateMatchResults } from '@/lib/updateMatchResults'

export const runtime = 'nodejs'
export const maxDuration = 60  // seconds — enough for multiple ESPN calls + DB writes

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!secret || authHeader !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await updateMatchResults()
    console.log('[cron:update-results]', JSON.stringify(result))
    return Response.json({ success: true, ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    console.error('[cron:update-results] fatal error:', message)
    return Response.json({ success: false, error: message }, { status: 500 })
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Test the endpoint locally**

Start the dev server:
```bash
npm run dev
```

In a second terminal:
```bash
CRON_SECRET=$(grep ^CRON_SECRET .env.local | cut -d= -f2)
curl -s -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/update-results | jq
```

Expected (when no pending matches exist in dev):
```json
{ "success": true, "updated": 0, "skipped": 0, "errors": [] }
```

Test that an invalid token is rejected:
```bash
curl -s http://localhost:3000/api/cron/update-results | jq
```

Expected:
```json
{ "error": "Unauthorized" }
```

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/update-results/route.ts
git commit -m "feat: add cron route handler for match result updates"
```

---

### Task 5: Deploy and verify end-to-end

**Files:** (no new files — deploy and verify only)

- [ ] **Step 1: Push to trigger Vercel deploy**

```bash
git push
```

Watch the Vercel dashboard for a successful build. If the build fails, check the build logs — the most likely cause is a TypeScript error that `tsc --noEmit` missed.

- [ ] **Step 2: Confirm `CRON_SECRET` is set in Vercel**

Go to Vercel dashboard → Project → Settings → Environment Variables.
Confirm `CRON_SECRET` exists with a non-empty value. If missing, add it from Task 1 Step 1, then trigger a re-deploy (Settings → Deployments → Redeploy).

- [ ] **Step 3: Manually invoke the production endpoint**

```bash
PROD_SECRET=<your CRON_SECRET value>
curl -s \
  -H "Authorization: Bearer $PROD_SECRET" \
  https://prode-international.vercel.app/api/cron/update-results | jq
```

Expected: `{ "success": true, "updated": 0, "skipped": 0, "errors": [] }` (no pending matches between deployments is normal).

- [ ] **Step 4: Verify cron job is registered in Vercel**

Go to Vercel dashboard → Project → Settings → Cron Jobs.
Confirm `/api/cron/update-results` appears with the schedule from `vercel.json`.

If nothing appears, Vercel may not have picked up `vercel.json` yet. Force a re-deploy.

- [ ] **Step 5: Smoke-test with a real match (staging test)**

In the Supabase dashboard (https://supabase.com/dashboard/project/dltgbifqdwnynimhiguf), run this SQL to temporarily revert a known-finished match:

```sql
UPDATE matches
SET result_final = false, home_score = NULL, away_score = NULL, predictions_locked = false
WHERE home_team = 'South Africa' AND away_team = 'Canada'
  AND result_final = true
LIMIT 1;
```

Then invoke the cron endpoint:
```bash
curl -s \
  -H "Authorization: Bearer $PROD_SECRET" \
  https://prode-international.vercel.app/api/cron/update-results | jq
```

Expected:
```json
{ "success": true, "updated": 1, "skipped": 0, "errors": [] }
```

Verify in Supabase that the row now has `result_final = true`, correct scores, and `predictions_locked = true`.

> **If `errors` contains "No ESPN event found":** The ESPN competition slug `fifa.world` may not match WC 2026. Try replacing it with `fifa.worldcup` or `fifa.world2026` in `lib/updateMatchResults.ts` → `fetchESPNScoreboard`. Commit, push, re-test.

---

## Troubleshooting

**ESPN returns a different team name than what's in the DB:**
Add an entry to the `OVERRIDES` map in `lib/updateMatchResults.ts`. For example, if ESPN calls a team "IR Iran" but the DB has "Iran":
```typescript
const OVERRIDES: Record<string, string> = {
  // ...existing entries...
  iriran: 'iran',
}
```
Run `npm test` to ensure no regressions, then commit.

**Cron fires but `updated` is always 0 on days with finished matches:**
Check `errors` in the response. Common causes:
1. ESPN slug wrong — see the smoke-test note above.
2. Team name mismatch — add to `OVERRIDES`.
3. `kickoff_at` in DB is in the future (wrong timezone) — verify stored value in Supabase SQL editor.

**Vercel cron not firing on Hobby plan:**
Change `vercel.json` schedule to `0 5 * * *` (daily at 5:00 AM UTC). All results from the previous day will be captured in one run.
