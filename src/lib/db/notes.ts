import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface InsertNoteParams {
  courseName: string;
  courseCode: string;
  title: string;
  lectureDate?: string;
  contentMarkdown: string;
  authorEmail?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Persists a synthesized note to Supabase PostgreSQL table 'notes' if the table exists.
 * Gracefully ignores insertion errors if the database schema is not yet migrated.
 */
export async function persistNoteToDatabase(params: InsertNoteParams): Promise<{ id?: string; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { error: 'Supabase client unconfigured in environment.' };
    }

    const slug = params.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const { data, error } = await supabase
      .from('notes')
      .insert({
        course_code: params.courseCode,
        title: params.title,
        slug,
        lecture_date: params.lectureDate || new Date().toISOString().split('T')[0],
        content_markdown: params.contentMarkdown,
        author_email: params.authorEmail,
        metadata: params.metadata || {},
      })
      .select('id')
      .single();

    if (error) {
      console.warn('[Supabase DB] Note persistence skipped (table may not exist yet):', error.message);
      return { error: error.message };
    }

    return { id: data?.id };
  } catch (err) {
    console.warn('[Supabase DB] Failed to persist note:', err);
    return { error: 'Database insertion failed.' };
  }
}
