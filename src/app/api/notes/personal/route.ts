import { NextResponse } from 'next/server';
import { enforceAuthGuard } from '@/lib/auth/guard';
import { getPersonalNotes, deletePersonalNote, updatePersonalNoteTitle, persistNoteToDatabase } from '@/lib/db/notes';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const auth = await enforceAuthGuard();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const email = auth.email;
    if (!email) {
      return NextResponse.json({ error: 'No authenticated email identified.' }, { status: 401 });
    }

    const { notes, error } = await getPersonalNotes(email);
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }

    return NextResponse.json({ notes });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch personal notes.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const auth = await enforceAuthGuard();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const email = auth.email;
    if (!email) {
      return NextResponse.json({ error: 'No authenticated email identified.' }, { status: 401 });
    }

    const body = await req.json();
    const { id, title } = body;
    if (!id || typeof title !== 'string' || !title.trim()) {
      return NextResponse.json({ error: 'Note ID and valid title required.' }, { status: 400 });
    }

    const { success, error } = await updatePersonalNoteTitle(id, title.trim(), email);
    if (error || !success) {
      return NextResponse.json({ error: error || 'Failed to update note title.' }, { status: 500 });
    }

    return NextResponse.json({ success: true, title: title.trim() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update note title.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await enforceAuthGuard();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const email = auth.email;
    if (!email) {
      return NextResponse.json({ error: 'No authenticated email identified.' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing note id parameter.' }, { status: 400 });
    }

    const { success, error } = await deletePersonalNote(id, email);
    if (error || !success) {
      return NextResponse.json({ error: error || 'Failed to delete note.' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete note.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const auth = await enforceAuthGuard();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const email = auth.email;
    if (!email) {
      return NextResponse.json({ error: 'No authenticated email identified.' }, { status: 401 });
    }

    const body = await req.json();
    const { courseName, courseCode, title, lectureDate, contentMarkdown } = body;

    if (!courseCode || !title || !contentMarkdown) {
      return NextResponse.json(
        { error: 'courseCode, title, and contentMarkdown are required.' },
        { status: 400 }
      );
    }

    const res = await persistNoteToDatabase({
      courseName: courseName || courseCode,
      courseCode,
      title: title.trim(),
      lectureDate: lectureDate || new Date().toISOString().split('T')[0],
      contentMarkdown,
      authorEmail: email,
    });

    if (res.error) {
      return NextResponse.json({ error: res.error }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: res.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to save personal note.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}


