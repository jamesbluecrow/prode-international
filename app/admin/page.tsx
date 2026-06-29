import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AdminClient } from './AdminClient'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: matches }, { data: deadlines }, { data: champion }, { data: profiles }, { data: newsItems }] =
    await Promise.all([
      supabase.from('matches').select('*').order('kickoff_at'),
      supabase.from('phase_deadlines').select('*'),
      supabase.from('tournament_bonuses').select('*').eq('key', 'champion').single(),
      supabase.from('profiles').select('*').order('display_name'),
      supabase.from('news_items').select('*').order('sort_order').order('created_at', { ascending: false }),
    ])

  return (
    <div className="py-6 space-y-6">
      <h1 className="font-display text-3xl">
        <span className="text-[var(--red)]">ADMIN</span>
      </h1>
      <AdminClient
        matches={matches ?? []}
        deadlines={deadlines ?? []}
        champion={champion}
        profiles={profiles ?? []}
        newsItems={newsItems ?? []}
        currentUserId={user.id}
      />
    </div>
  )
}
