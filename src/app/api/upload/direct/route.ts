import { NextResponse } from 'next/server';
import { uploadBufferToR2, buildUserUploadKey } from '@/lib/storage/r2';
import { enforceAuthGuard } from '@/lib/auth/guard';
import { MAX_UPLOAD_BYTES } from '@/lib/limits';

const ALLOWED_MIME_TYPES = new Set([
  'audio/mp3',
  'audio/mpeg',
  'audio/wav',
  'audio/x-m4a',
  'audio/mp4',
  'audio/webm',
  'audio/ogg',
  'application/pdf',
]);

export async function POST(req: Request) {
  try {
    const auth = await enforceAuthGuard();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const courseId = (formData.get('courseId') as string) || 'general';

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form payload.' }, { status: 400 });
    }

    const fileType = file.type || 'application/octet-stream';
    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      return NextResponse.json(
        { error: `Unsupported MIME type: ${fileType}. Permitted: Audio (MP3, WAV, M4A) or PDF.` },
        { status: 415 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'File size exceeds maximum threshold of 25MB.' },
        { status: 413 }
      );
    }

    const storageKey = buildUserUploadKey(auth.userId!, courseId, file.name);

    const buffer = await file.arrayBuffer();
    await uploadBufferToR2(storageKey, Buffer.from(buffer), fileType);

    return NextResponse.json({
      success: true,
      fileKey: storageKey,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Direct upload relay failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
