import { NextResponse } from 'next/server';
import { enforceAuthGuard } from '@/lib/auth/guard';
import {
  getFolderMasterSummary,
  saveFolderMasterSummary,
  deleteFolderMasterSummary,
  getRoomDetails,
} from '@/lib/db/rooms';
import { regenerateMasterSummaryFull } from '@/lib/ai/masterSynthesis';

export const maxDuration = 120;

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
      return NextResponse.json({ error: 'folderId query parameter required.' }, { status: 400 });
    }

    const { summary, error } = await getFolderMasterSummary(folderId);
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ summary: summary || null });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get master summary.';
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
      return NextResponse.json({ error: 'Authentication required.' }, { status: 401 });
    }

    const { roomId } = await context.params;
    const body = await req.json();
    const { folderId, outputLanguage } = body;

    if (!folderId) {
      return NextResponse.json({ error: 'folderId is required.' }, { status: 400 });
    }

    // Verify membership and fetch folder & notes
    const roomDetails = await getRoomDetails(roomId, auth.email);
    if (roomDetails.error) {
      return NextResponse.json({ error: roomDetails.error }, { status: 403 });
    }

    const targetFolder = (roomDetails.folders || []).find((f) => f.id === folderId);
    if (!targetFolder) {
      return NextResponse.json({ error: 'Target folder not found.' }, { status: 404 });
    }

    const folderNotes = (roomDetails.notes || []).filter((n) => n.folder_id === folderId);
    if (folderNotes.length === 0) {
      return NextResponse.json(
        { error: 'Cannot regenerate master summary: no notes found in this folder.' },
        { status: 400 }
      );
    }

    const courseCode = targetFolder.course_code || 'GERAL';
    const courseName = targetFolder.name.replace(/\(.*?\)/g, '').trim() || courseCode;

    const synthesis = await regenerateMasterSummaryFull({
      courseName,
      courseCode,
      notes: folderNotes.map((n) => ({ title: n.title, contentMarkdown: n.content_markdown })),
      outputLanguage: outputLanguage || 'pt',
    });

    const saved = await saveFolderMasterSummary({
      roomId,
      folderId,
      contentMarkdown: synthesis.markdown,
      updatedByEmail: auth.email,
      modelUsed: synthesis.modelUsed,
      sourcesCount: folderNotes.length,
    });

    return NextResponse.json({
      success: true,
      summary: saved.summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to regenerate master summary.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Manually edits/saves custom markdown for a master summary.
 */
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
    const body = await req.json();
    const { folderId, contentMarkdown } = body;

    if (!folderId || typeof contentMarkdown !== 'string') {
      return NextResponse.json(
        { error: 'folderId and contentMarkdown are required.' },
        { status: 400 }
      );
    }

    const roomDetails = await getRoomDetails(roomId, auth.email);
    if (roomDetails.error) {
      return NextResponse.json({ error: roomDetails.error }, { status: 403 });
    }

    const targetFolder = (roomDetails.folders || []).find((f) => f.id === folderId);
    if (!targetFolder) {
      return NextResponse.json({ error: 'Target folder not found.' }, { status: 404 });
    }

    const folderNotes = (roomDetails.notes || []).filter((n) => n.folder_id === folderId);

    const saved = await saveFolderMasterSummary({
      roomId,
      folderId,
      contentMarkdown: contentMarkdown,
      updatedByEmail: auth.email,
      modelUsed: 'manual-edit',
      sourcesCount: folderNotes.length,
    });

    if (saved.error) {
      return NextResponse.json({ error: saved.error }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      summary: saved.summary,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to save master summary.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * Deletes the master summary for a folder.
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
    const folderId = searchParams.get('folderId');

    if (!folderId) {
      return NextResponse.json({ error: 'folderId query parameter required.' }, { status: 400 });
    }

    const roomDetails = await getRoomDetails(roomId, auth.email);
    if (roomDetails.error) {
      return NextResponse.json({ error: roomDetails.error }, { status: 403 });
    }

    const res = await deleteFolderMasterSummary(folderId);
    if (!res.success) {
      return NextResponse.json(
        { error: res.error || 'Failed to delete master summary.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete master summary.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
