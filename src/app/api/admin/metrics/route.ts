import { NextResponse } from 'next/server';
import { enforceAdminGuard } from '@/lib/auth/guard';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

export interface AdminMetricsResponse {
  summary: {
    totalNotes: number;
    totalAudioSeconds: number;
    totalAudioHours: number;
    audioNotesCount: number;
    pdfNotesCount: number;
    totalPdfPages: number;
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedTotalTokens: number;
    uniqueStudentsCount: number;
    activeCoursesCount: number;
  };
  groq: {
    totalSecondsTranscribed: number;
    totalMinutesTranscribed: number;
    totalHoursTranscribed: number;
    hourlyQuotaSeconds: number; // 7,200s (2 hrs) per Groq Whisper hourly limit
    lastHourAudioSeconds: number;
    percentHourlyQuotaUsed: number;
    sttModel: string;
  };
  gemini: {
    totalCalls: number;
    estimatedTokens: {
      input: number;
      output: number;
      total: number;
    };
    modelDistribution: Record<string, number>;
  };
  r2: {
    persistentStorageMb: number; // Strictly 0 MB
    estimatedProcessedMb: number;
    totalFilesAutoPurged: number;
    status: string;
  };
  courseBreakdown: Array<{
    courseCode: string;
    notesCount: number;
    audioSeconds: number;
    pdfPages: number;
    estimatedTokens: number;
  }>;
  studentBreakdown: Array<{
    email: string;
    notesCount: number;
    lastActive: string;
  }>;
  recentNotes: Array<{
    id: string;
    title: string;
    courseCode: string;
    authorEmail: string;
    createdAt: string;
    modelUsed: string;
    audioDurationSeconds: number;
    pdfPagesProcessed: number;
    estimatedTokens: number;
  }>;
}

