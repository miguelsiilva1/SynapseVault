import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') || '/';
  const home = new URL('/', requestUrl.origin);

  if (code) {
    const supabase = await createServerSupabaseClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) {
        console.warn('[Auth] Failed to exchange code for session:', error.message);
        return NextResponse.redirect(home);
      }
    }
  }

  // URL to redirect to after sign in process completes. Same-origin targets only.
  const target = URL.parse(next, requestUrl.origin);
  return NextResponse.redirect(target?.origin === requestUrl.origin ? target : home);
}
