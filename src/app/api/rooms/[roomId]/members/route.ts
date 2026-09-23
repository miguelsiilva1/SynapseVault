import { NextResponse } from 'next/server';
import { enforceAuthGuard } from '@/lib/auth/guard';
import { addRoomMember, removeRoomMember } from '@/lib/db/rooms';

export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const auth = await enforceAuthGuard();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    if (!auth.email) {
      return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 });
    }

    const { roomId } = await context.params;
    if (!roomId) {
      return NextResponse.json({ error: 'Room ID obrigatório.' }, { status: 400 });
    }

    const body = await req.json();
    const { email } = body;
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Email de membro válido é obrigatório.' }, { status: 400 });
    }

    const res = await addRoomMember(roomId, email.trim(), auth.email);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, member: res.member });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao adicionar membro à sala.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ roomId: string }> }
) {
  try {
    const auth = await enforceAuthGuard();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    if (!auth.email) {
      return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 });
    }

    const { roomId } = await context.params;
    if (!roomId) {
      return NextResponse.json({ error: 'Room ID obrigatório.' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const targetEmail = searchParams.get('email');
    if (!targetEmail) {
      return NextResponse.json({ error: 'Parâmetro email é obrigatório.' }, { status: 400 });
    }

    const res = await removeRoomMember(roomId, targetEmail.trim(), auth.email);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao remover membro da sala.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
