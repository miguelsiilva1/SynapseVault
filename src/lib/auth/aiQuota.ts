import { NextResponse } from 'next/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';
import { DAILY_AI_LIMIT } from '@/lib/limits';
import { isUserAdmin } from './whitelist';

/**
 * Enforces the per-user daily AI generation cap and records one generation.
 * Returns a response when the caller must stop, or null when the generation may run.
 * Administrators are exempt. Like the whitelist, it fails closed in production
 * and allows everything in local dev when usage tracking is unavailable.
 */
export async function enforceAiQuota(email?: string): Promise<NextResponse | null> {
  if (isUserAdmin(email)) return null;

  const unavailable = (reason: string) => {
    if (process.env.NODE_ENV !== 'production') {
      console.warn(`[AI quota] Not enforced: ${reason}`);
      return null;
    }
    return NextResponse.json({ error: 'AI usage tracking is unavailable.' }, { status: 503 });
  };

  const supabase = createAdminSupabaseClient();
  if (!supabase || !email) return unavailable('Supabase service role is unconfigured.');

  const userEmail = email.trim().toLowerCase();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count, error } = await supabase
    .from('ai_usage')
    .select('id', { count: 'exact', head: true })
    .eq('user_email', userEmail)
    .gte('created_at', since);

  if (error) return unavailable(error.message);

  if ((count || 0) >= DAILY_AI_LIMIT) {
    return NextResponse.json(
      { error: `Limite diário de ${DAILY_AI_LIMIT} gerações de IA atingido. Tenta novamente amanhã.` },
      { status: 429 }
    );
  }

  const { error: insertError } = await supabase.from('ai_usage').insert({ user_email: userEmail });
  if (insertError) return unavailable(insertError.message);

  return null;
}
