import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ChampionPicker } from '@/components/ChampionPicker'

export default async function ChampionPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: bonus }, { data: pick }] = await Promise.all([
    supabase.from('tournament_bonuses').select('*').eq('key', 'champion').single(),
    supabase.from('bonus_predictions').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  const now = new Date().toISOString()
  const isLocked = !!(bonus?.locked || (bonus?.lock_at != null && now >= bonus.lock_at))

  return (
    <div className="py-6">
      <h1 className="font-display text-3xl mb-1">
        <span className="text-[var(--muted)]">WORLD</span>{' '}
        <span className="text-[var(--gold)]">CHAMPION</span>
      </h1>
      {bonus && (
        <p className="text-[var(--muted)] text-sm mb-6">
          {bonus.points > 0 ? `Worth ${bonus.points} points` : 'No points assigned yet'}
          {bonus.lock_at && !isLocked && (
            <span className="ml-2">
              · Closes{' '}
              {new Date(bonus.lock_at).toLocaleDateString('en', {
                day: 'numeric',
                month: 'long',
              })}
            </span>
          )}
        </p>
      )}
      {bonus ? (
        <ChampionPicker
          bonus={bonus}
          currentAnswer={pick?.answer ?? null}
          userId={user.id}
          isLocked={isLocked}
        />
      ) : (
        <p className="text-[var(--muted)]">Not available yet.</p>
      )}
    </div>
  )
}
