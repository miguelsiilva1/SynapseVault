import { NextResponse } from 'next/server';
import { enforceAuthGuard } from '@/lib/auth/guard';
import { generateProjectGuidelinesSynthesis } from '@/lib/ai/masterSynthesis';
import { saveProjectGuidelines, getProjectLog, getRoomDetails } from '@/lib/db/rooms';

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
      return NextResponse.json({ error: 'folderId obrigatório.' }, { status: 400 });
    }

    const res = await getProjectLog(folderId);
    return NextResponse.json({ guidelines: res.log?.guidelines_markdown || null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao carregar guião.';
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
    const { folderId, sourceText, projectName, courseCode, outputLanguage } = body;

    if (!folderId || !sourceText || !sourceText.trim()) {
      return NextResponse.json({ error: 'folderId e sourceText são obrigatórios.' }, { status: 400 });
    }

    // Verify room access
    const details = await getRoomDetails(roomId, auth.email);
    if (details.error) {
      return NextResponse.json({ error: details.error }, { status: 403 });
    }

    const folder = details.folders?.find((f) => f.id === folderId);
    const resolvedName = projectName || folder?.name || 'Projeto';
    const resolvedCode = courseCode || folder?.course_code || '';

    const synthesis = await generateProjectGuidelinesSynthesis({
      projectName: resolvedName,
      courseCode: resolvedCode,
      sourceText: sourceText.trim(),
      outputLanguage: outputLanguage || 'pt',
    });

    const saved = await saveProjectGuidelines({
      roomId,
      folderId,
      guidelinesMarkdown: synthesis.markdown,
      userEmail: auth.email,
    });

    if (saved.error) {
      return NextResponse.json({ error: saved.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, guidelines: synthesis.markdown });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao analisar guião de projeto.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
