import { NextResponse } from 'next/server';
import { enforceAuthGuard } from '@/lib/auth/guard';
import { importNoteToRoom, getFolderMasterSummary, saveFolderMasterSummary, getRoomDetails } from '@/lib/db/rooms';
import { updateMasterSummaryIncremental } from '@/lib/ai/masterSynthesis';

export const maxDuration = 120; // 2-minute timeout for incremental synthesis

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
    const { folderId, sourceNoteId, title, contentMarkdown, triggerMasterUpdate = true, outputLanguage } = body;

    if (!folderId || !title || !contentMarkdown) {
      return NextResponse.json(
        { error: 'folderId, title, and contentMarkdown are required.' },
        { status: 400 }
      );
    }

    // 1. Verify user belongs to room and locate folder
    const roomDetails = await getRoomDetails(roomId, auth.email);
    if (roomDetails.error) {
      return NextResponse.json({ error: roomDetails.error }, { status: 403 });
    }

    const targetFolder = (roomDetails.folders || []).find((f) => f.id === folderId);
    if (!targetFolder) {
      return NextResponse.json({ error: 'Specified folder not found in this room.' }, { status: 404 });
    }

    // 2. Import note to room_notes
    const imported = await importNoteToRoom({
      roomId,
      folderId,
      sourceNoteId,
      title,
      contentMarkdown,
      authorEmail: auth.email,
    });

    if (imported.error || !imported.note) {
      return NextResponse.json({ error: imported.error || 'Failed to import note.' }, { status: 500 });
    }

    let updatedSummaryResult = null;

    // 3. Incrementally update the Master Summary for this course folder
    if (triggerMasterUpdate) {
      try {
        const existingSummaryRes = await getFolderMasterSummary(folderId);
        const currentMasterSummary = existingSummaryRes.summary?.content_markdown || '';

        // Extract course name & code
        const courseCode = targetFolder.course_code || 'GERAL';
        const courseName = targetFolder.name.replace(/\(.*?\)/g, '').trim() || courseCode;

        const aiResult = await updateMasterSummaryIncremental({
          courseName,
          courseCode,
          currentMasterSummary,
          newNoteTitle: title,
          newNoteContent: contentMarkdown,
          outputLanguage: outputLanguage || 'pt',
        });

        // Compute total notes in this folder (including the newly added one)
        const notesInFolderCount =
          (roomDetails.notes || []).filter((n) => n.folder_id === folderId).length + 1;

        const savedSummary = await saveFolderMasterSummary({
          roomId,
          folderId,
          contentMarkdown: aiResult.markdown,
          updatedByEmail: auth.email,
          modelUsed: aiResult.modelUsed,
          sourcesCount: notesInFolderCount,
        });

        updatedSummaryResult = savedSummary.summary;
      } catch (aiErr) {
        console.warn('[ImportNote] Master summary incremental update failed:', aiErr);
        // Note is imported successfully; we do not block note import if master synthesis failed
      }
    }

    return NextResponse.json({
      success: true,
      note: imported.note,
      masterSummary: updatedSummaryResult,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to import note.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
