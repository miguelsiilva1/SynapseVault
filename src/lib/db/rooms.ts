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
  folder_type: 'year' | 'semester' | 'course' | 'section' | 'project' | 'custom';
  course_code?: string;
  sort_order: number;
  created_by_email?: string;
  created_at: string;
}

export interface RoomProjectLogRecord {
  id: string;
  room_id: string;
  folder_id: string;
  content_markdown: string;
  guidelines_markdown?: string;
  last_updated_at: string;
  updated_by_email?: string;
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
        const { data: createdCourses } = await supabase
          .from('room_folders')
          .insert(courseInserts)
          .select('id, course_code');

        if (createdCourses && createdCourses.length > 0) {
          const subfolderInserts = createdCourses.flatMap((course) => [
            {
              room_id: room.id,
              parent_id: course.id,
              name: 'Teóricas',
              folder_type: 'section' as const,
              course_code: course.course_code,
              sort_order: 1,
            },
            {
              room_id: room.id,
              parent_id: course.id,
              name: 'Projetos',
              folder_type: 'project' as const,
              course_code: course.course_code,
              sort_order: 2,
            },
          ]);
          await supabase.from('room_folders').insert(subfolderInserts);
        }
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

    let foldersList = foldersRes.data || [];

    // Deduplicate any repeated folders in memory (prevents duplicate items in UI)
    const seenFolderKeys = new Set<string>();
    foldersList = foldersList.filter((f) => {
      const key = `${f.parent_id || 'root'}_${f.name.trim().toLowerCase()}`;
      if (seenFolderKeys.has(key)) return false;
      seenFolderKeys.add(key);
      return true;
    });

    // Auto-bootstrap Teóricas and Projetos for any existing course folders lacking them
    const courseFolders = foldersList.filter((f) => f.folder_type === 'course');
    const missingSubfolderInserts: Array<{
      room_id: string;
      parent_id: string;
      name: string;
      folder_type: 'section' | 'project';
      course_code: string | null;
      sort_order: number;
    }> = [];

    for (const course of courseFolders) {
      const hasTeoricas = foldersList.some(
        (f) => f.parent_id === course.id && f.name.trim().toLowerCase() === 'teóricas'
      );
      const hasProjetos = foldersList.some(
        (f) => f.parent_id === course.id && f.name.trim().toLowerCase() === 'projetos'
      );

      if (!hasTeoricas) {
        missingSubfolderInserts.push({
          room_id: roomId,
          parent_id: course.id,
          name: 'Teóricas',
          folder_type: 'section',
          course_code: course.course_code || null,
          sort_order: 1,
        });
      }
      if (!hasProjetos) {
        missingSubfolderInserts.push({
          room_id: roomId,
          parent_id: course.id,
          name: 'Projetos',
          folder_type: 'project',
          course_code: course.course_code || null,
          sort_order: 2,
        });
      }
    }

    if (missingSubfolderInserts.length > 0) {
      const { data: newSubs } = await supabase
        .from('room_folders')
        .insert(missingSubfolderInserts)
        .select('*');
      if (newSubs && newSubs.length > 0) {
        foldersList = [...foldersList, ...newSubs];
      }
    }

