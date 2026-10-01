import { NextResponse } from 'next/server';
import { enforceAuthGuard } from '@/lib/auth/guard';
import { isUserAdmin } from '@/lib/auth/whitelist';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await enforceAuthGuard();
  if (!auth.authorized && auth.response) {
    return auth.response;
  }

  return NextResponse.json({ isAdmin: isUserAdmin(auth.email) });
}
