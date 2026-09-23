import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createAdminSupabaseClient } from '@/lib/supabase/admin';

export interface StudyRoomRecord {
  id: string;
  name: string;
  slug: string;
  description?: string;
  owner_email: string;
  role?: string;
  created_at: string;
  members_count?: number;
}

export interface RoomMemberRecord {
  id: string;
  room_id: string;
  user_email: string;
  role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface RoomFolderRecord {
  id: string;
  room_id: string;
  parent_id?: string | null;
  name: string;
  folder_type: 'year' | 'semester' | 'course';
  course_code?: string;
  sort_order: number;
  created_at: string;
}

export interface RoomNoteRecord {
  id: string;
  room_id: string;
  folder_id: string;
  source_note_id?: string;
  title: string;
  content_markdown: string;
  author_email: string;
  imported_at: string;
}

export interface MasterSummaryRecord {
  id: string;
  room_id: string;
  folder_id: string;
  content_markdown: string;
  version: number;
  last_updated_at: string;
  updated_by_email?: string;
  sources_count: number;
  model_used: string;
}

/**
 * Default university courses for bootstrapping folder hierarchy.
 */
const DEFAULT_BOOTSTRAP_COURSES = [
  { code: 'ASSIST', name: 'Administração de Sistemas' },
  { code: 'GESTA', name: 'Gestão' },
  { code: 'REDSC', name: 'Redes e Sistemas de Comunicações' },
  { code: 'SEINF', name: 'Segurança Informática' },
  { code: 'SIDIS', name: 'Sistemas Distribuídos' },
  { code: 'SGRAI', name: 'Sistemas Gráficos e Interação' },
  { code: 'STAER', name: 'Telecomunicações na Aeronáutica' },
  { code: 'VIBON', name: 'Vibração e Ondas' },
];

/**
 * Fetches all study rooms that a given user belongs to.
 */
export async function getUserStudyRooms(userEmail: string): Promise<{ rooms: StudyRoomRecord[]; error?: string }> {
  try {
    const supabase = (await createServerSupabaseClient()) || createAdminSupabaseClient();
    if (!supabase) return { rooms: [], error: 'Supabase client unconfigured.' };

    const email = userEmail.trim().toLowerCase();

    // Query membership
    const { data: memberRows, error: memberErr } = await supabase
      .from('room_members')
      .select('room_id, role')
      .eq('user_email', email);

    if (memberErr) {
      console.warn('[Supabase DB] Error querying room_members:', memberErr.message);
      return { rooms: [], error: memberErr.message };
    }

    if (!memberRows || memberRows.length === 0) {
      return { rooms: [] };
    }

    const roomIds = memberRows.map((m) => m.room_id);
    const { data: roomRows, error: roomErr } = await supabase
      .from('study_rooms')
      .select('*')
      .in('id', roomIds)
      .order('created_at', { ascending: false });

    if (roomErr) {
      return { rooms: [], error: roomErr.message };
    }

    const rooms: StudyRoomRecord[] = (roomRows || []).map((r) => {
      const membership = memberRows.find((m) => m.room_id === r.id);
      return {
        ...r,
        role: membership?.role || 'member',
      };
    });

    return { rooms };
  } catch (err) {
    console.warn('[Supabase DB] Exception in getUserStudyRooms:', err);
    return { rooms: [], error: 'Failed to load study rooms.' };
  }
}

/**
 * Creates a new collaborative study room, invites initial students, and bootstraps the standard course tree.
 */
export async function createStudyRoom(params: {
  name: string;
  description?: string;
  ownerEmail: string;
  initialMemberEmails: string[];
}): Promise<{ room?: StudyRoomRecord; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient() || (await createServerSupabaseClient());
    if (!supabase) return { error: 'Database unconfigured.' };

    const owner = params.ownerEmail.trim().toLowerCase();
    const slugBase = params.name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const slug = `${slugBase}-${Math.random().toString(36).substring(2, 7)}`;

    // 1. Insert room
    const { data: room, error: roomErr } = await supabase
      .from('study_rooms')
      .insert({
        name: params.name.trim(),
        slug,
        description: params.description || '',
        owner_email: owner,
      })
      .select('*')
      .single();

    if (roomErr || !room) {
      return { error: roomErr?.message || 'Failed to insert study room.' };
    }

    // 2. Add owner and members
    const allMembers = Array.from(
      new Set([owner, ...params.initialMemberEmails.map((e) => e.trim().toLowerCase()).filter(Boolean)])
    );

    const memberInserts = allMembers.map((email) => ({
      room_id: room.id,
      user_email: email,
      role: email === owner ? 'owner' : 'member',
    }));

    await supabase.from('room_members').insert(memberInserts);

    // 3. Bootstrap academic folder tree: 3_Ano -> 1_Semestre -> Cadeiras
    const { data: yearFolder } = await supabase
      .from('room_folders')
      .insert({
        room_id: room.id,
        name: '3º Ano',
        folder_type: 'year',
        sort_order: 1,
      })
      .select('id')
      .single();

    if (yearFolder?.id) {
      const { data: semFolder } = await supabase
        .from('room_folders')
        .insert({
          room_id: room.id,
          parent_id: yearFolder.id,
          name: '1º Semestre',
          folder_type: 'semester',
          sort_order: 1,
        })
        .select('id')
        .single();

      if (semFolder?.id) {
        const courseInserts = DEFAULT_BOOTSTRAP_COURSES.map((course, idx) => ({
          room_id: room.id,
          parent_id: semFolder.id,
          name: `${course.name} (${course.code})`,
          folder_type: 'course' as const,
          course_code: course.code,
          sort_order: idx + 1,
        }));
        await supabase.from('room_folders').insert(courseInserts);
      }
    }

    return { room };
  } catch (err) {
    console.warn('[Supabase DB] Exception in createStudyRoom:', err);
    return { error: 'Failed to create study room.' };
  }
}

