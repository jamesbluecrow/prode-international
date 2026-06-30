import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from './LoginForm'

export default async function LoginPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user) redirect('/')

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-display text-5xl text-center mb-2">
          <span className="text-[var(--muted)]">WORLD</span>{' '}
          <span className="text-[var(--gold)]">CUP 2026</span>
        </h1>
        <p className="text-center text-[var(--muted)] text-sm mb-8">Prediction Pool</p>
        <LoginForm />
        <p className="text-center mt-6 text-xs text-[var(--muted)]">
          Just browsing?{' '}
          <a href="/chronicles" className="text-[var(--gold)] hover:underline">
            Read the Buzz ↗
          </a>
        </p>
      </div>
    </div>
  )
}
