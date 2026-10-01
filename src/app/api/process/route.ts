import { NextResponse } from 'next/server';
import { downloadFileAsBuffer, deleteFileFromR2, isUserUploadKey } from '@/lib/storage/r2';
import { transcribeAudioStream } from '@/lib/ai/groq';
import { extractPdfText } from '@/lib/pdf/extractText';
import { synthesizeObsidianNote } from '@/lib/ai/gemini';
import { enforceAuthGuard } from '@/lib/auth/guard';
import { persistNoteToDatabase } from '@/lib/db/notes';

export const maxDuration = 120; // Allow 2-minute server execution for large academic jobs

export async function POST(req: Request) {
  let activeAudioKey: string | undefined;
  let activePdfKey: string | undefined;

  try {
    const auth = await enforceAuthGuard();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const body = await req.json();
    const {
      courseName,
      courseCode,
      lectureTitle,
      lectureDate,
      audioKey,
      pdfKey,
      rawMarkdown,
      modelName,
      outputLanguage,
    } = body;

    // Only accept storage keys that were issued to this user by the upload routes
    if (
      (audioKey && !isUserUploadKey(auth.userId!, audioKey)) ||
      (pdfKey && !isUserUploadKey(auth.userId!, pdfKey))
    ) {
      return NextResponse.json(
        { error: 'Forbidden. Storage key does not belong to the current user.' },
        { status: 403 }
      );
    }

    activeAudioKey = audioKey;
    activePdfKey = pdfKey;

    if (!courseName || !courseCode || !lectureTitle) {
      return NextResponse.json(
        { error: 'Missing required metadata: courseName, courseCode, and lectureTitle are mandatory.' },
        { status: 400 }
      );
    }

    if (!audioKey && !pdfKey && !rawMarkdown) {
      return NextResponse.json(
        { error: 'At least one input artifact (audioKey, pdfKey, or rawMarkdown) must be provided for synthesis.' },
        { status: 400 }
      );
    }

    // Step 1: Execute speech transcription and PDF parsing in parallel
    const [audioSettled, pdfSettled] = await Promise.allSettled([
      (async () => {
        if (!audioKey) return { text: '', duration: 0 };
        const audioBuffer = await downloadFileAsBuffer(audioKey);
        const transcription = await transcribeAudioStream(audioBuffer, 'lecture.mp3');
        return { text: transcription.text, duration: transcription.durationSeconds };
      })(),
      (async () => {
        if (!pdfKey) return { text: '', totalPages: 0 };
        const pdfBuffer = await downloadFileAsBuffer(pdfKey);
        const extraction = await extractPdfText(pdfBuffer);
        return { text: extraction.text, totalPages: extraction.totalPages };
      })(),
    ]);

    // Step 2: Auto-purge raw binaries from Cloudflare R2 immediately to enforce 0 MB persistent storage
    await Promise.allSettled([
      activeAudioKey ? deleteFileFromR2(activeAudioKey) : Promise.resolve(),
      activePdfKey ? deleteFileFromR2(activePdfKey) : Promise.resolve(),
    ]);

    const warnings: string[] = [];

    if (audioKey && audioSettled.status === 'rejected') {
      const err = audioSettled.reason;
      warnings.push(err instanceof Error ? err.message : 'Audio transcription failed.');
    }

    if (pdfKey && pdfSettled.status === 'rejected') {
      const err = pdfSettled.reason;
      warnings.push(err instanceof Error ? err.message : 'PDF extraction failed.');
    }

    const hasAudio = Boolean(audioKey) && audioSettled.status === 'fulfilled';
    const hasPdf = Boolean(pdfKey) && pdfSettled.status === 'fulfilled';
    const hasRawMarkdown = Boolean(rawMarkdown && rawMarkdown.trim());

    if (!hasAudio && !hasPdf && !hasRawMarkdown) {
      const firstError =
        (audioSettled.status === 'rejected' ? audioSettled.reason : null) ||
        (pdfSettled.status === 'rejected' ? pdfSettled.reason : null) ||
        new Error('No usable input artifact remained.');
      throw firstError;
    }

    const audioResult = audioSettled.status === 'fulfilled'
      ? audioSettled.value
      : { text: '', duration: 0 };
    const pdfResult = pdfSettled.status === 'fulfilled'
      ? pdfSettled.value
      : { text: '', totalPages: 0 };

    // Step 3: Combine slides text with any provided raw markdown summaries
    const combinedReferenceText = [
      pdfResult.text,
      rawMarkdown ? `### NOTAS E RESUMOS FORNECIDOS:\n${rawMarkdown}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');

    // Step 4: Dispatch consolidated payload to Gemini
    const synthesis = await synthesizeObsidianNote({
      courseName,
      courseCode,
      lectureTitle,
      lectureDate,
      transcriptText: audioResult.text,
      slidesText: combinedReferenceText,
      modelName,
      outputLanguage: outputLanguage || 'pt',
    });

    // Step 5: Persist note to Supabase DB (if tables exist)
    const dbPersist = await persistNoteToDatabase({
      courseName,
      courseCode,
      title: lectureTitle,
      lectureDate,
      contentMarkdown: synthesis.markdown,
      authorEmail: auth.email,
      metadata: {
        modelUsed: synthesis.modelUsed,
        metrics: {
          audioDurationSeconds: audioResult.duration,
          pdfPagesProcessed: pdfResult.totalPages,
          transcriptLengthCharacters: audioResult.text.length,
          slidesLengthCharacters: pdfResult.text.length,
        },
      },
    });

    if (dbPersist.error) {
      warnings.push(`Note was generated but not saved: ${dbPersist.error}`);
    }

    return NextResponse.json({
      success: true,
      markdown: synthesis.markdown,
      modelUsed: synthesis.modelUsed,
      noteId: dbPersist.id,
      ...(warnings.length > 0 ? { warnings } : {}),
      metrics: {
        audioDurationSeconds: audioResult.duration,
        pdfPagesProcessed: pdfResult.totalPages,
        transcriptLengthCharacters: audioResult.text.length,
        slidesLengthCharacters: pdfResult.text.length,
      },
    });
  } catch (error) {
    // Ensure cleanup even on pipeline error
    if (activeAudioKey || activePdfKey) {
      await Promise.allSettled([
        activeAudioKey ? deleteFileFromR2(activeAudioKey) : Promise.resolve(),
        activePdfKey ? deleteFileFromR2(activePdfKey) : Promise.resolve(),
      ]);
    }

    const message = error instanceof Error ? error.message : 'Pipeline orchestration failed.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
