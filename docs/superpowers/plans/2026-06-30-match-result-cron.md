# Match Result Auto-Update — One-Time Scheduled Jobs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** For every unplayed World Cup match, schedule five one-time HTTP jobs at T+15, T+30, T+60, T+90, and T+120 minutes after the match is expected to finish. Each job fetches the result from a sports API and writes it to Supabase. Once the tournament ends and all matches have results, no jobs remain — nothing lingers.

**Architecture:** QStash (by Upstash) is used for one-time future-scheduled HTTP callbacks — it is the correct tool for this because Vercel Cron only supports recurring schedules. An admin API route (`POST /api/admin/schedule-match-jobs`) reads all unplayed matches from Supabase and enqueues five QStash messages per match, each targeting `POST /api/jobs/update-match-result` at a future timestamp. The job handler verifies the QStash signature, fetches the score from ESPN (fallback: football-data.org), and writes `home_score`, `away_score`, `result_final = true`, and `penalty_winner` to Supabase via the service-role client. Jobs are idempotent — if a result is already set when a job fires, it exits immediately. No `vercel.json` cron configuration is needed.

**Tech Stack:** Next.js 16.2.9 App Router (route.ts), QStash by Upstash (`@upstash/qstash`), `@supabase/supabase-js` v2 with service role key, ESPN unofficial soccer API (primary, no key), football-data.org API (fallback, free key), Vitest for unit tests.

**Answer to "does anything linger after the tournament?"** No. QStash messages are one-time deliveries. Once all scheduled jobs have fired, the queue is empty. There are no recurring crons to disable.

## Data Sources

Two APIs are tried in order. The first one that returns a completed result for the match wins.

### Primary: ESPN (unofficial, no key required)
```
GET https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=YYYYMMDD&limit=50
```
No API key needed. Replace `YYYYMMDD` with the match date in UTC (e.g. `20261014`).

Response shape relevant fields:
```json
{
  "events": [{
    "status": { "type": { "completed": true } },
    "competitions": [{
      "competitors": [
        { "homeAway": "home", "team": { "displayName": "Spain" }, "score": "2" },
        { "homeAway": "away", "team": { "displayName": "France" }, "score": "1" }
      ],
      "notes": [{ "text": "Spain won on penalties" }]
    }]
  }]
}
```
> The slug `fifa.world` is unconfirmed for WC 2026. If it returns empty, try `fifa.worldcup` or `fifa.world2026`. See Troubleshooting.

### Fallback: football-data.org (free tier, API key required)
Docs: https://www.football-data.org/documentation/quickstart

Free tier: 10 requests/minute, 100 requests/day — more than enough.
Register at https://www.football-data.org/ → get a free API key → set as `FOOTBALL_DATA_API_KEY`.

```
GET https://api.football-data.org/v4/competitions/WC/matches?dateFrom=2026-10-14&dateTo=2026-10-14&status=FINISHED
Header: X-Auth-Token: {FOOTBALL_DATA_API_KEY}
```

Response shape relevant fields:
```json
{
  "matches": [{
    "status": "FINISHED",
    "homeTeam": { "name": "Spain" },
    "awayTeam": { "name": "France" },
    "score": {
      "fullTime": { "home": 2, "away": 1 },
      "penalties": { "home": 4, "away": 3 }
    }
  }]
}
```
`score.penalties` is non-null when the match went to a shootout; the team with the higher value wins.

## Global Constraints