/**
 * Gets full room details including members, hierarchical folders, and notes.
 */
export async function getRoomDetails(
  roomId: string,
  userEmail: string
): Promise<{
  room?: StudyRoomRecord;
  members?: RoomMemberRecord[];
  folders?: RoomFolderRecord[];
  notes?: RoomNoteRecord[];
  error?: string;
}> {
  try {
    const supabase = (await createServerSupabaseClient()) || createAdminSupabaseClient();
    if (!supabase) return { error: 'Supabase unconfigured.' };

    const email = userEmail.trim().toLowerCase();

    // Verify membership
    const { data: memberCheck } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_email', email)
      .maybeSingle();

    if (!memberCheck) {
      return { error: 'Access denied. You are not a member of this study room.' };
    }

    // Fetch room, members, folders, notes in parallel
    const [roomRes, membersRes, foldersRes, notesRes] = await Promise.all([
      supabase.from('study_rooms').select('*').eq('id', roomId).single(),
      supabase.from('room_members').select('*').eq('room_id', roomId).order('joined_at'),
      supabase.from('room_folders').select('*').eq('room_id', roomId).order('sort_order'),
      supabase.from('room_notes').select('*').eq('room_id', roomId).order('imported_at', { ascending: false }),
    ]);

    if (roomRes.error) return { error: roomRes.error.message };

    return {
      room: { ...roomRes.data, role: memberCheck.role },
      members: membersRes.data || [],
      folders: foldersRes.data || [],
      notes: notesRes.data || [],
    };
  } catch (err) {
    console.warn('[Supabase DB] Exception in getRoomDetails:', err);
    return { error: 'Failed to fetch room details.' };
  }
}

/**
 * Imports an individual lecture note into a room folder.
 */
export async function importNoteToRoom(params: {
  roomId: string;
  folderId: string;
  sourceNoteId?: string;
  title: string;
  contentMarkdown: string;
  authorEmail: string;
}): Promise<{ note?: RoomNoteRecord; error?: string }> {
  try {
    const supabase = (await createServerSupabaseClient()) || createAdminSupabaseClient();
    if (!supabase) return { error: 'Supabase client unconfigured.' };

    const { data, error } = await supabase
      .from('room_notes')
      .insert({
        room_id: params.roomId,
        folder_id: params.folderId,
        source_note_id: params.sourceNoteId || null,
        title: params.title.trim(),
        content_markdown: params.contentMarkdown,
        author_email: params.authorEmail.trim().toLowerCase(),
      })
      .select('*')
      .single();

    if (error) return { error: error.message };
    return { note: data };
  } catch (err) {
    console.warn('[Supabase DB] Error in importNoteToRoom:', err);
    return { error: 'Failed to import note to room.' };
  }
}

/**
 * Gets the current master summary for a course folder.
 */
export async function getFolderMasterSummary(
  folderId: string
): Promise<{ summary?: MasterSummaryRecord; error?: string }> {
  try {
    const supabase = (await createServerSupabaseClient()) || createAdminSupabaseClient();
    if (!supabase) return { error: 'Supabase unconfigured.' };

    const { data, error } = await supabase
      .from('room_master_summaries')
      .select('*')
      .eq('folder_id', folderId)
      .maybeSingle();

    if (error) return { error: error.message };
    return { summary: data || undefined };
  } catch (err) {
    console.warn('[Supabase DB] Error in getFolderMasterSummary:', err);
    return { error: 'Failed to fetch master summary.' };
  }
}

/**
 * Saves/updates a folder's master summary.
 */
