import { NextResponse } from 'next/server';
import { enforceAuthGuard } from '@/lib/auth/guard';
import { generateCourseSyllabusSynthesis } from '@/lib/ai/masterSynthesis';
import { saveFolderMasterSummary, getRoomDetails } from '@/lib/db/rooms';

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
    const { folderId, sourceText, outputLanguage } = body;

    if (!folderId || !sourceText || !sourceText.trim()) {
      return NextResponse.json(
        { error: 'folderId e sourceText são obrigatórios.' },
        { status: 400 }
      );
    }

    // Verify room access
    const details = await getRoomDetails(roomId, auth.email);
    if (details.error) {
      return NextResponse.json({ error: details.error }, { status: 403 });
    }

    const folder = details.folders?.find((f) => f.id === folderId);
    if (!folder) {
      return NextResponse.json({ error: 'Pasta não encontrada.' }, { status: 404 });
    }

    // Resolve course code and course name
    let courseCode = folder.course_code;
    let courseName = folder.name;
    if (folder.parent_id && details.folders) {
      const parent = details.folders.find((f) => f.id === folder.parent_id);
      if (parent) {
        courseCode = courseCode || parent.course_code;
        courseName = parent.name.replace(/\(.*?\)/g, '').trim() || parent.name;
      }
    }

    const synthesis = await generateCourseSyllabusSynthesis({
      courseName,
      courseCode,
      sourceText: sourceText.trim(),
      outputLanguage: outputLanguage || 'pt',
    });

    const saved = await saveFolderMasterSummary({
      roomId,
      folderId,
      contentMarkdown: synthesis.markdown,
      updatedByEmail: auth.email,
      modelUsed: synthesis.modelUsed,
      sourcesCount: 1,
    });

    if (saved.error) {
      return NextResponse.json({ error: saved.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, summary: saved.summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Falha ao gerar syllabus da cadeira.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