- Next.js version: 16.2.9 — App Router only. Read `node_modules/next/dist/docs/` before writing any code.
- Supabase project: `dltgbifqdwnynimhiguf`. URL: `https://dltgbifqdwnynimhiguf.supabase.co`.
- `SUPABASE_SERVICE_ROLE_KEY` — server-side only, never in browser code.
- `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` — server-side only.
- `FOOTBALL_DATA_API_KEY` — optional fallback; job handler works without it (ESPN-only mode).
- All secrets go in `.env.local` AND Vercel dashboard → Settings → Environment Variables. Never commit them.
- No `vercel.json` cron configuration. There are no recurring schedules anywhere in this feature.
- The schedule-seeding endpoint (`/api/admin/schedule-match-jobs`) must be protected — it checks `is_admin` from the Supabase `profiles` table using the caller's session cookie.
- The job handler (`/api/jobs/update-match-result`) must verify the QStash signature — do not skip this, it prevents anyone from replaying job payloads.
- Expected match end time = `kickoff_at + 2 hours`. Jobs fire at +15, +30, +60, +90, +120 minutes after that.

---

### Task 1: Set up QStash account and environment variables

**Files:**
- Modify: `.env.local` (instruction only — never commit)

**Interfaces:**
- Produces: `QSTASH_TOKEN` available as `process.env.QSTASH_TOKEN`
- Produces: `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` available in the job handler for signature verification

- [ ] **Step 1: Create a free QStash account**

Go to https://console.upstash.com/ → sign up → create a QStash instance.

In the QStash dashboard, copy:
- **QSTASH_TOKEN** — used to publish messages
- **QSTASH_CURRENT_SIGNING_KEY** — used to verify incoming job requests
- **QSTASH_NEXT_SIGNING_KEY** — rotated key, also used for verification

- [ ] **Step 2: Install the QStash SDK**

```bash
npm install @upstash/qstash
```

Expected: `@upstash/qstash` appears in `dependencies` in `package.json`.

- [ ] **Step 3: Add secrets to `.env.local`**

Append to `.env.local` (do not commit):
```
QSTASH_TOKEN=<paste from Upstash dashboard>
QSTASH_CURRENT_SIGNING_KEY=<paste from Upstash dashboard>
QSTASH_NEXT_SIGNING_KEY=<paste from Upstash dashboard>
FOOTBALL_DATA_API_KEY=<optional — register at football-data.org for free>
```

- [ ] **Step 4: Add secrets to Vercel dashboard**

Go to Vercel dashboard → Project → Settings → Environment Variables. Add each of the four keys above (Production + Preview + Development). The job handler will not work without them deployed.

- [ ] **Step 5: Commit the SDK addition**

```bash
git add package.json package-lock.json
git commit -m "feat: add @upstash/qstash for one-time match job scheduling"
```

---

### Task 2: Create Supabase service-role client helper

**Files:**
- Create: `lib/supabase/service.ts`

**Interfaces:**
- Produces: `createServiceClient(): SupabaseClient<Database>` — bypasses RLS, server-side only

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

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/supabase/service.ts
git commit -m "feat: add service-role supabase client for server-side use"
```

---

### Task 3: Implement `lib/matchResultFetcher.ts` — sports API fetch logic

**Files:**
- Create: `lib/matchResultFetcher.ts`
- Create: `lib/matchResultFetcher.test.ts`
- Create: `vitest.config.ts`
- Modify: `package.json` (add vitest, add `test` script)

**Interfaces:**
- Consumes: `Match` from `@/lib/types`
- Produces: `fetchMatchResult(match: Match): Promise<MatchResult | null>`
  ```typescript
  type MatchResult = {
    homeScore: number
    awayScore: number
    penaltyWinner: string | null  // team name string, or null if no shootout
  }
  ```
- Produces (exported for tests): `normalizeTeamName(name: string): string`
- Produces (exported for tests): `parseESPNPenaltyWinner(notes: Array<{ text: string }>): string | null`
- Produces (exported for tests): `parseFDOPenaltyWinner(score: { penalties: { home: number; away: number } | null }, homeTeam: string, awayTeam: string): string | null`

- [ ] **Step 1: Install Vitest**

```bash
npm install -D vitest @vitest/coverage-v8
```

- [ ] **Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: { environment: 'node' },
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
})
```

- [ ] **Step 3: Add `test` script to `package.json`**

