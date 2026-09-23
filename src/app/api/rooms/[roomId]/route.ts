import { NextResponse } from 'next/server';
import { enforceAuthGuard } from '@/lib/auth/guard';
import { getRoomDetails, updateRoomName } from '@/lib/db/rooms';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const auth = await enforceAuthGuard();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    if (!auth.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { roomId } = await context.params;
    if (!roomId) {
      return NextResponse.json({ error: 'Room ID required.' }, { status: 400 });
    }

    const details = await getRoomDetails(roomId, auth.email);
    if (details.error) {
      const status = details.error.includes('denied') ? 403 : 500;
      return NextResponse.json({ error: details.error }, { status });
    }

    return NextResponse.json({
      room: details.room,
      members: details.members,
      folders: details.folders,
      notes: details.notes,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to retrieve room details.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const auth = await enforceAuthGuard();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    if (!auth.email) {
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { roomId } = await context.params;
    if (!roomId) {
      return NextResponse.json({ error: 'Room ID required.' }, { status: 400 });
    }

    const body = await req.json();
    const { name } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Nome de sala válido é obrigatório.' }, { status: 400 });
    }

    const res = await updateRoomName(roomId, name.trim(), auth.email);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 403 });
    }

    return NextResponse.json({ success: true, name: name.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao renomear sala.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