export async function saveFolderMasterSummary(params: {
  roomId: string;
  folderId: string;
  contentMarkdown: string;
  updatedByEmail: string;
  modelUsed: string;
  sourcesCount: number;
}): Promise<{ summary?: MasterSummaryRecord; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient() || (await createServerSupabaseClient());
    if (!supabase) return { error: 'Supabase unconfigured.' };

    const existing = await getFolderMasterSummary(params.folderId);
    const nextVersion = existing.summary ? existing.summary.version + 1 : 1;

    const { data, error } = await supabase
      .from('room_master_summaries')
      .upsert(
        {
          room_id: params.roomId,
          folder_id: params.folderId,
          content_markdown: params.contentMarkdown,
          version: nextVersion,
          last_updated_at: new Date().toISOString(),
          updated_by_email: params.updatedByEmail.trim().toLowerCase(),
          sources_count: params.sourcesCount,
          model_used: params.modelUsed,
        },
        { onConflict: 'folder_id' }
      )
      .select('*')
      .single();

    if (error) return { error: error.message };
    return { summary: data };
  } catch (err) {
    console.warn('[Supabase DB] Error in saveFolderMasterSummary:', err);
    return { error: 'Failed to save master summary.' };
  }
}

/**
 * Updates a study room's name if the requesting user is the room owner/creator.
 */
export async function updateRoomName(
  roomId: string,
  newName: string,
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient() || (await createServerSupabaseClient());
    if (!supabase) return { success: false, error: 'Database unconfigured.' };

    const email = userEmail.trim().toLowerCase();
    const trimmedName = newName.trim();
    if (!trimmedName) {
      return { success: false, error: 'Room name cannot be empty.' };
    }

    // Verify ownership
    const { data: memberCheck } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_email', email)
      .maybeSingle();

    if (!memberCheck || memberCheck.role !== 'owner') {
      return { success: false, error: 'Apenas o criador da sala tem permissão para alterar o nome.' };
    }

    const { error } = await supabase
      .from('study_rooms')
      .update({ name: trimmedName })
      .eq('id', roomId);

    if (error) {
      console.warn('[Supabase DB] Failed to update room name:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.warn('[Supabase DB] Error in updateRoomName:', err);
    return { success: false, error: 'Failed to update room name.' };
  }
}

/**
 * Adds a new member to a study room if the requester is the room owner.
 */
export async function addRoomMember(
  roomId: string,
  targetEmail: string,
  userEmail: string
): Promise<{ success: boolean; member?: RoomMemberRecord; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient() || (await createServerSupabaseClient());
    if (!supabase) return { success: false, error: 'Database unconfigured.' };

    const email = userEmail.trim().toLowerCase();
    const target = targetEmail.trim().toLowerCase();

    if (!target || !target.includes('@')) {
      return { success: false, error: 'Email inválido.' };
    }

    // Verify ownership
    const { data: memberCheck } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_email', email)
      .maybeSingle();

    if (!memberCheck || memberCheck.role !== 'owner') {
      return { success: false, error: 'Apenas o criador da sala tem permissão para adicionar membros.' };
    }

    // Check if already a member
    const { data: existing } = await supabase
      .from('room_members')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_email', target)
      .maybeSingle();

    if (existing) {
      return { success: false, error: 'Este utilizador já é membro da sala.' };
    }

    const { data: newMember, error } = await supabase
      .from('room_members')
      .insert({
        room_id: roomId,
        user_email: target,
        role: 'member',
      })
      .select('*')
      .single();

    if (error) {
      console.warn('[Supabase DB] Failed to add member:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true, member: newMember };
  } catch (err) {
    console.warn('[Supabase DB] Error in addRoomMember:', err);
    return { success: false, error: 'Failed to add room member.' };
  }
}

/**
 * Removes a member from a study room if the requester is the room owner.
 */
export async function removeRoomMember(
  roomId: string,
  targetEmail: string,
  userEmail: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient() || (await createServerSupabaseClient());
    if (!supabase) return { success: false, error: 'Database unconfigured.' };

    const email = userEmail.trim().toLowerCase();
    const target = targetEmail.trim().toLowerCase();

    if (email === target) {
      return { success: false, error: 'O criador da sala não pode remover-se a si próprio.' };
    }

    // Verify ownership
    const { data: memberCheck } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', roomId)
      .eq('user_email', email)
      .maybeSingle();

    if (!memberCheck || memberCheck.role !== 'owner') {
      return { success: false, error: 'Apenas o criador da sala tem permissão para remover membros.' };
    }

    const { error } = await supabase
      .from('room_members')
      .delete()
      .eq('room_id', roomId)
      .eq('user_email', target);

    if (error) {
      console.warn('[Supabase DB] Failed to remove member:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.warn('[Supabase DB] Error in removeRoomMember:', err);
    return { success: false, error: 'Failed to remove member.' };
  }
}