In the `"scripts"` object, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Write failing tests in `lib/matchResultFetcher.test.ts`**

```typescript
import { describe, it, expect } from 'vitest'
import {
  normalizeTeamName,
  parseESPNPenaltyWinner,
  parseFDOPenaltyWinner,
} from './matchResultFetcher'

describe('normalizeTeamName', () => {
  it('lowercases and strips non-alphanumeric', () => {
    expect(normalizeTeamName('Netherlands')).toBe('netherlands')
  })
  it('maps "United States" to "usa"', () => {
    expect(normalizeTeamName('United States')).toBe('usa')
  })
  it('strips accents via NFD decomposition', () => {
    expect(normalizeTeamName('Côte d\'Ivoire')).toBe('cotedivoire')
  })
  it('strips hyphens', () => {
    expect(normalizeTeamName('Bosnia-Herzegovina')).toBe('bosniaherzegovina')
  })
})

describe('parseESPNPenaltyWinner', () => {
  it('returns null for empty notes', () => {
    expect(parseESPNPenaltyWinner([])).toBeNull()
  })
  it('returns null when no penalty mention', () => {
    expect(parseESPNPenaltyWinner([{ text: 'Attendance: 80,000' }])).toBeNull()
  })
  it('extracts single-word winner', () => {
    expect(parseESPNPenaltyWinner([{ text: 'Spain won on penalties' }])).toBe('Spain')
  })
  it('extracts multi-word winner', () => {
    expect(parseESPNPenaltyWinner([{ text: 'South Korea won on penalties' }])).toBe('South Korea')
  })
})

describe('parseFDOPenaltyWinner', () => {
  it('returns null when penalties is null', () => {
    expect(parseFDOPenaltyWinner({ penalties: null }, 'Spain', 'France')).toBeNull()
  })
  it('returns home team when home penalty score is higher', () => {
    expect(parseFDOPenaltyWinner({ penalties: { home: 4, away: 3 } }, 'Spain', 'France')).toBe('Spain')
  })
  it('returns away team when away penalty score is higher', () => {
    expect(parseFDOPenaltyWinner({ penalties: { home: 2, away: 4 } }, 'Spain', 'France')).toBe('France')
  })
})
```

- [ ] **Step 5: Run tests to confirm they fail**

```bash
npm test
```

Expected: FAIL — "Cannot find module './matchResultFetcher'".

- [ ] **Step 6: Implement `lib/matchResultFetcher.ts`**