    return {
      room: { ...roomRes.data, role: memberCheck.role },
      members: membersRes.data || [],
      folders: foldersList,
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
 * Deletes a folder's master summary.
 */
export async function deleteFolderMasterSummary(
  folderId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient() || (await createServerSupabaseClient());
    if (!supabase) return { success: false, error: 'Database unconfigured.' };

    const { error } = await supabase
      .from('room_master_summaries')
      .delete()
      .eq('folder_id', folderId);

    if (error) {
      console.warn('[Supabase DB] Failed to delete master summary:', error.message);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    console.warn('[Supabase DB] Error in deleteFolderMasterSummary:', err);
    return { success: false, error: 'Failed to delete master summary.' };
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

/**
 * Creates a new folder or subfolder inside a room.
 * Admins can create anywhere. Regular members can create project or section folders inside courses/projects.
 */
export async function createRoomFolder(params: {
  roomId: string;
  parentId?: string | null;
  name: string;
  folderType?: 'year' | 'semester' | 'course' | 'section' | 'project' | 'custom';
  courseCode?: string;
  userEmail: string;
}): Promise<{ folder?: RoomFolderRecord; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient() || (await createServerSupabaseClient());
    if (!supabase) return { error: 'Database unconfigured.' };

    const email = params.userEmail.trim().toLowerCase();
    const trimmedName = params.name.trim();
    if (!trimmedName) return { error: 'O nome da pasta é obrigatório.' };

    // Check membership
    const { data: memberCheck } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', params.roomId)
      .eq('user_email', email)
      .maybeSingle();

    if (!memberCheck) {
      return { error: 'Acesso negado. Não és membro desta sala.' };
    }

    const folderType = params.folderType || 'project';

    // If creating top-level year or semester: require owner
    if ((folderType === 'year' || folderType === 'semester') && memberCheck.role !== 'owner') {
      return { error: 'Apenas o administrador pode criar anos ou semestres.' };
    }

    // Determine sort_order
    let sortOrder = 1;
    if (params.parentId) {
      const { data: siblings } = await supabase
        .from('room_folders')
        .select('sort_order')
        .eq('room_id', params.roomId)
        .eq('parent_id', params.parentId)
        .order('sort_order', { ascending: false })
        .limit(1);

      if (siblings && siblings.length > 0) {
        sortOrder = (siblings[0].sort_order || 0) + 1;
      }
    }

    const { data: folder, error } = await supabase
      .from('room_folders')
      .insert({
        room_id: params.roomId,
        parent_id: params.parentId || null,
        name: trimmedName,
        folder_type: folderType,
        course_code: params.courseCode || null,
        sort_order: sortOrder,
        created_by_email: email,
      })
      .select('*')
      .single();

    if (error) {
      console.warn('[Supabase DB] Error creating folder:', error.message);
      return { error: error.message };
    }

    return { folder };
  } catch (err) {
    console.warn('[Supabase DB] Error in createRoomFolder:', err);
    return { error: 'Falha ao criar pasta.' };
  }
}

/**
 * Renames an existing folder.
 * Admin can rename any folder. Folder creator can rename their own folder.
 */
export async function updateRoomFolder(params: {
  roomId: string;
  folderId: string;
  name: string;
  userEmail: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient() || (await createServerSupabaseClient());
    if (!supabase) return { success: false, error: 'Database unconfigured.' };

    const email = params.userEmail.trim().toLowerCase();
    const trimmedName = params.name.trim();
    if (!trimmedName) return { success: false, error: 'O nome da pasta é obrigatório.' };

    // Check membership
    const { data: memberCheck } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', params.roomId)
      .eq('user_email', email)
      .maybeSingle();

    if (!memberCheck) return { success: false, error: 'Acesso negado.' };

    // Check folder
    const { data: folder } = await supabase
      .from('room_folders')
      .select('*')
      .eq('id', params.folderId)
      .eq('room_id', params.roomId)
      .single();

    if (!folder) return { success: false, error: 'Pasta não encontrada.' };

    const isOwner = memberCheck.role === 'owner';
    const isCreator = folder.created_by_email && folder.created_by_email.toLowerCase() === email;

    if (!isOwner && !isCreator) {
      return { success: false, error: 'Não tens permissão para renomear esta pasta.' };
    }

    const { error } = await supabase
      .from('room_folders')
      .update({ name: trimmedName })
      .eq('id', params.folderId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    console.warn('[Supabase DB] Error in updateRoomFolder:', err);
    return { success: false, error: 'Falha ao renomear pasta.' };
  }
}

/**
 * Deletes a folder and all its contents (cascade).
 * Admin can delete any folder. Folder creator can delete their own folder.
 */
export async function deleteRoomFolder(params: {
  roomId: string;
  folderId: string;
  userEmail: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient() || (await createServerSupabaseClient());
    if (!supabase) return { success: false, error: 'Database unconfigured.' };

    const email = params.userEmail.trim().toLowerCase();

    // Check membership
    const { data: memberCheck } = await supabase
      .from('room_members')
      .select('role')
      .eq('room_id', params.roomId)
      .eq('user_email', email)
      .maybeSingle();

    if (!memberCheck) return { success: false, error: 'Acesso negado.' };

    // Check folder
    const { data: folder } = await supabase
      .from('room_folders')
      .select('*')
      .eq('id', params.folderId)
      .eq('room_id', params.roomId)
      .single();

    if (!folder) return { success: false, error: 'Pasta não encontrada.' };

    const isOwner = memberCheck.role === 'owner';
    const isCreator = folder.created_by_email && folder.created_by_email.toLowerCase() === email;

    if (!isOwner && !isCreator) {
      return { success: false, error: 'Não tens permissão para eliminar esta pasta.' };
    }

    const { error } = await supabase
      .from('room_folders')
      .delete()
      .eq('id', params.folderId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    console.warn('[Supabase DB] Error in deleteRoomFolder:', err);
    return { success: false, error: 'Falha ao eliminar pasta.' };
  }
}

/**
 * Retrieves the collaborative project log (chat MD sem IA) for a folder.
 */
export async function getProjectLog(folderId: string): Promise<{ log?: RoomProjectLogRecord; error?: string }> {
  try {
    const supabase = (await createServerSupabaseClient()) || createAdminSupabaseClient();
    if (!supabase) return { error: 'Database unconfigured.' };

    const { data, error } = await supabase
      .from('room_project_logs')
      .select('*')
      .eq('folder_id', folderId)
      .maybeSingle();

    if (error) return { error: error.message };
    return { log: data || undefined };
  } catch (err) {
    console.warn('[Supabase DB] Error in getProjectLog:', err);
    return { error: 'Falha ao carregar log de projeto.' };
  }
}

/**
 * Saves or updates the full content of a project log.
 */
export async function saveProjectLog(params: {
  roomId: string;
  folderId: string;
  contentMarkdown: string;
  userEmail: string;
}): Promise<{ log?: RoomProjectLogRecord; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient() || (await createServerSupabaseClient());
    if (!supabase) return { error: 'Database unconfigured.' };

    const email = params.userEmail.trim().toLowerCase();

    const { data, error } = await supabase
      .from('room_project_logs')
      .upsert(
        {
          room_id: params.roomId,
          folder_id: params.folderId,
          content_markdown: params.contentMarkdown,
          last_updated_at: new Date().toISOString(),
          updated_by_email: email,
        },
        { onConflict: 'folder_id' }
      )
      .select('*')
      .single();

    if (error) return { error: error.message };
    return { log: data };
  } catch (err) {
    console.warn('[Supabase DB] Error in saveProjectLog:', err);
    return { error: 'Falha ao gravar log de projeto.' };
  }
}

/**
 * Appends a new timestamped log message (chat-style) to a project folder's log.
 */
export async function appendProjectLogEntry(params: {
  roomId: string;
  folderId: string;
  message: string;
  userEmail: string;
}): Promise<{ log?: RoomProjectLogRecord; error?: string }> {
  try {
    const existing = await getProjectLog(params.folderId);
    const existingContent =
      existing.log?.content_markdown ||
      '# Caderno de Projeto & Log de Grupo\n\nRegisto cronológico de reuniões, decisões técnicas e tarefas da equipa.\n';
    const timestamp = new Date().toLocaleString('pt-PT');
    const entry = `\n\n### 💬 ${timestamp} — \`${params.userEmail.split('@')[0]}\`\n${params.message.trim()}\n`;

    return await saveProjectLog({
      roomId: params.roomId,
      folderId: params.folderId,
      contentMarkdown: existingContent + entry,
      userEmail: params.userEmail,
    });
  } catch (err) {
    console.warn('[Supabase DB] Error in appendProjectLogEntry:', err);
    return { error: 'Falha ao adicionar entrada ao log.' };
  }
}

/**
 * Saves or updates project guidelines & interactive checklist for a project folder.
 */
export async function saveProjectGuidelines(params: {
  roomId: string;
  folderId: string;
  guidelinesMarkdown: string;
  userEmail: string;
}): Promise<{ log?: RoomProjectLogRecord; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient() || (await createServerSupabaseClient());
    if (!supabase) return { error: 'Database unconfigured.' };

    const email = params.userEmail.trim().toLowerCase();

    const { data: existing } = await supabase
      .from('room_project_logs')
      .select('id')
      .eq('folder_id', params.folderId)
      .maybeSingle();

    if (existing?.id) {
      const { data, error } = await supabase
        .from('room_project_logs')
        .update({
          guidelines_markdown: params.guidelinesMarkdown,
          last_updated_at: new Date().toISOString(),
          updated_by_email: email,
        })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) return { error: error.message };
      return { log: data };
    } else {
      const { data, error } = await supabase
        .from('room_project_logs')
        .insert({
          room_id: params.roomId,
          folder_id: params.folderId,
          content_markdown: `# Log de Projeto\n`,
          guidelines_markdown: params.guidelinesMarkdown,
          updated_by_email: email,
        })
        .select('*')
        .single();

      if (error) return { error: error.message };
      return { log: data };
    }
  } catch (err) {
    console.warn('[Supabase DB] Error in saveProjectGuidelines:', err);
    return { error: 'Falha ao gravar guião de projeto.' };
  }
}

/**
 * Finds an existing subfolder by name under a parent folder or creates it if not found.
 */
export async function findOrCreateSubfolderByName(params: {
  roomId: string;
  parentId: string;
  name: string;
  folderType?: 'section' | 'project' | 'custom';
  courseCode?: string | null;
  userEmail?: string;
}): Promise<{ folder?: RoomFolderRecord; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient() || (await createServerSupabaseClient());
    if (!supabase) return { error: 'Database unconfigured.' };

    const trimmedName = params.name.trim();

    // Check if subfolder already exists under parentId (case-insensitive)
    const { data: existingList } = await supabase
      .from('room_folders')
      .select('*')
      .eq('room_id', params.roomId)
      .eq('parent_id', params.parentId);

    const match = (existingList || []).find(
      (f) => f.name.trim().toLowerCase() === trimmedName.toLowerCase()
    );

    if (match) {
      return { folder: match };
    }

    // Otherwise create it
    const { count } = await supabase
      .from('room_folders')
      .select('*', { count: 'exact', head: true })
      .eq('parent_id', params.parentId);

    const { data, error } = await supabase
      .from('room_folders')
      .insert({
        room_id: params.roomId,
        parent_id: params.parentId,
        name: trimmedName,
        folder_type: params.folderType || 'section',
        course_code: params.courseCode || null,
        created_by_email: params.userEmail?.toLowerCase() || null,
        sort_order: (count || 0) + 1,
      })
      .select('*')
      .single();

    if (error) return { error: error.message };
    return { folder: data };
  } catch (err) {
    console.warn('[Supabase DB] Error in findOrCreateSubfolderByName:', err);
    return { error: 'Falha ao localizar ou criar subpasta.' };
  }
}

/**
 * Deletes a note from a room, checking that user is room owner or note author.
 */
export async function deleteRoomNote(params: {
  roomId: string;
  noteId: string;
  userEmail: string;
}): Promise<{ success?: boolean; error?: string }> {
  try {
    const supabase = createAdminSupabaseClient() || (await createServerSupabaseClient());
    if (!supabase) return { error: 'Supabase client unconfigured.' };

    const email = params.userEmail.trim().toLowerCase();

    // 1. Fetch note
    const { data: note, error: noteErr } = await supabase
      .from('room_notes')
      .select('*')
      .eq('id', params.noteId)
      .eq('room_id', params.roomId)
      .maybeSingle();

    if (noteErr || !note) {
      return { error: 'Nota não encontrada nesta sala.' };
    }

    // 2. Fetch room to check owner
    const { data: room } = await supabase
      .from('study_rooms')
      .select('created_by_email')
      .eq('id', params.roomId)
      .maybeSingle();

    const isOwner = room?.created_by_email?.toLowerCase() === email;
    const isAuthor = note.author_email?.toLowerCase() === email;

    if (!isOwner && !isAuthor) {
      return { error: 'Sem permissão para eliminar esta aula.' };
    }

    const { data: deleted, error: delErr } = await supabase
      .from('room_notes')
      .delete()
      .eq('id', params.noteId)
      .eq('room_id', params.roomId)
      .select('id');

    if (delErr) {
      console.warn('[Supabase DB] Error in deleteRoomNote:', delErr);
      return { error: delErr.message };
    }

    if (!deleted || deleted.length === 0) {
      return { error: 'Nenhuma nota foi eliminada da base de dados.' };
    }

    return { success: true };
  } catch (err) {
    console.warn('[Supabase DB] Error in deleteRoomNote:', err);
    return { error: 'Falha ao eliminar nota.' };
  }
}
