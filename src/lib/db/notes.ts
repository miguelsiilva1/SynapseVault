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

export interface PersonalNoteRecord {
  id: string;
  course_code: string;
  title: string;
  slug: string;
  lecture_date: string;
  content_markdown: string;
  author_email: string;
  metadata: Record<string, any>;
  created_at: string;
}

/**
 * Retrieves all synthesized notes authored by a specific user email.
 */
export async function getPersonalNotes(authorEmail: string): Promise<{ notes: PersonalNoteRecord[]; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { notes: [], error: 'Supabase client unconfigured in environment.' };
    }

    const { data, error } = await supabase
      .from('notes')
      .select('id, course_code, title, slug, lecture_date, content_markdown, author_email, metadata, created_at')
      .eq('author_email', authorEmail.trim().toLowerCase())
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[Supabase DB] Failed to fetch personal notes:', error.message);
      return { notes: [], error: error.message };
    }

    return { notes: data || [] };
  } catch (err) {
    console.warn('[Supabase DB] Error in getPersonalNotes:', err);
    return { notes: [], error: 'Failed to query personal notes.' };
  }
}

/**
 * Deletes a synthesized note if it belongs to the specified author.
 */
export async function deletePersonalNote(noteId: string, authorEmail: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase client unconfigured in environment.' };
    }

    const { error } = await supabase
      .from('notes')
      .delete()
      .eq('id', noteId)
      .eq('author_email', authorEmail.trim().toLowerCase());

    if (error) {
      console.warn('[Supabase DB] Failed to delete note:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.warn('[Supabase DB] Error in deletePersonalNote:', err);
    return { success: false, error: 'Failed to delete note.' };
  }
}

/**
 * Updates a note's title and slug if it belongs to the specified author.
 */
export async function updatePersonalNoteTitle(
  noteId: string,
  newTitle: string,
  authorEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    if (!supabase) {
      return { success: false, error: 'Supabase client unconfigured in environment.' };
    }

    const trimmedTitle = newTitle.trim();
    if (!trimmedTitle) {
      return { success: false, error: 'Title cannot be empty.' };
    }

    const slug = trimmedTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const { error } = await supabase
      .from('notes')
      .update({
        title: trimmedTitle,
        slug,
      })
      .eq('id', noteId)
      .eq('author_email', authorEmail.trim().toLowerCase());

    if (error) {
      console.warn('[Supabase DB] Failed to update note title:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.warn('[Supabase DB] Error in updatePersonalNoteTitle:', err);
    return { success: false, error: 'Failed to update note title.' };
  }
}