```typescript
import type { Match } from '@/lib/types'

export type MatchResult = {
  homeScore: number
  awayScore: number
  penaltyWinner: string | null
}

// ─── Team name normalisation ──────────────────────────────────────────────────

const OVERRIDES: Record<string, string> = {
  unitedstates: 'usa',
  unitedstatesofamerica: 'usa',
  republicofkorea: 'southkorea',
  korearepublic: 'southkorea',
  democraticrepublicofthecongo: 'drcongo',
}

export function normalizeTeamName(name: string): string {
  const ascii = name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
  return OVERRIDES[ascii] ?? ascii
}

// ─── ESPN helpers ─────────────────────────────────────────────────────────────

export function parseESPNPenaltyWinner(notes: Array<{ text: string }>): string | null {
  for (const note of notes) {
    const lower = note.text.toLowerCase()
    if (!lower.includes('penalt') && !lower.includes('shootout')) continue
    const m = note.text.match(/^(.+?)\s+won\b/i)
    if (m) return m[1]
  }
  return null
}

function toDateKey(isoString: string): string {
  const d = new Date(isoString)
  return [
    d.getUTCFullYear(),
    String(d.getUTCMonth() + 1).padStart(2, '0'),
    String(d.getUTCDate()).padStart(2, '0'),
  ].join('')
}

async function fetchFromESPN(match: Match): Promise<MatchResult | null> {
  // NOTE: verify the slug 'fifa.world' works for WC 2026.
  // Alternative slugs to try if it returns empty: 'fifa.worldcup', 'fifa.world2026'
  const dateKey = toDateKey(match.kickoff_at)
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=${dateKey}&limit=50`

  const res = await fetch(url, {
    headers: { 'User-Agent': 'prode-international/1.0' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`ESPN ${res.status}`)

  const data = await res.json()
  const events: unknown[] = data.events ?? []

  const homeNorm = normalizeTeamName(match.home_team)
  const awayNorm = normalizeTeamName(match.away_team)

  for (const event of events as any[]) {
    const comp = event.competitions?.[0]
    if (!comp) continue
    const homeComp = comp.competitors?.find((c: any) => c.homeAway === 'home')
    const awayComp = comp.competitors?.find((c: any) => c.homeAway === 'away')
    if (!homeComp || !awayComp) continue

    if (
      normalizeTeamName(homeComp.team.displayName) !== homeNorm ||
      normalizeTeamName(awayComp.team.displayName) !== awayNorm
    ) continue

    if (!event.status?.type?.completed) return null  // match found but still in progress

    return {
      homeScore: parseInt(homeComp.score, 10),
      awayScore: parseInt(awayComp.score, 10),
      penaltyWinner: match.is_knockout
        ? parseESPNPenaltyWinner(comp.notes ?? [])
        : null,
    }
  }

  return null  // match not found in ESPN response
}

// ─── football-data.org helpers ────────────────────────────────────────────────

export function parseFDOPenaltyWinner(
  score: { penalties: { home: number; away: number } | null },
  homeTeam: string,
  awayTeam: string
): string | null {
  if (!score.penalties) return null
  return score.penalties.home > score.penalties.away ? homeTeam : awayTeam
}

async function fetchFromFDO(match: Match): Promise<MatchResult | null> {
  const apiKey = process.env.FOOTBALL_DATA_API_KEY
  if (!apiKey) return null  // fallback disabled

  const d = new Date(match.kickoff_at)
  const dateStr = d.toISOString().slice(0, 10)  // YYYY-MM-DD
  const url = `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${dateStr}&dateTo=${dateStr}&status=FINISHED`

  const res = await fetch(url, {
    headers: { 'X-Auth-Token': apiKey },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`football-data.org ${res.status}`)

  const data = await res.json()
  const matches: unknown[] = data.matches ?? []

  const homeNorm = normalizeTeamName(match.home_team)
  const awayNorm = normalizeTeamName(match.away_team)

  for (const m of matches as any[]) {
    if (m.status !== 'FINISHED') continue
    if (
      normalizeTeamName(m.homeTeam.name) !== homeNorm ||
      normalizeTeamName(m.awayTeam.name) !== awayNorm
    ) continue

    const homeScore: number = m.score.fullTime.home
    const awayScore: number = m.score.fullTime.away
    const penaltyWinner = match.is_knockout
      ? parseFDOPenaltyWinner(m.score, match.home_team, match.away_team)
      : null

    return { homeScore, awayScore, penaltyWinner }
  }

  return null
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchMatchResult(match: Match): Promise<MatchResult | null> {
  // Try ESPN first
  try {
    const result = await fetchFromESPN(match)
    if (result) return result
  } catch (e) {
    console.warn(`[fetchMatchResult] ESPN failed for match ${match.id}:`, (e as Error).message)
  }

  // Fallback to football-data.org
  try {
    const result = await fetchFromFDO(match)
    if (result) return result
  } catch (e) {
    console.warn(`[fetchMatchResult] FDO failed for match ${match.id}:`, (e as Error).message)
  }

  return null
}
```

- [ ] **Step 7: Run tests**

```bash
npm test
```

Expected:
```
✓ lib/matchResultFetcher.test.ts (10)
Test Files  1 passed (1)
Tests  10 passed (10)
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add lib/matchResultFetcher.ts lib/matchResultFetcher.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat: add match result fetcher with ESPN and football-data.org fallback"
```

---

### Task 4: Create the job handler `POST /api/jobs/update-match-result`

This is the endpoint QStash calls at each scheduled time. It verifies the QStash signature, fetches the result for the given match, and writes it to Supabase.

**Files:**
- Create: `app/api/jobs/update-match-result/route.ts`

**Interfaces:**
- Consumes: QStash message body `{ matchId: string }`
- Consumes: `fetchMatchResult(match)` from `@/lib/matchResultFetcher`
- Consumes: `createServiceClient()` from `@/lib/supabase/service`
- Produces: `POST /api/jobs/update-match-result`
  - 200 `{ status: "updated" | "already_done" | "not_finished_yet" | "not_found" }`
  - 401 when QStash signature is invalid

- [ ] **Step 1: Check the QStash receiver API**

The `@upstash/qstash` package exports a `Receiver` class for signature verification:
```typescript
import { Receiver } from '@upstash/qstash'
const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})
// Throws if invalid:
await receiver.verify({ signature: req.headers['upstash-signature'], body: rawBody })
```

- [ ] **Step 2: Create `app/api/jobs/update-match-result/route.ts`**

```typescript
import { Receiver } from '@upstash/qstash'
import { fetchMatchResult } from '@/lib/matchResultFetcher'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const maxDuration = 30

const receiver = new Receiver({
  currentSigningKey: process.env.QSTASH_CURRENT_SIGNING_KEY!,
  nextSigningKey: process.env.QSTASH_NEXT_SIGNING_KEY!,
})

export async function POST(request: Request) {
  const rawBody = await request.text()

  // Verify the request came from QStash, not an arbitrary caller
  try {
    await receiver.verify({
      signature: request.headers.get('upstash-signature') ?? '',
      body: rawBody,
    })
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const { matchId } = JSON.parse(rawBody) as { matchId: string }
  const supabase = createServiceClient()

  // Fetch the match
  const { data: match, error: fetchError } = await supabase
    .from('matches')
    .select('*')
    .eq('id', matchId)
    .single()

  if (fetchError || !match) {
    return Response.json({ status: 'not_found', matchId })
  }

  // Already done — idempotent exit
  if (match.result_final) {
    return Response.json({ status: 'already_done', matchId })
  }

  const result = await fetchMatchResult(match)

  if (!result) {
    // APIs returned no completed result — match may still be in progress
    return Response.json({ status: 'not_finished_yet', matchId })
  }

  const payload: Record<string, unknown> = {
    home_score: result.homeScore,
    away_score: result.awayScore,
    result_final: true,
    predictions_locked: true,
  }
  if (result.penaltyWinner !== null) payload.penalty_winner = result.penaltyWinner

  // Guard: only update if still not final (prevents concurrent job overwrite)
  await supabase
    .from('matches')
    .update(payload)
    .eq('id', matchId)
    .eq('result_final', false)

  console.log(`[update-match-result] updated ${matchId}: ${result.homeScore}-${result.awayScore}`)
  return Response.json({ status: 'updated', matchId, ...result })
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/jobs/update-match-result/route.ts
git commit -m "feat: add QStash job handler for individual match result updates"
```

---

### Task 5: Create the schedule-seeding endpoint `POST /api/admin/schedule-match-jobs`

This endpoint is called once (or whenever new matches become known) to enqueue all five QStash jobs for every unplayed match. It is admin-only.

**Files:**
- Create: `app/api/admin/schedule-match-jobs/route.ts`

**Interfaces:**
- Consumes: `createClient()` from `@/lib/supabase/server` (reads caller's session to check `is_admin`)
- Consumes: `createServiceClient()` from `@/lib/supabase/service` (reads all unplayed matches)
- Consumes: `QSTASH_TOKEN` env var
- Produces: `POST /api/admin/schedule-match-jobs`
  - Optional body: `{ matchId: string }` to schedule a single match (omit to schedule all unplayed)
  - 200 `{ scheduled: number, jobs: Array<{ matchId, notBefore }> }`
  - 401 if caller is not admin

- [ ] **Step 1: Create `app/api/admin/schedule-match-jobs/route.ts`**

```typescript
import { Client } from '@upstash/qstash'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import type { Match } from '@/lib/types'

export const runtime = 'nodejs'

// Minutes after expected match end to fire each job
const OFFSETS_MINUTES = [15, 30, 60, 90, 120]
const MATCH_DURATION_MINUTES = 120  // kickoff + 2h = expected end

function jobsForMatch(match: Match, baseUrl: string) {
  const kickoff = new Date(match.kickoff_at).getTime()
  const expectedEnd = kickoff + MATCH_DURATION_MINUTES * 60 * 1000

  return OFFSETS_MINUTES.map(offset => ({
    matchId: match.id,
    notBefore: Math.floor((expectedEnd + offset * 60 * 1000) / 1000),  // unix seconds
    url: `${baseUrl}/api/jobs/update-match-result`,
  }))
}

export async function POST(request: Request) {
  // Check admin status from caller's session
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Determine base URL (production vs preview)
  const origin = request.headers.get('origin') ??
    process.env.NEXT_PUBLIC_APP_URL ??
    'https://prode-international.vercel.app'

  // Optionally scope to a single match
  let body: { matchId?: string } = {}
  try { body = await request.json() } catch { /* empty body is fine */ }

  const serviceClient = createServiceClient()
  let query = serviceClient
    .from('matches')
    .select('*')
    .eq('result_final', false)
    .gt('kickoff_at', new Date().toISOString())  // only future matches

  if (body.matchId) query = query.eq('id', body.matchId) as typeof query

  const { data: matches, error } = await query
  if (error) return Response.json({ error: error.message }, { status: 500 })
  if (!matches || matches.length === 0) {
    return Response.json({ scheduled: 0, jobs: [] })
  }

  const qstash = new Client({ token: process.env.QSTASH_TOKEN! })
  const scheduled: Array<{ matchId: string; notBefore: number }> = []

  for (const match of matches as Match[]) {
    for (const job of jobsForMatch(match, origin)) {
      await qstash.publishJSON({
        url: job.url,
        body: { matchId: job.matchId },
        notBefore: job.notBefore,
      })
      scheduled.push({ matchId: job.matchId, notBefore: job.notBefore })
    }
  }

  console.log(`[schedule-match-jobs] queued ${scheduled.length} jobs for ${matches.length} matches`)
  return Response.json({ scheduled: scheduled.length, jobs: scheduled })
}
```

- [ ] **Step 2: Add `NEXT_PUBLIC_APP_URL` to env (optional but recommended)**

Add to `.env.local`:
```
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Add to Vercel dashboard (Production only):
```
NEXT_PUBLIC_APP_URL=https://prode-international.vercel.app
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/admin/schedule-match-jobs/route.ts
git commit -m "feat: add admin endpoint to seed QStash jobs for upcoming matches"
```

---

### Task 6: Deploy and seed the schedule

- [ ] **Step 1: Push to trigger Vercel deploy**

```bash
git push
```

Confirm the Vercel build succeeds in the dashboard.

- [ ] **Step 2: Confirm all env vars are set in Vercel**

Check Vercel dashboard → Project → Settings → Environment Variables. These must exist:
- `SUPABASE_SERVICE_ROLE_KEY`
- `QSTASH_TOKEN`
- `QSTASH_CURRENT_SIGNING_KEY`
- `QSTASH_NEXT_SIGNING_KEY`
- `NEXT_PUBLIC_APP_URL` (set to `https://prode-international.vercel.app`)
- `FOOTBALL_DATA_API_KEY` (optional fallback)

- [ ] **Step 3: Seed jobs for all upcoming matches**

Log in to the app as an admin user (jamesbluecrow@gmail.com or franbrignone@gmail.com), then run:

```bash
# Get your session cookie from the browser (DevTools → Application → Cookies → sb-*-auth-token)
# Or call this from the Admin panel once a UI button is added (see optional Task 7)
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: <paste your sb-auth-token cookie here>" \
  https://prode-international.vercel.app/api/admin/schedule-match-jobs | jq
```

Expected:
```json
{ "scheduled": 125, "jobs": [...] }
```
(25 matches × 5 jobs = 125, if 25 matches remain at time of seeding)

- [ ] **Step 4: Verify jobs appear in QStash dashboard**

Go to https://console.upstash.com/ → QStash → Messages. Confirm the scheduled messages appear with future `notBefore` timestamps.

- [ ] **Step 5: Smoke-test with a single past match**

Temporarily revert a finished match in Supabase SQL editor:
```sql
UPDATE matches
SET result_final = false, home_score = NULL, away_score = NULL, predictions_locked = false
WHERE home_team = 'South Africa' AND away_team = 'Canada'
  AND result_final = true
LIMIT 1;
```

Get the match ID:
```sql
SELECT id FROM matches WHERE home_team = 'South Africa' AND away_team = 'Canada';
```

Manually invoke the job handler (simulating a QStash call — skip signature check only in local dev):
```bash
# On localhost with QSTASH_CURRENT_SIGNING_KEY set, the Receiver will reject requests
# without a valid signature. To test locally, temporarily return 200 in the handler
# before the receiver.verify() call, then revert after testing.
curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"matchId":"<paste match id>"}' \
  http://localhost:3000/api/jobs/update-match-result | jq
```

Expected: `{ "status": "updated", "matchId": "...", "homeScore": 2, "awayScore": 0, "penaltyWinner": null }` (actual scores will vary).

Verify in Supabase that the match now has `result_final = true` and correct scores.

---

## Optional Task 7: Add "Seed schedule" button to Admin panel

Once the schedule-seeding API is in place, an admin UI button is more convenient than running curl.

In `app/admin/AdminClient.tsx`, add a button in the Settings or a new tab that calls `POST /api/admin/schedule-match-jobs`. On click: show a loading state, display the returned `scheduled` count, and list any errors. This is a low-priority enhancement — the curl command in Task 6 Step 3 is sufficient for the tournament.

---

## Troubleshooting

**ESPN returns no results / wrong slug:**
Replace `fifa.world` in `lib/matchResultFetcher.ts` → `fetchFromESPN` with `fifa.worldcup` or `fifa.world2026`. Commit and redeploy. The football-data.org fallback will cover the gap automatically if `FOOTBALL_DATA_API_KEY` is set.

**Team name not matched (job returns `not_finished_yet` but match is done):**
Check logs in Vercel dashboard. Add the mismatched name to `OVERRIDES` in `lib/matchResultFetcher.ts`:
```typescript
const OVERRIDES: Record<string, string> = {
  // existing...
  iriran: 'iran',
}
```
Run `npm test` to verify no regressions, commit, redeploy.

**Jobs not firing:**
Check the QStash dashboard → Messages → filter by status. If messages are stuck in "Failed", check the Vercel function logs for the `/api/jobs/update-match-result` endpoint. The most common cause is a missing env var (`QSTASH_CURRENT_SIGNING_KEY`) causing the signature check to throw before any useful log.

**Re-scheduling a single match after a DB correction:**
```bash
curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Cookie: <admin session cookie>" \
  -d '{"matchId":"<id>"}' \
  https://prode-international.vercel.app/api/admin/schedule-match-jobs | jq
```

**After the tournament: do any jobs linger?**
No. QStash messages are one-time deliveries. Once all 5 jobs per match have fired, the queue is empty. There are no recurring crons anywhere in this feature.
