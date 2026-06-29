import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { LeaderboardTable } from '@/components/LeaderboardTable'

export default async function RankingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rows } = await supabase.from('leaderboard').select('*')

  return (
    <div className="py-6">
      <h1 className="font-display text-3xl mb-6">
        <span className="text-[var(--muted)]">RANKING</span>{' '}
        <span className="text-[var(--gold)]">GLOBAL</span>
      </h1>
      {rows && rows.length > 0 ? (
        <LeaderboardTable rows={rows} currentUserId={user.id} />
      ) : (
        <p className="text-[var(--muted)] text-center py-12">Aún no hay puntos.</p>
      )}
    </div>
  )
}