export async function GET() {
  try {
    const auth = await enforceAdminGuard();
    if (!auth.authorized && auth.response) {
      return auth.response;
    }

    const adminClient = createAdminSupabaseClient();
    if (!adminClient) {
      return NextResponse.json(
        { error: 'Supabase administrative client unconfigured.' },
        { status: 500 }
      );
    }

    // Fetch all notes with metadata and content length
    const { data: notes, error } = await adminClient
      .from('notes')
      .select('id, title, course_code, author_email, metadata, content_markdown, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const allNotes = notes || [];
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    let totalAudioSeconds = 0;
    let lastHourAudioSeconds = 0;
    let audioNotesCount = 0;
    let pdfNotesCount = 0;
    let totalPdfPages = 0;
    let totalInputChars = 0;
    let totalOutputChars = 0;
    let totalFilesAutoPurged = 0;

    const modelDistribution: Record<string, number> = {};
    const courseMap = new Map<string, { notesCount: number; audioSeconds: number; pdfPages: number; estimatedTokens: number }>();
    const studentMap = new Map<string, { notesCount: number; lastActive: string }>();

    const recentNotes = allNotes.map((note) => {
      const meta = (note.metadata as Record<string, any>) || {};
      const metrics = meta.metrics || {};
      const modelUsed = meta.modelUsed || 'gemini-3.6-flash';
      const audioDuration = Number(metrics.audioDurationSeconds) || 0;
      const pdfPages = Number(metrics.pdfPagesProcessed) || 0;
      const transcriptLen = Number(metrics.transcriptLengthCharacters) || 0;
      const slidesLen = Number(metrics.slidesLengthCharacters) || 0;
      const markdownLen = note.content_markdown ? note.content_markdown.length : 0;

      // Accumulations
      totalAudioSeconds += audioDuration;
      if (audioDuration > 0) {
        audioNotesCount++;
        totalFilesAutoPurged++;
        if (note.created_at >= oneHourAgo) {
          lastHourAudioSeconds += audioDuration;
        }
      }

      if (pdfPages > 0 || slidesLen > 0) {
        pdfNotesCount++;
        totalPdfPages += pdfPages;
        totalFilesAutoPurged++;
      }

      totalInputChars += transcriptLen + slidesLen;
      totalOutputChars += markdownLen;

      // Model breakdown
      modelDistribution[modelUsed] = (modelDistribution[modelUsed] || 0) + 1;

      // Token estimation (standard ~4 chars per token for Latin/Code)
      const noteInputTokens = Math.round((transcriptLen + slidesLen) / 4);
      const noteOutputTokens = Math.round(markdownLen / 4);
      const noteTotalTokens = noteInputTokens + noteOutputTokens;

      // Course breakdown
      const cCode = note.course_code || 'OTHER';
      const cStat = courseMap.get(cCode) || { notesCount: 0, audioSeconds: 0, pdfPages: 0, estimatedTokens: 0 };
      cStat.notesCount += 1;
      cStat.audioSeconds += audioDuration;
      cStat.pdfPages += pdfPages;
      cStat.estimatedTokens += noteTotalTokens;
      courseMap.set(cCode, cStat);

      // Student breakdown
      const email = note.author_email || 'anonymous';
      const sStat = studentMap.get(email) || { notesCount: 0, lastActive: note.created_at };
      sStat.notesCount += 1;
      if (note.created_at > sStat.lastActive) {
        sStat.lastActive = note.created_at;
      }
      studentMap.set(email, sStat);

      return {
        id: note.id,
        title: note.title,
        courseCode: note.course_code,
        authorEmail: note.author_email || 'anonymous',
        createdAt: note.created_at,
        modelUsed,
        audioDurationSeconds: Math.round(audioDuration),
        pdfPagesProcessed: pdfPages,
        estimatedTokens: noteTotalTokens,
      };
    });

    const estimatedInputTokens = Math.round(totalInputChars / 4);
    const estimatedOutputTokens = Math.round(totalOutputChars / 4);
    const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens;

    // Ephemeral processed MB estimate: ~4KB/sec for 32kbps mono audio + ~1.2MB avg PDF
    const audioMb = (totalAudioSeconds * 4) / 1024;
    const pdfMb = pdfNotesCount * 1.2;
    const estimatedProcessedMb = Math.round((audioMb + pdfMb) * 10) / 10;

    const payload: AdminMetricsResponse = {
      summary: {
        totalNotes: allNotes.length,
        totalAudioSeconds: Math.round(totalAudioSeconds),
        totalAudioHours: Number((totalAudioSeconds / 3600).toFixed(2)),
        audioNotesCount,
        pdfNotesCount,
        totalPdfPages,
        estimatedInputTokens,
        estimatedOutputTokens,
        estimatedTotalTokens,
        uniqueStudentsCount: studentMap.size,
        activeCoursesCount: courseMap.size,
      },
      groq: {
        totalSecondsTranscribed: Math.round(totalAudioSeconds),
        totalMinutesTranscribed: Number((totalAudioSeconds / 60).toFixed(1)),
        totalHoursTranscribed: Number((totalAudioSeconds / 3600).toFixed(2)),
        hourlyQuotaSeconds: 7200,
        lastHourAudioSeconds: Math.round(lastHourAudioSeconds),
        percentHourlyQuotaUsed: Math.min(100, Number(((lastHourAudioSeconds / 7200) * 100).toFixed(1))),
        sttModel: 'whisper-large-v3-turbo',
      },
      gemini: {
        totalCalls: allNotes.length,
        estimatedTokens: {
          input: estimatedInputTokens,
          output: estimatedOutputTokens,
          total: estimatedTotalTokens,
        },
        modelDistribution,
      },
      r2: {
        persistentStorageMb: 0,
        estimatedProcessedMb,
        totalFilesAutoPurged,
        status: '100% Ephemeral (0 MB Persistent Invariant Enforced)',
      },
      courseBreakdown: Array.from(courseMap.entries()).map(([courseCode, stat]) => ({
        courseCode,
        notesCount: stat.notesCount,
        audioSeconds: Math.round(stat.audioSeconds),
        pdfPages: stat.pdfPages,
        estimatedTokens: stat.estimatedTokens,
      })),
      studentBreakdown: Array.from(studentMap.entries()).map(([email, stat]) => ({
        email,
        notesCount: stat.notesCount,
        lastActive: stat.lastActive,
      })),
      recentNotes: recentNotes.slice(0, 25),
    };

    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to retrieve admin telemetry.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
