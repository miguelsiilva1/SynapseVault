import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isUserAuthorized } from './whitelist';

export interface AuthGuardResult {
  authorized: boolean;
  userId?: string;
  email?: string;
  response?: NextResponse;
}

/**
 * Enforces session authentication and whitelist verification on API endpoints.
 * Automatically permits unauthenticated access in local dev if Supabase is unconfigured.
 */
export async function enforceAuthGuard(): Promise<AuthGuardResult> {
  const supabase = await createServerSupabaseClient();

  // If Supabase credentials are not set in environment, allow local dev mode
  if (!supabase) {
    return {
      authorized: true,
      userId: 'local-dev-user',
      email: 'local@synapsevault.dev',
    };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Unauthorized. Please sign in to access SynapseVault.' },
        { status: 401 }
      ),
    };
  }

  const whitelist = isUserAuthorized(user.email);
  if (!whitelist.authorized) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: whitelist.reason || 'Forbidden. Account not in whitelist.' },
        { status: 403 }
      ),
    };
  }

  return {
    authorized: true,
    userId: user.id,
    email: user.email,
  };
}
