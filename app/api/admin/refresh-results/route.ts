import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { fetchMatchResult } from '@/lib/matchResultFetcher'
import type { Match } from '@/lib/types'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: Request) {
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

  // Optionally scope to a single match via body { matchId }
  let matchId: string | undefined
  try {
    const body = await request.json()
    matchId = body.matchId
  } catch { /* empty body = refresh all */ }

  const service = createServiceClient()
  const cutoff = new Date(Date.now() - 90 * 60 * 1000).toISOString()

  let query = service
    .from('matches')
    .select('*')
    .eq('result_final', false)
    .lte('kickoff_at', cutoff)

  if (matchId) query = query.eq('id', matchId) as typeof query

  const { data: pending, error: queryError } = await query
  if (queryError) return Response.json({ error: queryError.message }, { status: 500 })
  if (!pending || pending.length === 0) {
    return Response.json({ updated: 0, skipped: 0, errors: [] })
  }

  let updated = 0
  let skipped = 0
  const errors: string[] = []

  for (const match of pending as Match[]) {
    const result = await fetchMatchResult(match)

    if (!result) {
      skipped++
      errors.push(`No result found for ${match.home_team} vs ${match.away_team}`)
      continue
    }

    const { error: updateError } = await service
      .from('matches')
      .update({
        home_score: result.homeScore,
        away_score: result.awayScore,
        result_final: true,
        predictions_locked: true,
        ...(result.penaltyWinner !== null ? { penalty_winner: result.penaltyWinner } : {}),
      })
      .eq('id', match.id)
      .eq('result_final', false)

    if (updateError) {
      errors.push(`Update failed for ${match.home_team} vs ${match.away_team}: ${updateError.message}`)
      skipped++
    } else {
      updated++
      console.log(`[refresh-results] ${match.home_team} ${result.homeScore}-${result.awayScore} ${match.away_team}`)
    }
  }

  return Response.json({ updated, skipped, errors })
}
