import { NextResponse } from 'next/server';
import { generatePresignedUploadUrl, buildUserUploadKey } from '@/lib/storage/r2';
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

    if (fileSize && fileSize > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: 'File size exceeds maximum threshold of 25MB.' },
        { status: 413 }
      );
    }

    const storageKey = buildUserUploadKey(auth.userId!, String(courseId), String(fileName));

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
