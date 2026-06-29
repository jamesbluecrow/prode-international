import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeaderboardTable } from '@/components/LeaderboardTable'

export default async function RankingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: rows }, { data: bonuses }, { data: bonusPicks }] = await Promise.all([
    supabase.from('leaderboard').select('*'),
    supabase.from('tournament_bonuses').select('id').eq('key', 'champion').single(),
    supabase.from('bonus_predictions').select('user_id, answer'),
  ])

  // Build a map of user_id → champion pick
  const championBonusId = bonuses?.id ?? null
  const championMap: Record<string, string> = {}
  if (championBonusId && bonusPicks) {
    for (const pick of bonusPicks) {
      if (pick.user_id) championMap[pick.user_id] = pick.answer
    }
  }

  return (
    <div className="py-6">
      <h1 className="font-display text-3xl mb-6">
        <span className="text-[var(--muted)]">RANKING</span>{' '}
        <span className="text-[var(--gold)]">GLOBAL</span>
      </h1>
      {rows && rows.length > 0 ? (
        <LeaderboardTable rows={rows} currentUserId={user.id} championMap={championMap} />
      ) : (
        <p className="text-[var(--muted)] text-center py-12">No points yet.</p>
      )}
    </div>
  )
}
