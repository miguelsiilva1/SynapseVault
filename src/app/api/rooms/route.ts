import { NextResponse } from 'next/server';
import { enforceAuthGuard } from '@/lib/auth/guard';
import { getUserStudyRooms, createStudyRoom } from '@/lib/db/rooms';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await enforceAuthGuard();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    if (!auth.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { rooms, error } = await getUserStudyRooms(auth.email);
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ rooms });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list study rooms.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await enforceAuthGuard();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    if (!auth.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const body = await req.json();
    const { name, description, memberEmails } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'Room name is mandatory.' }, { status: 400 });
    }

    const initialMemberEmails = Array.isArray(memberEmails) ? memberEmails : [];

    const result = await createStudyRoom({
      name,
      description,
      ownerEmail: auth.email,
      initialMemberEmails,
    });

    if (result.error || !result.room) {
      return NextResponse.json({ error: result.error || 'Failed to create room.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, room: result.room });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create study room.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
