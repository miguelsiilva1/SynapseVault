import { NextResponse } from 'next/server';
import { enforceAuthGuard } from '@/lib/auth/guard';
import { getProjectLog, saveProjectLog, appendProjectLogEntry } from '@/lib/db/rooms';

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

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId');
    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID obrigatório.' }, { status: 400 });
    }

    const res = await getProjectLog(folderId);
    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }

    return NextResponse.json({ log: res.log || null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao obter log de projeto.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
    const { folderId, message, contentMarkdown } = body;

    if (!folderId) {
      return NextResponse.json({ error: 'Folder ID obrigatório.' }, { status: 400 });
    }

    // Append mode (chat style) or Full content update
    let res;
    if (typeof message === 'string') {
      res = await appendProjectLogEntry({
        roomId,
        folderId,
        message,
        userEmail: auth.email,
      });
    } else if (typeof contentMarkdown === 'string') {
      res = await saveProjectLog({
        roomId,
        folderId,
        contentMarkdown,
        userEmail: auth.email,
      });
    } else {
      return NextResponse.json({ error: 'message ou contentMarkdown obrigatórios.' }, { status: 400 });
    }

    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, log: res.log });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao atualizar log de projeto.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
