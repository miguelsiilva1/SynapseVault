import { NextResponse } from 'next/server';
import { generatePresignedUploadUrl } from '@/lib/storage/r2';
import { enforceAuthGuard } from '@/lib/auth/guard';

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

const MAX_DECLARED_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB max threshold

export async function POST(req: Request) {
  try {
    const auth = await enforceAuthGuard();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const body = await req.json();
    const { fileName, fileType, fileSize, courseId } = body;

    if (!fileName || !fileType || !courseId) {
      return NextResponse.json(
        { error: 'Missing required parameters: fileName, fileType, and courseId.' },
        { status: 400 }
      );
    }

    if (!ALLOWED_MIME_TYPES.has(fileType)) {
      return NextResponse.json(
        { error: `Unsupported MIME type: ${fileType}. Permitted types: Audio (MP3, WAV, M4A, WebM) or PDF.` },
        { status: 415 }
      );
    }

    if (fileSize && fileSize > MAX_DECLARED_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'File size exceeds maximum threshold of 100MB.' },
        { status: 413 }
      );
    }

    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `courses/${courseId}/${Date.now()}-${sanitizedFileName}`;

    const { uploadUrl, fileKey } = await generatePresignedUploadUrl(storageKey, fileType, 900);

    return NextResponse.json({
      uploadUrl,
      fileKey,
      expiresIn: 900,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
