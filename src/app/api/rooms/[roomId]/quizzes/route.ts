import { NextResponse } from 'next/server';
import { enforceAuthGuard } from '@/lib/auth/guard';
import {
  getRoomDetails,
  verifyRoomFolderAccess,
  getFolderMasterSummary,
  listFolderQuizzes,
  saveRoomQuiz,
  deleteRoomQuiz,
} from '@/lib/db/rooms';
import { generateWeekQuiz } from '@/lib/ai/quizSynthesis';
import { enforceAiQuota } from '@/lib/auth/aiQuota';
import { MAX_QUIZ_INSTRUCTIONS_CHARS, MAX_SOURCE_TEXT_CHARS } from '@/lib/limits';

export const maxDuration = 120;

/**
 * Lists the quizzes of a Teóricas folder.
 */
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

    const { searchParams } = new URL(req.url);
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json({ error: 'folderId query parameter required.' }, { status: 400 });
    }

    const { roomId } = await context.params;
    const access = await verifyRoomFolderAccess({ roomId, folderId, userEmail: auth.email });
    if (access.error) {
      return NextResponse.json({ error: access.error }, { status: access.status || 403 });
    }

    const { quizzes, error } = await listFolderQuizzes(folderId);
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ quizzes });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list quizzes.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Generates and saves a quiz from the selected week folders of a Teóricas folder.
 * Each week uses its Master Note, or its imported lecture notes when it has none.
 */
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
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { roomId } = await context.params;
    const body = await req.json();
    const { folderId, weekFolderIds, instructions, outputLanguage } = body;

    if (
      typeof folderId !== 'string' ||
      !Array.isArray(weekFolderIds) ||
      weekFolderIds.length === 0 ||
      !weekFolderIds.every((id: unknown) => typeof id === 'string')
    ) {
      return NextResponse.json(
        { error: 'folderId and a non-empty weekFolderIds array are required.' },
        { status: 400 }
      );
    }

    if (instructions !== undefined && typeof instructions !== 'string') {
      return NextResponse.json({ error: 'instructions must be a string.' }, { status: 400 });
    }

    if (typeof instructions === 'string' && instructions.length > MAX_QUIZ_INSTRUCTIONS_CHARS) {
      return NextResponse.json(
        { error: `instructions exceed the limit of ${MAX_QUIZ_INSTRUCTIONS_CHARS} characters.` },
        { status: 413 }
      );
    }

    const roomDetails = await getRoomDetails(roomId, auth.email);
    if (roomDetails.error) {
      return NextResponse.json({ error: roomDetails.error }, { status: 403 });
    }

    const folders = roomDetails.folders || [];
    const targetFolder = folders.find((f) => f.id === folderId);
    if (!targetFolder) {
      return NextResponse.json({ error: 'Target folder not found.' }, { status: 404 });
    }

    const weekIds = new Set<string>(weekFolderIds);
    const weekFolders = folders
      .filter((f) => weekIds.has(f.id) && f.parent_id === folderId)
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
    if (weekFolders.length !== weekIds.size) {
      return NextResponse.json(
        { error: 'Every week must be a subfolder of the target folder.' },
        { status: 400 }
      );
    }

    const weeks: Array<{ name: string; content: string }> = [];
    for (const week of weekFolders) {
      const { summary } = await getFolderMasterSummary(week.id);
      let content = summary?.content_markdown?.trim() || '';
      if (!content) {
        content = (roomDetails.notes || [])
          .filter((n) => n.folder_id === week.id)
          .map((n) => `## ${n.title}\n\n${n.content_markdown}`)
          .join('\n\n---\n\n')
          .trim();
      }
      if (content) weeks.push({ name: week.name, content });
    }

    if (weeks.length === 0) {
      return NextResponse.json(
        { error: 'As semanas escolhidas não têm Master Note nem aulas importadas.' },
        { status: 400 }
      );
    }

    const totalChars = weeks.reduce((sum, w) => sum + w.content.length, 0);
    if (totalChars > MAX_SOURCE_TEXT_CHARS) {
      return NextResponse.json(
        { error: 'Conteúdo das semanas escolhidas é demasiado grande. Escolhe menos semanas.' },
        { status: 413 }
      );
    }

    const courseFolder = folders.find((f) => f.id === targetFolder.parent_id);
    const courseCode = targetFolder.course_code || courseFolder?.course_code || 'GERAL';
    const courseName = courseFolder?.name.replace(/\(.*?\)/g, '').trim() || courseCode;

    const quotaResponse = await enforceAiQuota(auth.email);
    if (quotaResponse) return quotaResponse;

    const quiz = await generateWeekQuiz({
      courseName,
      courseCode,
      weeks,
      instructions,
      outputLanguage: outputLanguage || 'pt',
    });

    const saved = await saveRoomQuiz({
      roomId,
      folderId,
      title: quiz.title,
      instructions: instructions?.trim() || '',
      weekNames: weeks.map((w) => w.name),
      questions: quiz.questions,
      createdByEmail: auth.email,
      modelUsed: quiz.modelUsed,
    });

    if (saved.error) {
      return NextResponse.json({ error: saved.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, quiz: saved.quiz });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to generate quiz.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Deletes a quiz (room owner or quiz creator only).
 */
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
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { roomId } = await context.params;
    const { searchParams } = new URL(req.url);
    const quizId = searchParams.get('quizId');

    if (!quizId) {
      return NextResponse.json({ error: 'quizId query parameter required.' }, { status: 400 });
    }

    const res = await deleteRoomQuiz({ roomId, quizId, userEmail: auth.email });
    if (!res.success) {
      return NextResponse.json(
        { error: res.error || 'Failed to delete quiz.' },
        { status: res.status || 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete quiz.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
