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

// Slugs to try in order — WC 2026 slug is unconfirmed, we try all three
const ESPN_SLUGS = ['fifa.world', 'fifa.worldcup', 'fifa.world2026']

async function fetchFromESPN(match: Match): Promise<MatchResult | null> {
  const dateKey = toDateKey(match.kickoff_at)
  const homeNorm = normalizeTeamName(match.home_team)
  const awayNorm = normalizeTeamName(match.away_team)

  for (const slug of ESPN_SLUGS) {
    let data: { events?: unknown[] }
    try {
      const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${dateKey}&limit=50`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'prode-international/1.0' },
        cache: 'no-store',
      })
      if (!res.ok) continue
      data = await res.json()
    } catch {
      continue
    }

    const events: unknown[] = data.events ?? []
    if (events.length === 0) continue

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

      if (!event.status?.type?.completed) return null

      return {
        homeScore: parseInt(homeComp.score, 10),
        awayScore: parseInt(awayComp.score, 10),
        penaltyWinner: match.is_knockout
          ? parseESPNPenaltyWinner(comp.notes ?? [])
          : null,
      }
    }
  }

  return null
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
  if (!apiKey) return null

  const dateStr = new Date(match.kickoff_at).toISOString().slice(0, 10)
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

    return {
      homeScore: m.score.fullTime.home as number,
      awayScore: m.score.fullTime.away as number,
      penaltyWinner: match.is_knockout
        ? parseFDOPenaltyWinner(m.score, match.home_team, match.away_team)
        : null,
    }
  }

  return null
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function fetchMatchResult(match: Match): Promise<MatchResult | null> {
  try {
    const result = await fetchFromESPN(match)
    if (result) return result
  } catch (e) {
    console.warn(`[fetchMatchResult] ESPN failed for ${match.home_team} vs ${match.away_team}:`, (e as Error).message)
  }

  try {
    const result = await fetchFromFDO(match)
    if (result) return result
  } catch (e) {
    console.warn(`[fetchMatchResult] FDO failed for ${match.home_team} vs ${match.away_team}:`, (e as Error).message)
  }

  return null
}
