import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  const response = NextResponse.redirect(`${origin}${next}`)

  if (code) {
    const cookieStore = await cookies()
    // Collect cookies so we can set them on the redirect response directly.
    // Using cookieStore.set() alone doesn't attach cookies to a NextResponse.redirect().
    const pendingCookies: Array<{ name: string; value: string; options: Record<string, unknown> }> = []
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            pendingCookies.push(...cookiesToSet)
          },
        },
      }
    )
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      pendingCookies.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options))
    }
  }

  return response
}
