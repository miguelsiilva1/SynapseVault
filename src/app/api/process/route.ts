import { NextResponse } from 'next/server';
import { downloadFileAsBuffer, deleteFileFromR2 } from '@/lib/storage/r2';
import { transcribeAudioStream } from '@/lib/ai/groq';
import { extractPdfText } from '@/lib/pdf/extractText';
import { synthesizeObsidianNote } from '@/lib/ai/gemini';
import { enforceAuthGuard } from '@/lib/auth/guard';

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
      modelName,
      outputLanguage,
    } = body;

    activeAudioKey = audioKey;
    activePdfKey = pdfKey;

    if (!courseName || !courseCode || !lectureTitle) {
      return NextResponse.json(
        { error: 'Missing required metadata: courseName, courseCode, and lectureTitle are mandatory.' },
        { status: 400 }
      );
    }

    if (!audioKey && !pdfKey) {
      return NextResponse.json(
        { error: 'At least one input artifact (audioKey or pdfKey) must be provided for synthesis.' },
        { status: 400 }
      );
    }

    // Step 1: Execute speech transcription and PDF parsing in parallel
    const [audioResult, pdfResult] = await Promise.all([
      (async () => {
        if (!audioKey) return { text: '', duration: 0 };
        const audioBuffer = await downloadFileAsBuffer(audioKey);
        const transcription = await transcribeAudioStream(audioBuffer, 'lecture.mp3', outputLanguage || 'pt');
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

    // Step 3: Dispatch consolidated payload to Gemini
    const synthesis = await synthesizeObsidianNote({
      courseName,
      courseCode,
      lectureTitle,
      lectureDate,
      transcriptText: audioResult.text,
      slidesText: pdfResult.text,
      modelName,
      outputLanguage: outputLanguage || 'pt',
    });

    return NextResponse.json({
      success: true,
      markdown: synthesis.markdown,
      modelUsed: synthesis.modelUsed,
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
