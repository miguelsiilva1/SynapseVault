import { NextResponse } from 'next/server';
import { enforceAuthGuard } from '@/lib/auth/guard';
import { createRoomFolder, updateRoomFolder, deleteRoomFolder } from '@/lib/db/rooms';

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
    const { parentId, name, folderType, courseCode } = body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Nome de pasta obrigatório.' }, { status: 400 });
    }

    const res = await createRoomFolder({
      roomId,
      parentId: parentId || null,
      name: name.trim(),
      folderType: folderType || 'project',
      courseCode,
      userEmail: auth.email,
    });

    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, folder: res.folder });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao criar pasta.';
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
      return NextResponse.json({ error: 'Autenticação necessária.' }, { status: 401 });
    }

    const { roomId } = await context.params;
    if (!roomId) {
      return NextResponse.json({ error: 'Room ID obrigatório.' }, { status: 400 });
    }

    const body = await req.json();
    const { folderId, name } = body;

    if (!folderId || !name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'ID e novo nome da pasta são obrigatórios.' }, { status: 400 });
    }

    const res = await updateRoomFolder({
      roomId,
      folderId,
      name: name.trim(),
      userEmail: auth.email,
    });

    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 403 });
    }

    return NextResponse.json({ success: true, name: name.trim() });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao renomear pasta.';
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
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json({ error: 'ID da pasta obrigatório.' }, { status: 400 });
    }

    const res = await deleteRoomFolder({
      roomId,
      folderId,
      userEmail: auth.email,
    });

    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 403 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao eliminar pasta.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
