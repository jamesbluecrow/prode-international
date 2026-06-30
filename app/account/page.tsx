import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AccountClient } from './AccountClient'

export default async function AccountPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <div className="py-6 max-w-sm mx-auto">
      <h1 className="font-display text-3xl mb-8">
        <span className="text-[var(--muted)]">MY</span>{' '}
        <span className="text-[var(--gold)]">PROFILE</span>
      </h1>
      <AccountClient
        userId={user.id}
        displayName={profile?.display_name ?? ''}
        avatarUrl={profile?.avatar_url ?? null}
      />
    </div>
  )
}
