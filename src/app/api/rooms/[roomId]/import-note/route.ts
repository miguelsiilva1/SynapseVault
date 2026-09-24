import { NextResponse } from 'next/server';
import { enforceAuthGuard } from '@/lib/auth/guard';
import {
  importNoteToRoom,
  deleteRoomNote,
  getFolderMasterSummary,
  saveFolderMasterSummary,
  getRoomDetails,
  findOrCreateSubfolderByName,
  type RoomFolderRecord,
} from '@/lib/db/rooms';
import { updateMasterSummaryIncremental, detectWeekFromTitle } from '@/lib/ai/masterSynthesis';

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
    const {
      folderId,
      sourceNoteId,
      title,
      contentMarkdown,
      targetWeek,
      triggerMasterUpdate = true,
      outputLanguage,
    } = body;

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

    const initialTarget = (roomDetails.folders || []).find((f) => f.id === folderId);
    if (!initialTarget) {
      return NextResponse.json({ error: 'Specified folder not found in this room.' }, { status: 404 });
    }

    // 2. Smart Week Routing: if importing into Teóricas root, check for weekly categorization
    let finalFolderId = folderId;
    let targetFolder = initialTarget;
    let reroutedWeekFolder: RoomFolderRecord | undefined;

    const candidateWeek = targetWeek?.trim() || detectWeekFromTitle(title);
    if (candidateWeek && initialTarget.name.trim().toLowerCase() === 'teóricas') {
      const subfolderRes = await findOrCreateSubfolderByName({
        roomId,
        parentId: initialTarget.id,
        name: candidateWeek,
        folderType: 'section',
        courseCode: initialTarget.course_code,
        userEmail: auth.email,
      });

      if (subfolderRes.folder) {
        finalFolderId = subfolderRes.folder.id;
        targetFolder = subfolderRes.folder;
        reroutedWeekFolder = subfolderRes.folder;
      }
    }

    // 3. Import note to room_notes
    const imported = await importNoteToRoom({
      roomId,
      folderId: finalFolderId,
      sourceNoteId,
      title,
      contentMarkdown,
      authorEmail: auth.email,
    });

    if (imported.error || !imported.note) {
      return NextResponse.json({ error: imported.error || 'Failed to import note.' }, { status: 500 });
    }

    let updatedSummaryResult = null;

    // 4. Incrementally update the Master Summary for this specific folder
    if (triggerMasterUpdate) {
      try {
        const existingSummaryRes = await getFolderMasterSummary(finalFolderId);
        const currentMasterSummary = existingSummaryRes.summary?.content_markdown || '';

        // Extract course name & code (inheriting from parent if subfolder)
        let courseCode = targetFolder.course_code;
        let courseName = targetFolder.name;
        if ((!courseCode || targetFolder.parent_id) && roomDetails.folders) {
          const parent = roomDetails.folders.find((f) => f.id === targetFolder.parent_id);
          if (parent) {
            courseCode = courseCode || parent.course_code;
            if (parent.name && !targetFolder.name.includes(parent.name)) {
              courseName = `${parent.name} - ${targetFolder.name}`;
            }
          }
        }
        courseCode = courseCode || 'GERAL';
        courseName = courseName.replace(/\(.*?\)/g, '').trim() || courseCode;

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
          (roomDetails.notes || []).filter((n) => n.folder_id === finalFolderId).length + 1;

        const savedSummary = await saveFolderMasterSummary({
          roomId,
          folderId: finalFolderId,
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
      targetFolderId: finalFolderId,
      weekFolder: reroutedWeekFolder,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to import note.';
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
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { roomId } = await context.params;
    const { searchParams } = new URL(req.url);
    const noteId = searchParams.get('noteId');

    if (!noteId) {
      return NextResponse.json({ error: 'noteId is required.' }, { status: 400 });
    }

    const res = await deleteRoomNote({
      roomId,
      noteId,
      userEmail: auth.email,
    });

    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete note.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

