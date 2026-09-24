'use client';

import React, { useEffect, useState, use, useMemo, useRef } from 'react';
import Link from 'next/link';
import { renderMarkdown } from '@/lib/utils/markdownRenderer';
import {
  ArrowLeft,
  FolderTree,
  Folder,
  FolderOpen,
  FileText,
  Users,
  Sparkles,
  BookOpen,
  Download,
  Copy,
  CheckCircle2,
  RefreshCw,
  Plus,
  Layers,
  ChevronRight,
  ChevronDown,
  Calendar,
  User,
  ShieldCheck,
  AlertCircle,
  FileCode,
  Eye,
  Globe,
  Pencil,
  Trash2,
  UserPlus,
  Check,
  X,
  Send,
  Edit3,
  CheckSquare,
  MessageSquare,
  GripVertical,
  ArrowRight,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { detectWeekFromTitle } from '@/lib/utils/weekDetection';
import type {
  StudyRoomRecord,
  RoomFolderRecord,
  RoomMemberRecord,
  RoomNoteRecord,
  MasterSummaryRecord,
  RoomProjectLogRecord,
} from '@/lib/db/rooms';
import type { PersonalNoteRecord } from '@/lib/db/notes';

export default function RoomWorkspacePage({
  params,
}: {
  params: Promise<{ roomId: string }>;
}) {
  const resolvedParams = use(params);
  const roomId = resolvedParams.roomId;

  const [currentUser, setCurrentUser] = useState<{ email?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Language State
  const [outputLanguage, setOutputLanguage] = useState<'pt' | 'en'>('pt');

  // Resizable Sidebar Width (220px to 650px)
  const [sidebarWidth, setSidebarWidth] = useState<number>(300);
  const [isResizingSidebar, setIsResizingSidebar] = useState<boolean>(false);

  // Room Data
  const [room, setRoom] = useState<StudyRoomRecord | null>(null);
  const [members, setMembers] = useState<RoomMemberRecord[]>([]);
  const [folders, setFolders] = useState<RoomFolderRecord[]>([]);
  const [notes, setNotes] = useState<RoomNoteRecord[]>([]);

  // Room Name Editing (Creator only)
  const [isEditingRoomName, setIsEditingRoomName] = useState(false);
  const [editingRoomNameInput, setEditingRoomNameInput] = useState('');
  const [savingRoomName, setSavingRoomName] = useState(false);

  // Members Management (Creator only)
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [removingMemberEmail, setRemovingMemberEmail] = useState<string | null>(null);

  // Selected Folder State
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);

  // Course / Section View Tab: 'master' | 'weeks' | 'notes'
  const [activeCourseTab, setActiveCourseTab] = useState<'master' | 'weeks' | 'notes'>('master');

  // Course Syllabus (Home Page of Teóricas) State
  const [showSyllabusModal, setShowSyllabusModal] = useState(false);
  const [syllabusSourceText, setSyllabusSourceText] = useState('');
  const [isGeneratingSyllabus, setIsGeneratingSyllabus] = useState(false);

  // Target Week for Ingestion (Optional override or detected)
  const [targetWeekSelection, setTargetWeekSelection] = useState('');

  // Project Folder View Tab: 'log' | 'master' | 'analysis' | 'notes'
  const [activeProjectTab, setActiveProjectTab] = useState<'log' | 'master' | 'analysis' | 'notes'>('log');

  // Master Summary State (Living summary based on imported notes, interactive auto-save)
  const [masterSummary, setMasterSummary] = useState<MasterSummaryRecord | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [regeneratingSummary, setRegeneratingSummary] = useState(false);
  const [viewFormattedMasterNote, setViewFormattedMasterNote] = useState(false);
  const [masterNoteDraft, setMasterNoteDraft] = useState('');
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'unsaved' | 'saving' | 'saved' | 'error'>('idle');
  const [deletingMasterNote, setDeletingMasterNote] = useState(false);
  const lastSavedContentRef = useRef<string>('');

  const formattedMasterSummaryHtml = useMemo(() => {
    const raw = masterNoteDraft || masterSummary?.content_markdown || '';
    if (!raw) return '';
    return renderMarkdown(raw);
  }, [masterNoteDraft, masterSummary?.content_markdown]);

  // Project Log State (Shared collaborative Markdown scratchpad / chat log)
  const [projectLog, setProjectLog] = useState<RoomProjectLogRecord | null>(null);
  const [loadingProjectLog, setLoadingProjectLog] = useState(false);
  const [projectChatMessage, setProjectChatMessage] = useState('');
  const [sendingChatMessage, setSendingChatMessage] = useState(false);
  const [isEditingFullLog, setIsEditingFullLog] = useState(false);
  const [fullLogDraft, setFullLogDraft] = useState('');
  const [savingFullLog, setSavingFullLog] = useState(false);

  // Project AI Guidelines & Checklist State
  const [projectGuidelines, setProjectGuidelines] = useState<string>('');
  const formattedGuidelinesHtml = useMemo(() => renderMarkdown(projectGuidelines), [projectGuidelines]);
  const [showAnalysisForm, setShowAnalysisForm] = useState(false);
  const [projectGuidelinePrompt, setProjectGuidelinePrompt] = useState('');
  const [isAnalyzingGuidelines, setIsAnalyzingGuidelines] = useState(false);
  const [copiedAnalysis, setCopiedAnalysis] = useState(false);

  // Import Modal State (Personal Notes & Direct Markdown)
  const [showImportModal, setShowImportModal] = useState(false);
  const [importModalTab, setImportModalTab] = useState<'history' | 'paste'>('history');
  const [personalNotes, setPersonalNotes] = useState<PersonalNoteRecord[]>([]);
  const [loadingPersonalNotes, setLoadingPersonalNotes] = useState(false);
  const [importingNoteId, setImportingNoteId] = useState<string | null>(null);

  // Direct Markdown Paste in Import Modal
  const [directNoteTitle, setDirectNoteTitle] = useState('');
  const [directNoteContent, setDirectNoteContent] = useState('');
  const [isImportingDirectNote, setIsImportingDirectNote] = useState(false);

  // Subfolder Creation Modal State
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [createParentFolder, setCreateParentFolder] = useState<RoomFolderRecord | null>(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderType, setNewFolderType] = useState<'project' | 'section'>('project');
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);

  // Folder Renaming Modal State
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<RoomFolderRecord | null>(null);
  const [renamingFolderName, setRenamingFolderName] = useState('');
  const [isRenamingFolder, setIsRenamingFolder] = useState(false);

  // Note View Modal State
  const [previewNote, setPreviewNote] = useState<RoomNoteRecord | null>(null);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [copiedMaster, setCopiedMaster] = useState(false);
  const [copiedNote, setCopiedNote] = useState(false);
  const [copiedProjectLog, setCopiedProjectLog] = useState(false);

  // Folder tree toggle states
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // 1. Load preferences (Language, Sidebar Width, and Folder Tree State)
  useEffect(() => {
    const savedLang = localStorage.getItem('synapse_language');
    if (savedLang === 'en' || savedLang === 'pt') {
      setOutputLanguage(savedLang);
    }
    const savedWidth = localStorage.getItem('synapse_sidebar_width');
    if (savedWidth) {
      const parsed = parseInt(savedWidth, 10);
      if (!isNaN(parsed) && parsed >= 220 && parsed <= 650) {
        setSidebarWidth(parsed);
      }
    }
    try {
      const savedFolders = localStorage.getItem(`synapse_room_${roomId}_expanded_folders`);
      if (savedFolders) {
        setExpandedFolders(JSON.parse(savedFolders));
      }
      const savedCourseTab = localStorage.getItem(`synapse_room_${roomId}_course_tab`);
      if (savedCourseTab && ['master', 'weeks', 'notes'].includes(savedCourseTab)) {
        setActiveCourseTab(savedCourseTab as any);
      }
      const savedProjTab = localStorage.getItem(`synapse_room_${roomId}_project_tab`);
      if (savedProjTab && ['log', 'master', 'analysis', 'notes'].includes(savedProjTab)) {
        setActiveProjectTab(savedProjTab as any);
      }
    } catch {
      // ignore parse error
    }
  }, [roomId]);

  const handleSetLanguage = (lang: 'pt' | 'en') => {
    setOutputLanguage(lang);
    localStorage.setItem('synapse_language', lang);
  };

  // 2. Drag-to-resize sidebar logic
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar) return;
      const newWidth = Math.min(Math.max(e.clientX, 220), 650);
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (isResizingSidebar) {
        setIsResizingSidebar(false);
        localStorage.setItem('synapse_sidebar_width', String(sidebarWidth));
      }
    };

    if (isResizingSidebar) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingSidebar, sidebarWidth]);

  // 3. Auth & Initial Load
  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setCurrentUser({ email: user.email });
      });
    } catch {
      // ignore
    }
  }, []);

  const loadRoomData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}`);
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(
          errJson.error ||
            (outputLanguage === 'pt' ? 'Acesso negado a esta sala.' : 'Access denied to this study room.')
        );
      }
      const data = await res.json();
      setRoom(data.room);
      setMembers(data.members || []);

      // In-memory deduplication of folders to guarantee clean tree even if duplicate entries exist in DB
      const seenFolderKeys = new Set<string>();
      const dedupedFolders = (data.folders || []).filter((f: RoomFolderRecord) => {
        const key = `${f.parent_id || 'root'}_${f.name.trim().toLowerCase()}`;
        if (seenFolderKeys.has(key)) return false;
        seenFolderKeys.add(key);
        return true;
      });

      setFolders(dedupedFolders);
      setNotes(data.notes || []);

      // Maintain user's persisted expand/collapse state across reloads, default unseen folders to true
      let savedExpandedMap: Record<string, boolean> = {};
      try {
        const saved = localStorage.getItem(`synapse_room_${roomId}_expanded_folders`);
        if (saved) {
          savedExpandedMap = JSON.parse(saved);
        }
      } catch {
        // ignore parse error
      }

      const expandMap: Record<string, boolean> = { ...savedExpandedMap };
      dedupedFolders.forEach((f: RoomFolderRecord) => {
        if (expandMap[f.id] === undefined) {
          expandMap[f.id] = true;
        }
      });
      setExpandedFolders(expandMap);

      // Restore previously selected folder or default to first section/course
      let targetFolderId: string | null = null;
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const fromUrl = urlParams.get('folder');
        const fromStorage = localStorage.getItem(`synapse_room_${roomId}_selected_folder_id`);
        const candidate = fromUrl || fromStorage;
        if (candidate && dedupedFolders.some((f: RoomFolderRecord) => f.id === candidate)) {
          targetFolderId = candidate;
        }
      } catch {
        // ignore
      }

      if (targetFolderId) {
        setSelectedFolderId(targetFolderId);
        // Ensure all ancestor folders of target folder are expanded in tree
        let curr = dedupedFolders.find((f: RoomFolderRecord) => f.id === targetFolderId);
        let updatedExpand = false;
        while (curr && curr.parent_id) {
          if (!expandMap[curr.parent_id]) {
            expandMap[curr.parent_id] = true;
            updatedExpand = true;
          }
          curr = dedupedFolders.find((f: RoomFolderRecord) => f.id === curr?.parent_id);
        }
        if (updatedExpand) {
          setExpandedFolders({ ...expandMap });
          try {
            localStorage.setItem(`synapse_room_${roomId}_expanded_folders`, JSON.stringify(expandMap));
          } catch {}
        }
      } else if (!selectedFolderId && dedupedFolders.length) {
        const firstSection = dedupedFolders.find((f: RoomFolderRecord) => f.folder_type === 'section');
        const firstCourse = dedupedFolders.find((f: RoomFolderRecord) => f.folder_type === 'course');
        if (firstSection) setSelectedFolderId(firstSection.id);
        else if (firstCourse) setSelectedFolderId(firstCourse.id);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Falha ao carregar detalhes da sala.'
          : 'Failed to load room details.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRoomData();
  }, [roomId]);

  // Is current user room creator / owner?
  const isOwner = useMemo(() => {
    if (!room) return false;
    if (room.role === 'owner') return true;
    if (currentUser?.email && room.owner_email) {
      return currentUser.email.trim().toLowerCase() === room.owner_email.trim().toLowerCase();
    }
    return false;
  }, [room, currentUser]);

  // Active folder details
  const activeFolder = useMemo(() => {
    return folders.find((f) => f.id === selectedFolderId);
  }, [folders, selectedFolderId]);

  // Notes in active folder
  const activeFolderNotes = useMemo(() => {
    if (!selectedFolderId) return [];
    return notes.filter((n) => n.folder_id === selectedFolderId);
  }, [notes, selectedFolderId]);

  const isProjectFolder = activeFolder?.folder_type === 'project';

  // Parent folder of active folder
  const parentFolder = useMemo(() => {
    if (!activeFolder?.parent_id) return null;
    return folders.find((f) => f.id === activeFolder.parent_id) || null;
  }, [folders, activeFolder]);

  // Find ancestor course folder
  const activeCourseAncestor = useMemo(() => {
    if (!activeFolder) return null;
    let curr: RoomFolderRecord | undefined = activeFolder;
    while (curr) {
      if (curr.folder_type === 'course') return curr;
      curr = folders.find((f) => f.id === curr?.parent_id);
    }
    return null;
  }, [activeFolder, folders]);

  // Is this the Teóricas root folder of a course?
  const isTeoricasRoot = useMemo(() => {
    return Boolean(
      activeFolder &&
      activeFolder.folder_type === 'section' &&
      activeFolder.name.trim().toLowerCase() === 'teóricas'
    );
  }, [activeFolder]);

  // Is this a weekly subfolder under Teóricas?
  const isWeekFolder = useMemo(() => {
    return Boolean(
      parentFolder &&
      parentFolder.folder_type === 'section' &&
      parentFolder.name.trim().toLowerCase() === 'teóricas'
    );
  }, [parentFolder]);

  // Weekly subfolders under Teóricas
  const teoricasWeekSubfolders = useMemo(() => {
    if (!isTeoricasRoot || !activeFolder) return [];
    return folders
      .filter((f) => f.parent_id === activeFolder.id)
      .sort((a, b) => {
        const numA = parseInt(a.name.replace(/\D/g, ''), 10) || 0;
        const numB = parseInt(b.name.replace(/\D/g, ''), 10) || 0;
        if (numA && numB) return numA - numB;
        return a.name.localeCompare(b.name, undefined, { numeric: true });
      });
  }, [isTeoricasRoot, activeFolder, folders]);

  // Total notes in Teóricas (active folder notes + all child week folders)
  const allTeoricasNotes = useMemo(() => {
    if (!isTeoricasRoot || !activeFolder) return activeFolderNotes;
    const weekIds = new Set(teoricasWeekSubfolders.map((w) => w.id));
    weekIds.add(activeFolder.id);
    return notes.filter((n) => weekIds.has(n.folder_id));
  }, [isTeoricasRoot, activeFolder, teoricasWeekSubfolders, notes, activeFolderNotes]);

  // 4. Fetch Master Summary whenever selected folder changes
  useEffect(() => {
    const selected = folders.find((f) => f.id === selectedFolderId);

    // Check if selected folder or any ancestor is within Teóricas / week lecture context
    let inAcademicBranch = false;
    let currFolder: RoomFolderRecord | undefined = selected;
    while (currFolder) {
      const name = currFolder.name.trim().toLowerCase();
      if (name === 'teóricas' || name.startsWith('semana') || name.startsWith('aula')) {
        inAcademicBranch = true;
        break;
      }
      currFolder = folders.find((f) => f.id === currFolder?.parent_id);
    }

    // Default to visualizer mode if in academic branch (Semana, or subfolders like questionnaires inside a week)
    setViewFormattedMasterNote(inAcademicBranch);
    setAutoSaveStatus('idle');
    if (!selectedFolderId) {
      setMasterSummary(null);
      setMasterNoteDraft('');
      lastSavedContentRef.current = '';
      return;
    }

    const fetchSummary = async () => {
      setLoadingSummary(true);
      try {
        const res = await fetch(`/api/rooms/${roomId}/master-summary?folderId=${selectedFolderId}`);
        if (res.ok) {
          const data = await res.json();
          setMasterSummary(data.summary || null);
          setMasterNoteDraft(data.summary?.content_markdown || '');
          lastSavedContentRef.current = data.summary?.content_markdown || '';
        } else {
          setMasterSummary(null);
          setMasterNoteDraft('');
          lastSavedContentRef.current = '';
        }
      } catch {
        // non-blocking
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [roomId, selectedFolderId, folders]);

  // 4b. Sync selectedFolderId to localStorage and URL search params
  useEffect(() => {
    if (!selectedFolderId) return;
    try {
      localStorage.setItem(`synapse_room_${roomId}_selected_folder_id`, selectedFolderId);
      const url = new URL(window.location.href);
      if (url.searchParams.get('folder') !== selectedFolderId) {
        url.searchParams.set('folder', selectedFolderId);
        window.history.replaceState(null, '', url.toString());
      }
    } catch {}
  }, [roomId, selectedFolderId]);

  // 4c. Sync activeCourseTab to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`synapse_room_${roomId}_course_tab`, activeCourseTab);
    } catch {}
  }, [roomId, activeCourseTab]);

  // 4d. Sync activeProjectTab to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`synapse_room_${roomId}_project_tab`, activeProjectTab);
    } catch {}
  }, [roomId, activeProjectTab]);

  // 5. Fetch Project Log and Guidelines when a project folder is selected
  useEffect(() => {
    if (!selectedFolderId || !isProjectFolder) {
      setProjectLog(null);
      setProjectGuidelines('');
      return;
    }

    const fetchProjectData = async () => {
      setLoadingProjectLog(true);
      try {
        const [logRes, analysisRes] = await Promise.all([
          fetch(`/api/rooms/${roomId}/project-log?folderId=${selectedFolderId}`),
          fetch(`/api/rooms/${roomId}/project-analysis?folderId=${selectedFolderId}`),
        ]);

        if (logRes.ok) {
          const data = await logRes.json();
          setProjectLog(data.log || null);
          setFullLogDraft(data.log?.content_markdown || '');
          if (data.log?.guidelines_markdown) {
            setProjectGuidelines(data.log.guidelines_markdown);
            setShowAnalysisForm(false);
          }
        }

        if (analysisRes.ok) {
          const aData = await analysisRes.json();
          if (aData.guidelines) {
            setProjectGuidelines(aData.guidelines);
            setShowAnalysisForm(false);
          }
        }
      } catch {
        // non-blocking
      } finally {
        setLoadingProjectLog(false);
      }
    };

    fetchProjectData();
  }, [roomId, selectedFolderId, isProjectFolder]);

  // 6. Open Import Modal & load personal notes
  const handleOpenImportModal = async () => {
    setShowImportModal(true);
    setLoadingPersonalNotes(true);
    setTargetWeekSelection('');
    try {
      const res = await fetch('/api/notes/personal');
      if (res.ok) {
        const data = await res.json();
        setPersonalNotes(data.notes || []);
      }
    } catch {
      // non-blocking
    } finally {
      setLoadingPersonalNotes(false);
    }
  };

  // 7. Import a personal note into active folder
  const handleImportPersonalNote = async (pNote: PersonalNoteRecord) => {
    if (!selectedFolderId) return;
    setImportingNoteId(pNote.id);

    const resolvedWeek =
      targetWeekSelection.trim() ||
      (isTeoricasRoot && pNote.title ? detectWeekFromTitle(pNote.title) : undefined);

    try {
      const res = await fetch(`/api/rooms/${roomId}/import-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedFolderId,
          sourceNoteId: pNote.id,
          title: pNote.title,
          contentMarkdown: pNote.content_markdown,
          targetWeek: resolvedWeek || undefined,
          triggerMasterUpdate: true,
          outputLanguage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || (outputLanguage === 'pt' ? 'Falha ao importar nota.' : 'Failed to import note.')
        );
      }

      await loadRoomData();
      if (data.targetFolderId && data.targetFolderId !== selectedFolderId) {
        setSelectedFolderId(data.targetFolderId);
      } else if (data.masterSummary) {
        setMasterSummary(data.masterSummary);
        setMasterNoteDraft(data.masterSummary.content_markdown || '');
        lastSavedContentRef.current = data.masterSummary.content_markdown || '';
        setAutoSaveStatus('idle');
      }

      setShowImportModal(false);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Erro ao importar nota para a sala.'
          : 'Error importing note to study room.'
      );
    } finally {
      setImportingNoteId(null);
    }
  };

  // 8. Direct Markdown Import into active folder
  const handleImportDirectMarkdown = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolderId || !directNoteTitle.trim() || !directNoteContent.trim()) return;

    setIsImportingDirectNote(true);
    const resolvedWeek =
      targetWeekSelection.trim() ||
      (isTeoricasRoot ? detectWeekFromTitle(directNoteTitle) : undefined);

    try {
      const res = await fetch(`/api/rooms/${roomId}/import-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedFolderId,
          title: directNoteTitle.trim(),
          contentMarkdown: directNoteContent.trim(),
          targetWeek: resolvedWeek || undefined,
          triggerMasterUpdate: true,
          outputLanguage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            (outputLanguage === 'pt' ? 'Falha ao importar markdown.' : 'Failed to import markdown.')
        );
      }

      await loadRoomData();
      if (data.targetFolderId && data.targetFolderId !== selectedFolderId) {
        setSelectedFolderId(data.targetFolderId);
      } else if (data.masterSummary) {
        setMasterSummary(data.masterSummary);
        setMasterNoteDraft(data.masterSummary.content_markdown || '');
        lastSavedContentRef.current = data.masterSummary.content_markdown || '';
        setAutoSaveStatus('idle');
      }

      setDirectNoteTitle('');
      setDirectNoteContent('');
      setTargetWeekSelection('');
      setShowImportModal(false);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Erro ao importar markdown para a sala.'
          : 'Error importing markdown to study room.'
      );
    } finally {
      setIsImportingDirectNote(false);
    }
  };

  // 8b. Generate Course Syllabus for Teóricas Home Page
  const handleGenerateSyllabus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolderId || !syllabusSourceText.trim()) return;

    setIsGeneratingSyllabus(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/course-syllabus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedFolderId,
          sourceText: syllabusSourceText.trim(),
          outputLanguage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to generate course syllabus.');
      }

      setMasterSummary(data.summary);
      setMasterNoteDraft(data.summary?.content_markdown || '');
      lastSavedContentRef.current = data.summary?.content_markdown || '';
      setAutoSaveStatus('idle');
      setShowSyllabusModal(false);
      setSyllabusSourceText('');
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Erro ao gerar syllabus com IA.'
          : 'Failed to generate course syllabus with AI.'
      );
    } finally {
      setIsGeneratingSyllabus(false);
    }
  };

  // 8c. Quick Add Week subfolder under Teóricas
  const handleQuickAddWeek = (weekName?: string) => {
    if (!activeFolder) return;
    const targetParent = isTeoricasRoot ? activeFolder : (parentFolder || activeFolder);
    const existingWeeks = folders.filter((f) => f.parent_id === targetParent.id);
    const nextNum = existingWeeks.length + 1;
    setCreateParentFolder(targetParent);
    setNewFolderName(weekName || (outputLanguage === 'pt' ? `Semana ${nextNum}` : `Week ${nextNum}`));
    setNewFolderType('section');
    setShowCreateFolderModal(true);
  };

  // 9. Regenerate Master Summary with IA
  const handleRegenerateSummary = async () => {
    if (!selectedFolderId) return;
    setRegeneratingSummary(true);

    try {
      const res = await fetch(`/api/rooms/${roomId}/master-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedFolderId,
          outputLanguage: outputLanguage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error ||
            (outputLanguage === 'pt'
              ? 'Falha na regeneração da síntese.'
              : 'Failed to regenerate master synthesis.')
        );
      }
      setMasterSummary(data.summary);
      setMasterNoteDraft(data.summary?.content_markdown || '');
      lastSavedContentRef.current = data.summary?.content_markdown || '';
      setAutoSaveStatus('idle');
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Falha ao regenerar Master Note.'
          : 'Failed to regenerate Master Note.'
      );
    } finally {
      setRegeneratingSummary(false);
    }
  };

  // 9d. Perform Auto-Save for Master Note
  const performAutoSave = async (contentToSave: string) => {
    if (!selectedFolderId || contentToSave === lastSavedContentRef.current) return;
    setAutoSaveStatus('saving');
    try {
      const res = await fetch(`/api/rooms/${roomId}/master-summary`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedFolderId,
          contentMarkdown: contentToSave,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to auto-save');
      }

      lastSavedContentRef.current = contentToSave;
      setMasterSummary((prev) =>
        prev
          ? {
              ...prev,
              content_markdown: contentToSave,
              last_updated_at: data.summary?.last_updated_at || new Date().toISOString(),
            }
          : data.summary
      );
      setAutoSaveStatus('saved');
    } catch (err) {
      console.error('Auto-save error:', err);
      setAutoSaveStatus('error');
    }
  };

  // Debounced auto-save effect (1000ms delay)
  useEffect(() => {
    if (!selectedFolderId) return;
    if (masterNoteDraft === lastSavedContentRef.current) return;

    setAutoSaveStatus('unsaved');
    const timer = setTimeout(() => {
      performAutoSave(masterNoteDraft);
    }, 1000);

    return () => clearTimeout(timer);
  }, [masterNoteDraft, selectedFolderId]);

  // Create blank master note directly
  const handleCreateBlankMasterNote = async () => {
    if (!selectedFolderId) return;
    const initialText = `# ${activeFolder?.name || 'Master Note'}\n\n`;
    setMasterNoteDraft(initialText);
    await performAutoSave(initialText);
  };

  // 9e. Delete Master Note
  const handleDeleteMasterSummary = async () => {
    if (!selectedFolderId || (!masterSummary && !masterNoteDraft)) return;

    const confirmMsg =
      outputLanguage === 'pt'
        ? 'Tens a certeza que queres apagar esta Master Note? Esta ação remove a síntese permanentemente.'
        : 'Are you sure you want to delete this Master Note? This action permanently removes the synthesis.';

    if (!window.confirm(confirmMsg)) return;

    setDeletingMasterNote(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/master-summary?folderId=${selectedFolderId}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete master note.');
      }

      setMasterSummary(null);
      setMasterNoteDraft('');
      lastSavedContentRef.current = '';
      setAutoSaveStatus('idle');
      setViewFormattedMasterNote(false);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Erro ao apagar Master Note.'
          : 'Failed to delete master note.'
      );
    } finally {
      setDeletingMasterNote(false);
    }
  };

  // Delete Individual Room Note (Owner or Author only)
  const handleDeleteNote = async (note: RoomNoteRecord) => {
    const confirmMsg =
      outputLanguage === 'pt'
        ? `Tens a certeza que desejas apagar a aula "${note.title}"?`
        : `Are you sure you want to delete lecture "${note.title}"?`;

    if (!window.confirm(confirmMsg)) return;

    setDeletingNoteId(note.id);
    try {
      const res = await fetch(`/api/rooms/${roomId}/import-note?noteId=${note.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete lecture.');
      }

      setNotes((prev) => prev.filter((n) => n.id !== note.id));
      if (previewNote?.id === note.id) {
        setPreviewNote(null);
      }
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Erro ao apagar a aula.'
          : 'Failed to delete lecture.'
      );
    } finally {
      setDeletingNoteId(null);
    }
  };

  // 10. Project Log: Send chat message / log entry
  const handleSendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = projectChatMessage.trim();
    if (!trimmed || !selectedFolderId) return;

    setSendingChatMessage(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/project-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedFolderId,
          message: trimmed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to send log message.');
      }

      setProjectLog(data.log);
      setFullLogDraft(data.log?.content_markdown || '');
      setProjectChatMessage('');
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Erro ao registar mensagem no log.'
          : 'Failed to post entry to project log.'
      );
    } finally {
      setSendingChatMessage(false);
    }
  };

  // 11. Project Log: Save full raw markdown edit
  const handleSaveFullLog = async () => {
    if (!selectedFolderId) return;

    setSavingFullLog(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/project-log`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedFolderId,
          contentMarkdown: fullLogDraft,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to save project markdown.');
      }

      setProjectLog(data.log);
      setIsEditingFullLog(false);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Erro ao guardar markdown do projeto.'
          : 'Failed to save project markdown.'
      );
    } finally {
      setSavingFullLog(false);
    }
  };

  // 12. Project Guidelines Analysis (IA)
  const handleAnalyzeProjectGuidelines = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFolderId || !projectGuidelinePrompt.trim()) return;

    setIsAnalyzingGuidelines(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/project-analysis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedFolderId,
          sourceText: projectGuidelinePrompt.trim(),
          projectName: activeFolder?.name || 'Projeto',
          courseCode: activeFolder?.course_code,
          outputLanguage,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to analyze guidelines.');
      }

      setProjectGuidelines(data.guidelines || '');
      setShowAnalysisForm(false);
      setProjectGuidelinePrompt('');
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Erro ao analisar guião de projeto.'
          : 'Failed to analyze project guidelines.'
      );
    } finally {
      setIsAnalyzingGuidelines(false);
    }
  };

  // 13. Folder Management: Create Subfolder
  const handleOpenCreateSubfolder = (parent: RoomFolderRecord) => {
    setCreateParentFolder(parent);
    setNewFolderName('');
    setNewFolderType('project');
    setShowCreateFolderModal(true);
  };

  const handleCreateSubfolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newFolderName.trim();
    if (!trimmed || !createParentFolder) return;

    setIsCreatingFolder(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/folders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentId: createParentFolder.id,
          name: trimmed,
          folderType: newFolderType,
          courseCode: createParentFolder.course_code,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to create subfolder.');
      }

      setFolders((prev) => [...prev, data.folder]);
      setExpandedFolders((prev) => {
        const updated = { ...prev, [createParentFolder.id]: true };
        try {
          localStorage.setItem(`synapse_room_${roomId}_expanded_folders`, JSON.stringify(updated));
        } catch {
          // ignore
        }
        return updated;
      });
      setSelectedFolderId(data.folder.id);
      setShowCreateFolderModal(false);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Erro ao criar subpasta.'
          : 'Failed to create subfolder.'
      );
    } finally {
      setIsCreatingFolder(false);
    }
  };

  // 14. Folder Management: Rename Folder
  const handleStartRenameFolder = (f: RoomFolderRecord) => {
    setRenamingFolder(f);
    setRenamingFolderName(f.name);
    setShowRenameModal(true);
  };

  const handleRenameFolderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = renamingFolderName.trim();
    if (!trimmed || !renamingFolder) return;

    setIsRenamingFolder(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/folders`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: renamingFolder.id,
          name: trimmed,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to rename folder.');
      }

      setFolders((prev) =>
        prev.map((f) => (f.id === renamingFolder.id ? { ...f, name: trimmed } : f))
      );
      setShowRenameModal(false);
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Erro ao renomear pasta.'
          : 'Failed to rename folder.'
      );
    } finally {
      setIsRenamingFolder(false);
    }
  };

  // 15. Folder Management: Delete Folder
  const handleDeleteFolder = async (f: RoomFolderRecord) => {
    const confirmMsg =
      outputLanguage === 'pt'
        ? `Tens a certeza que queres eliminar a pasta "${f.name}" e todo o seu conteúdo?`
        : `Are you sure you want to delete folder "${f.name}" and all its contents?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/rooms/${roomId}/folders?folderId=${f.id}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to delete folder.');
      }

      setFolders((prev) => prev.filter((item) => item.id !== f.id && item.parent_id !== f.id));
      if (selectedFolderId === f.id) {
        setSelectedFolderId(f.parent_id || null);
      }
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Erro ao eliminar pasta.'
          : 'Failed to delete folder.'
      );
    }
  };

  // Copy Master
  const handleCopyMaster = () => {
    const text = masterNoteDraft || masterSummary?.content_markdown;
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedMaster(true);
    setTimeout(() => setCopiedMaster(false), 2000);
  };

  // Download Master
  const handleDownloadMaster = () => {
    const text = masterNoteDraft || masterSummary?.content_markdown;
    if (!text || !activeFolder) return;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${activeFolder.course_code || 'Project'}_${activeFolder.name.replace(/[^a-z0-9]/gi, '_')}_Master.md`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copy Project Log
  const handleCopyProjectLog = () => {
    if (!projectLog?.content_markdown) return;
    navigator.clipboard.writeText(projectLog.content_markdown);
    setCopiedProjectLog(true);
    setTimeout(() => setCopiedProjectLog(false), 2000);
  };

  // Download Project Log
  const handleDownloadProjectLog = () => {
    if (!projectLog?.content_markdown || !activeFolder) return;
    const blob = new Blob([projectLog.content_markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${activeFolder.name.replace(/[^a-z0-9]/gi, '_')}_Log.md`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Copy Project Guidelines
  const handleCopyGuidelines = () => {
    if (!projectGuidelines) return;
    navigator.clipboard.writeText(projectGuidelines);
    setCopiedAnalysis(true);
    setTimeout(() => setCopiedAnalysis(false), 2000);
  };

  // Download Project Guidelines
  const handleDownloadGuidelines = () => {
    if (!projectGuidelines || !activeFolder) return;
    const blob = new Blob([projectGuidelines], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${activeFolder.name.replace(/[^a-z0-9]/gi, '_')}_Checklist_Guiao.md`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Rename Room (Creator only)
  const handleStartEditRoomName = () => {
    if (!room) return;
    setEditingRoomNameInput(room.name);
    setIsEditingRoomName(true);
  };

  const handleSaveRoomName = async () => {
    const trimmed = editingRoomNameInput.trim();
    if (!trimmed || !room) return;

    setSavingRoomName(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });

      if (res.ok) {
        setRoom((prev) => (prev ? { ...prev, name: trimmed } : null));
        setIsEditingRoomName(false);
      } else {
        const data = await res.json();
        alert(
          data.error || (outputLanguage === 'pt' ? 'Erro ao renomear sala.' : 'Failed to rename room.')
        );
      }
    } catch (err) {
      console.error(err);
      alert(outputLanguage === 'pt' ? 'Erro de comunicação ao renomear.' : 'Communication error.');
    } finally {
      setSavingRoomName(false);
    }
  };

  // Add Member (Creator only)
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newMemberEmail.trim().toLowerCase();
    if (!trimmed || !trimmed.includes('@')) return;

    setAddingMember(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });

      const data = await res.json();
      if (res.ok && data.member) {
        setMembers((prev) => [...prev, data.member]);
        setNewMemberEmail('');
        setShowAddMemberModal(false);
      } else {
        alert(
          data.error || (outputLanguage === 'pt' ? 'Erro ao adicionar membro.' : 'Failed to add member.')
        );
      }
    } catch (err) {
      console.error(err);
      alert(outputLanguage === 'pt' ? 'Erro de comunicação.' : 'Communication error.');
    } finally {
      setAddingMember(false);
    }
  };

  // Remove Member (Creator only)
  const handleRemoveMember = async (targetEmail: string) => {
    const confirmMsg =
      outputLanguage === 'pt'
        ? `Tens a certeza que queres remover "${targetEmail}" da sala?`
        : `Are you sure you want to remove "${targetEmail}" from the room?`;

    if (!window.confirm(confirmMsg)) return;

    setRemovingMemberEmail(targetEmail);
    try {
      const res = await fetch(
        `/api/rooms/${roomId}/members?email=${encodeURIComponent(targetEmail)}`,
        { method: 'DELETE' }
      );

      if (res.ok) {
        setMembers((prev) =>
          prev.filter((m) => m.user_email.toLowerCase() !== targetEmail.toLowerCase())
        );
      } else {
        const data = await res.json();
        alert(
          data.error || (outputLanguage === 'pt' ? 'Erro ao remover membro.' : 'Failed to remove member.')
        );
      }
    } catch (err) {
      console.error(err);
      alert(outputLanguage === 'pt' ? 'Erro de comunicação.' : 'Communication error.');
    } finally {
      setRemovingMemberEmail(null);
    }
  };

  // Toggle folder in tree with persistence
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => {
      const currentVal = prev[folderId] ?? true;
      const updated = { ...prev, [folderId]: !currentVal };
      try {
        localStorage.setItem(`synapse_room_${roomId}_expanded_folders`, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  };

  // Top level academic hierarchy
  const yearFolders = folders.filter((f) => f.folder_type === 'year');
  const semesterFolders = folders.filter((f) => f.folder_type === 'semester');
  const courseFolders = folders.filter((f) => f.folder_type === 'course');

  // Recursive renderer for subfolders (sections, projects, subprojects)
  const renderSubfolderTree = (parentId: string, depth = 0) => {
    const childFolders = folders.filter((f) => f.parent_id === parentId);
    if (childFolders.length === 0) return null;

    return (
      <div className={`space-y-0.5 border-l border-slate-800/80 ml-2 ${depth === 0 ? 'pl-2.5' : 'pl-2'}`}>
        {childFolders.map((sub) => {
          const isSelected = selectedFolderId === sub.id;
          const isExpanded = expandedFolders[sub.id] ?? true;
          const subChildren = folders.filter((f) => f.parent_id === sub.id);
          const hasChildren = subChildren.length > 0;
          const noteCount = notes.filter((n) => n.folder_id === sub.id).length;
          const isProj = sub.folder_type === 'project';
          const isSec = sub.folder_type === 'section';

          const canManage =
            isOwner ||
            Boolean(
              currentUser?.email &&
                sub.created_by_email &&
                sub.created_by_email.toLowerCase() === currentUser.email.toLowerCase()
            );

          const isWeek = sub.name.trim().toLowerCase().startsWith('semana') || sub.name.trim().toLowerCase().startsWith('aula');
          const canAddSub = isOwner || isProj || sub.name.trim().toLowerCase() === 'teóricas';

          return (
            <div key={sub.id} className="group/item relative">
              <div
                className={`w-full flex items-center justify-between px-2 py-1 rounded-lg text-left transition-all ${
                  isSelected
                    ? isProj
                      ? 'bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 font-semibold shadow-sm'
                      : 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                }`}
              >
                <div
                  className="flex items-center space-x-1.5 flex-1 min-w-0 cursor-pointer py-0.5"
                  onClick={() => {
                    setSelectedFolderId(sub.id);
                    if (isWeek) {
                      setViewFormattedMasterNote(true);
                    }
                  }}
                >
                  {hasChildren ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFolder(sub.id);
                      }}
                      className="p-0.5 hover:text-white cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-3 h-3 text-slate-400" />
                      ) : (
                        <ChevronRight className="w-3 h-3 text-slate-500" />
                      )}
                    </button>
                  ) : (
                    <span className="w-3" />
                  )}

                  {isProj ? (
                    <Users className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-emerald-400' : 'text-emerald-500/80'}`} />
                  ) : isWeek ? (
                    <Calendar className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-indigo-400' : 'text-amber-400/80'}`} />
                  ) : isSec ? (
                    <Layers className={`w-3.5 h-3.5 flex-shrink-0 ${isSelected ? 'text-indigo-400' : 'text-indigo-500/80'}`} />
                  ) : (
                    <Folder className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  )}

                  <span className="truncate text-xs" title={sub.name}>{sub.name}</span>
                </div>

                <div className="flex items-center space-x-1 flex-shrink-0">
                  {noteCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-slate-800 text-slate-400 font-bold">
                      {noteCount}
                    </span>
                  )}

                  {/* Actions on hover */}
                  <div className="opacity-0 group-hover/item:opacity-100 flex items-center space-x-0.5 transition-opacity">
                    {canAddSub && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenCreateSubfolder(sub);
                        }}
                        title={outputLanguage === 'pt' ? 'Criar subpasta' : 'Create subfolder'}
                        className="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <Plus className="w-2.5 h-2.5" />
                      </button>
                    )}

                    {canManage && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartRenameFolder(sub);
                          }}
                          title={outputLanguage === 'pt' ? 'Renomear pasta' : 'Rename folder'}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Pencil className="w-2.5 h-2.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFolder(sub);
                          }}
                          title={outputLanguage === 'pt' ? 'Eliminar pasta' : 'Delete folder'}
                          className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Recursive deeper subfolders */}
              {isExpanded && renderSubfolderTree(sub.id, depth + 1)}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-40 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/rooms"
            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title={outputLanguage === 'pt' ? 'Voltar às Salas' : 'Back to Rooms'}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-lg shadow-md shadow-indigo-500/20">
              <FolderTree className="w-4 h-4 text-white" />
            </div>
            <div>
              {isEditingRoomName ? (
                <div className="flex items-center space-x-1.5">
                  <input
                    type="text"
                    value={editingRoomNameInput}
                    onChange={(e) => setEditingRoomNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRoomName();
                      if (e.key === 'Escape') setIsEditingRoomName(false);
                    }}
                    autoFocus
                    disabled={savingRoomName}
                    className="bg-slate-900 border border-indigo-500 rounded px-2 py-0.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                  />
                  <button
                    onClick={handleSaveRoomName}
                    disabled={savingRoomName}
                    title={outputLanguage === 'pt' ? 'Guardar' : 'Save'}
                    className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors cursor-pointer"
                  >
                    <Check className="w-3 h-3" />
                  </button>
                  <button
                    onClick={() => setIsEditingRoomName(false)}
                    disabled={savingRoomName}
                    title={outputLanguage === 'pt' ? 'Cancelar' : 'Cancel'}
                    className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded transition-colors cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-sm tracking-tight text-white">
                    {room?.name || (outputLanguage === 'pt' ? 'Sala de Estudo' : 'Study Room')}
                  </span>
                  {isOwner && (
                    <button
                      onClick={handleStartEditRoomName}
                      title={outputLanguage === 'pt' ? 'Editar nome da sala' : 'Edit room name'}
                      className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  )}
                  <span className="px-1.5 py-0.2 text-[10px] uppercase font-mono font-semibold tracking-wider bg-indigo-950 border border-indigo-700 text-indigo-300 rounded">
                    {isOwner
                      ? outputLanguage === 'pt'
                        ? 'Admin'
                        : 'Owner'
                      : outputLanguage === 'pt'
                      ? 'Membro'
                      : 'Member'}
                  </span>
                </div>
              )}
              <p className="text-[11px] text-slate-400 font-mono">
                {activeFolder?.name
                  ? `${outputLanguage === 'pt' ? 'Ativo' : 'Active'}: ${activeFolder.name}`
                  : 'Multiplayer Workspace'}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Language Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
            <button
              onClick={() => handleSetLanguage('pt')}
              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                outputLanguage === 'pt' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              PT
            </button>
            <button
              onClick={() => handleSetLanguage('en')}
              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                outputLanguage === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          <Link
            href="/"
            className="flex items-center space-x-1 px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-mono transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
            <span>{outputLanguage === 'pt' ? 'Abrir Studio' : 'Open Studio'}</span>
          </Link>

          {currentUser?.email && (
            <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="max-w-[130px] truncate">{currentUser.email}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Workspace Grid: Resizable Tree (Left) | Workspace Content (Center) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Resizable Academic Hierarchy Tree */}
        <aside
          style={{ width: `${sidebarWidth}px` }}
          className="relative bg-slate-950 border-r border-slate-800/80 flex flex-col p-4 space-y-4 overflow-y-auto flex-shrink-0 select-text"
        >
          {/* Drag Resizer Bar */}
          <div
            onMouseDown={() => setIsResizingSidebar(true)}
            title={outputLanguage === 'pt' ? 'Arrasta para redimensionar barra' : 'Drag to resize sidebar'}
            className="absolute top-0 right-0 w-2 h-full cursor-col-resize hover:bg-indigo-500/40 active:bg-indigo-500 transition-colors z-20 flex items-center justify-center group select-none"
          >
            <div className="w-[2px] h-8 bg-slate-700 group-hover:bg-indigo-400 rounded-full transition-colors" />
          </div>

          <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800">
            <span className="flex items-center space-x-1.5">
              <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
              <span>{outputLanguage === 'pt' ? 'Pastas da Sala' : 'Room Folders'}</span>
            </span>
            <span className="text-[10px] text-slate-500 font-normal">
              {outputLanguage === 'pt' ? '3º Ano' : 'Year 3'}
            </span>
          </div>

          <div className="space-y-1 font-mono text-xs">
            {yearFolders.map((year) => (
              <div key={year.id} className="space-y-1">
                <button
                  onClick={() => toggleFolder(year.id)}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-slate-300 hover:bg-slate-900 text-left font-bold transition-colors cursor-pointer"
                >
                  <span className="flex items-center space-x-1.5">
                    {(expandedFolders[year.id] ?? true) ? (
                      <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <FolderOpen className="w-4 h-4 text-indigo-400" />
                    <span className="truncate">{year.name}</span>
                  </span>
                </button>

                {(expandedFolders[year.id] ?? true) && (
                  <div className="pl-3 space-y-1 border-l border-slate-800/80 ml-2">
                    {semesterFolders
                      .filter((s) => s.parent_id === year.id)
                      .map((sem) => (
                        <div key={sem.id} className="space-y-1">
                          <button
                            onClick={() => toggleFolder(sem.id)}
                            className="w-full flex items-center justify-between px-2 py-1 rounded text-slate-300 hover:bg-slate-900 text-left font-semibold transition-colors cursor-pointer"
                          >
                            <span className="flex items-center space-x-1.5">
                              {(expandedFolders[sem.id] ?? true) ? (
                                <ChevronDown className="w-3 h-3 text-indigo-400" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-slate-500" />
                              )}
                              <Folder className="w-3.5 h-3.5 text-amber-400" />
                              <span className="truncate">{sem.name}</span>
                            </span>
                          </button>

                          {(expandedFolders[sem.id] ?? true) && (
                            <div className="pl-2 space-y-0.5 border-l border-slate-800/80 ml-2">
                              {courseFolders
                                .filter((c) => c.parent_id === sem.id)
                                .map((course) => {
                                  const isSelected = selectedFolderId === course.id;
                                  const isCourseExpanded = expandedFolders[course.id] ?? true;
                                  const courseSubfolders = folders.filter(
                                    (f) => f.parent_id === course.id
                                  );
                                  const hasSubfolders = courseSubfolders.length > 0;
                                  const noteCount = notes.filter(
                                    (n) => n.folder_id === course.id
                                  ).length;

                                  return (
                                    <div key={course.id} className="group/course space-y-0.5">
                                      <div
                                        className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-all ${
                                          isSelected
                                            ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-semibold'
                                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                                        }`}
                                      >
                                        <div
                                          className="flex items-center space-x-1.5 flex-1 min-w-0 cursor-pointer"
                                          onClick={() => setSelectedFolderId(course.id)}
                                        >
                                          {hasSubfolders ? (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                toggleFolder(course.id);
                                              }}
                                              className="p-0.5 hover:text-white cursor-pointer"
                                            >
                                              {isCourseExpanded ? (
                                                <ChevronDown className="w-3 h-3 text-slate-400" />
                                              ) : (
                                                <ChevronRight className="w-3 h-3 text-slate-500" />
                                              )}
                                            </button>
                                          ) : (
                                            <span className="w-3" />
                                          )}

                                          <BookOpen
                                            className={`w-3.5 h-3.5 flex-shrink-0 ${
                                              isSelected ? 'text-indigo-400' : 'text-slate-500'
                                            }`}
                                          />
                                          <span className="truncate font-semibold" title={course.name}>
                                            {course.course_code || course.name}
                                          </span>
                                        </div>

                                        <div className="flex items-center space-x-1 flex-shrink-0">
                                          {noteCount > 0 && (
                                            <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-slate-800 text-slate-400 font-bold">
                                              {noteCount}
                                            </span>
                                          )}

                                          {/* Action: Add subfolder under course */}
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleOpenCreateSubfolder(course);
                                            }}
                                            title={
                                              outputLanguage === 'pt'
                                                ? 'Criar subpasta (projeto/teórica)'
                                                : 'Create subfolder'
                                            }
                                            className="opacity-0 group-hover/course:opacity-100 p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-800 transition-opacity cursor-pointer"
                                          >
                                            <Plus className="w-3 h-3" />
                                          </button>

                                          {isOwner && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleStartRenameFolder(course);
                                              }}
                                              title={outputLanguage === 'pt' ? 'Renomear cadeira' : 'Rename course'}
                                              className="opacity-0 group-hover/course:opacity-100 p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-opacity cursor-pointer"
                                            >
                                              <Pencil className="w-2.5 h-2.5" />
                                            </button>
                                          )}
                                        </div>
                                      </div>

                                      {/* Subfolders inside this course */}
                                      {isCourseExpanded && renderSubfolderTree(course.id, 0)}
                                    </div>
                                  );
                                })}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Members widget at bottom of sidebar */}
          <div className="mt-auto pt-4 border-t border-slate-800/80 space-y-2.5">
            <div className="flex items-center justify-between text-xs font-mono text-slate-400">
              <span className="flex items-center space-x-1.5 font-bold uppercase tracking-wider">
                <Users className="w-3.5 h-3.5 text-emerald-400" />
                <span>
                  {outputLanguage === 'pt' ? 'Alunos' : 'Members'} ({members.length})
                </span>
              </span>
              {isOwner && (
                <button
                  onClick={() => setShowAddMemberModal(true)}
                  title={outputLanguage === 'pt' ? 'Adicionar colega à sala' : 'Add member to room'}
                  className="flex items-center space-x-1 px-2 py-0.5 bg-indigo-600/30 hover:bg-indigo-600/60 border border-indigo-500/40 text-indigo-300 hover:text-white rounded text-[10px] font-bold transition-colors cursor-pointer"
                >
                  <UserPlus className="w-3 h-3" />
                  <span>{outputLanguage === 'pt' ? '+ Convidar' : '+ Invite'}</span>
                </button>
              )}
            </div>

            <div className="space-y-1.5 font-mono text-[11px] max-h-48 overflow-y-auto pr-1">
              {members.map((m) => {
                const isMemberOwner =
                  m.role === 'owner' ||
                  m.user_email?.toLowerCase() === room?.owner_email?.toLowerCase();
                const isRemoving = removingMemberEmail === m.user_email;

                return (
                  <div
                    key={m.id}
                    className="flex items-center justify-between text-slate-400 bg-slate-900/50 hover:bg-slate-900 px-2 py-1.5 rounded transition-colors gap-1.5"
                  >
                    <span className="truncate max-w-[150px]" title={m.user_email}>
                      {m.user_email}
                    </span>
                    <div className="flex items-center space-x-1 flex-shrink-0">
                      <span className="text-[9px] uppercase font-bold text-slate-500">
                        {isMemberOwner
                          ? outputLanguage === 'pt'
                            ? 'Admin'
                            : 'Owner'
                          : outputLanguage === 'pt'
                          ? 'Aluno'
                          : 'Student'}
                      </span>
                      {isOwner && !isMemberOwner && (
                        <button
                          onClick={() => handleRemoveMember(m.user_email)}
                          disabled={isRemoving}
                          title={outputLanguage === 'pt' ? 'Remover da sala' : 'Remove from room'}
                          className="p-1 text-slate-500 hover:text-rose-400 hover:bg-rose-950/60 rounded transition-colors cursor-pointer"
                        >
                          {isRemoving ? (
                            <RefreshCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <X className="w-3 h-3" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Center Column: Knowledge Base / Project Workspace */}
        <main className="flex-1 flex flex-col bg-slate-950 overflow-hidden">
          {error ? (
            <div className="p-8 text-center space-y-3">
              <div className="inline-flex p-3 bg-rose-950/60 border border-rose-800/40 rounded-2xl text-rose-400">
                <AlertCircle className="w-8 h-8" />
              </div>
              <p className="text-xs text-rose-300">{error}</p>
            </div>
          ) : !activeFolder ? (
            <div className="flex-1 flex items-center justify-center p-8 text-slate-500 font-mono text-xs">
              {outputLanguage === 'pt'
                ? 'Seleciona uma cadeira ou pasta de projeto na barra lateral para começar.'
                : 'Select a course or project folder in the hierarchy to begin.'}
            </div>
          ) : isProjectFolder ? (
            /* ========================================================================= */
            /* PROJECT FOLDER WORKSPACE (QUAD TABS: LOG, MASTER, ANALYSIS, NOTES)       */
            /* ========================================================================= */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Project Header */}
              <div className="border-b border-slate-800 px-6 py-4 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-emerald-950 border border-emerald-700 text-emerald-300 text-xs font-mono font-bold rounded">
                      PROJETO
                    </span>
                    <h2 className="text-base font-bold text-white tracking-tight">{activeFolder.name}</h2>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    {outputLanguage === 'pt'
                      ? 'Espaço de Grupo • Log Colaborativo, Master Note e Checklist de Guião'
                      : 'Group Space • Collaborative Log, Master Note & Guidelines Checklist'}
                  </p>
                </div>

                <div className="flex items-center space-x-3">
                  {/* Quad Tab Switcher for Project */}
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-1 flex items-center space-x-1 text-xs font-mono">
                    <button
                      onClick={() => setActiveProjectTab('log')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        activeProjectTab === 'log'
                          ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Log MD (Sem IA)</span>
                    </button>

                    <button
                      onClick={() => setActiveProjectTab('master')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        activeProjectTab === 'master'
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Master Note (IA)</span>
                    </button>

                    <button
                      onClick={() => setActiveProjectTab('analysis')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        activeProjectTab === 'analysis'
                          ? 'bg-violet-600 text-white shadow-sm shadow-violet-600/20'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <CheckSquare className="w-3.5 h-3.5" />
                      <span>Guião & Checklist</span>
                    </button>

                    <button
                      onClick={() => setActiveProjectTab('notes')}
                      className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        activeProjectTab === 'notes'
                          ? 'bg-slate-700 text-white shadow-sm'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>{outputLanguage === 'pt' ? 'Ficheiros' : 'Files'} ({activeFolderNotes.length})</span>
                    </button>
                  </div>

                  {/* Create nested subfolder in project */}
                  <button
                    onClick={() => handleOpenCreateSubfolder(activeFolder)}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer font-mono"
                    title={outputLanguage === 'pt' ? 'Criar subpasta dentro deste projeto' : 'Create subfolder'}
                  >
                    <Plus className="w-3.5 h-3.5 text-emerald-400" />
                    <span>{outputLanguage === 'pt' ? '+ Subpasta' : '+ Subfolder'}</span>
                  </button>
                </div>
              </div>

              {/* PROJECT TAB 1: LOG DE GRUPO (CHAT MD SEM IA) */}
              {activeProjectTab === 'log' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-6 py-2.5 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center space-x-2 text-slate-400">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      <span>
                        {outputLanguage === 'pt'
                          ? 'Registo colaborativo sincronizado • Sem IA'
                          : 'Synchronized collaborative log • No AI'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={handleCopyProjectLog}
                        disabled={!projectLog?.content_markdown}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 disabled:opacity-40 text-slate-300 hover:text-white rounded text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        {copiedProjectLog ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                        <span>{copiedProjectLog ? (outputLanguage === 'pt' ? 'Copiado!' : 'Copied!') : (outputLanguage === 'pt' ? 'Copiar' : 'Copy')}</span>
                      </button>

                      <button
                        onClick={handleDownloadProjectLog}
                        disabled={!projectLog?.content_markdown}
                        className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 disabled:opacity-40 text-slate-300 hover:text-white rounded text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Download .md</span>
                      </button>

                      <button
                        onClick={() => {
                          setFullLogDraft(projectLog?.content_markdown || '');
                          setIsEditingFullLog(!isEditingFullLog);
                        }}
                        className="px-3 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 border border-emerald-500/50 text-emerald-300 hover:text-white rounded text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{isEditingFullLog ? (outputLanguage === 'pt' ? 'Ver Log' : 'View Mode') : (outputLanguage === 'pt' ? 'Editar MD Completo' : 'Edit Full MD')}</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6 font-mono text-xs">
                    {loadingProjectLog ? (
                      <div className="space-y-3 animate-pulse max-w-4xl mx-auto">
                        <div className="h-6 bg-slate-800 rounded w-1/4" />
                        <div className="h-4 bg-slate-800 rounded w-3/4" />
                        <div className="h-32 bg-slate-800 rounded" />
                      </div>
                    ) : isEditingFullLog ? (
                      <div className="max-w-4xl mx-auto h-full flex flex-col space-y-3">
                        <div className="flex items-center justify-between text-xs text-slate-400">
                          <span>{outputLanguage === 'pt' ? 'Edição direta do ficheiro de log .md:' : 'Direct editing of log .md:'}</span>
                          <span className="text-[10px] text-slate-500 font-mono">{fullLogDraft.length} chars</span>
                        </div>
                        <textarea
                          value={fullLogDraft}
                          onChange={(e) => setFullLogDraft(e.target.value)}
                          className="flex-1 w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-xs font-mono text-slate-200 leading-relaxed focus:outline-none focus:border-emerald-500 resize-none min-h-[350px]"
                        />
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            type="button"
                            onClick={() => setIsEditingFullLog(false)}
                            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg cursor-pointer"
                          >
                            {outputLanguage === 'pt' ? 'Cancelar' : 'Cancel'}
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveFullLog}
                            disabled={savingFullLog}
                            className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer shadow-sm shadow-emerald-600/20"
                          >
                            {savingFullLog && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                            <span>{savingFullLog ? (outputLanguage === 'pt' ? 'A guardar...' : 'Saving...') : (outputLanguage === 'pt' ? 'Guardar Alterações' : 'Save Changes')}</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-4xl mx-auto space-y-4">
                        {projectLog?.content_markdown ? (
                          <div className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-6">
                            <pre className="whitespace-pre-wrap font-mono text-slate-200 text-xs leading-relaxed">
                              {projectLog.content_markdown}
                            </pre>
                          </div>
                        ) : (
                          <div className="bg-slate-900/40 border border-dashed border-slate-800 rounded-xl p-8 text-center space-y-3">
                            <MessageSquare className="w-8 h-8 text-emerald-400 mx-auto" />
                            <h3 className="text-sm font-bold text-white">
                              {outputLanguage === 'pt' ? 'Log do Projeto Vazio' : 'Empty Project Log'}
                            </h3>
                            <p className="text-xs text-slate-400 max-w-md mx-auto">
                              {outputLanguage === 'pt'
                                ? 'Escreve decisões técnicas, atas de reuniões ou notas de progresso no campo abaixo. Qualquer membro do grupo pode colaborar neste ficheiro .md.'
                                : 'Post technical decisions, meeting notes, or progress logs below. All group members collaborate on this single .md file.'}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {!isEditingFullLog && (
                    <form
                      onSubmit={handleSendChatMessage}
                      className="border-t border-slate-800/80 bg-slate-900/60 p-4 px-6 flex items-center space-x-3"
                    >
                      <input
                        type="text"
                        placeholder={
                          outputLanguage === 'pt'
                            ? 'Escreve uma entrada no log (ex: "Definimos arquitetura da API e schemas do banco")...'
                            : 'Write an entry in the log (e.g., "Defined API architecture and DB schemas")...'
                        }
                        value={projectChatMessage}
                        onChange={(e) => setProjectChatMessage(e.target.value)}
                        className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500"
                      />
                      <button
                        type="submit"
                        disabled={sendingChatMessage || !projectChatMessage.trim()}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer shadow-sm shadow-emerald-600/20 font-mono"
                      >
                        {sendingChatMessage ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                        <span>{outputLanguage === 'pt' ? 'Registar' : 'Post'}</span>
                      </button>
                    </form>
                  )}
                </div>
              )}

              {/* PROJECT TAB 2: MASTER NOTE (IA) */}
              {activeProjectTab === 'master' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-6 py-2.5 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center space-x-3 text-slate-400">
                      {masterSummary || masterNoteDraft ? (
                        <>
                          {masterSummary && (
                            <span className="px-1.5 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-700/60 rounded text-[10px] font-bold">
                              v{masterSummary.version}
                            </span>
                          )}
                          <span>
                            {masterSummary
                              ? outputLanguage === 'pt'
                                ? `Baseado em ${masterSummary.sources_count} ficheiro(s) do projeto`
                                : `Based on ${masterSummary.sources_count} project file(s)`
                              : outputLanguage === 'pt'
                              ? 'Nota personalizada'
                              : 'Custom note'}
                          </span>
                          <span>•</span>
                          {/* Live auto-save indicator */}
                          {autoSaveStatus === 'saving' ? (
                            <span className="flex items-center space-x-1 text-amber-400 text-[10px]">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>{outputLanguage === 'pt' ? 'A guardar...' : 'Saving...'}</span>
                            </span>
                          ) : autoSaveStatus === 'saved' ? (
                            <span className="flex items-center space-x-1 text-emerald-400 text-[10px]">
                              <Check className="w-3 h-3" />
                              <span>{outputLanguage === 'pt' ? 'Guardado automaticamente' : 'Auto-saved'}</span>
                            </span>
                          ) : autoSaveStatus === 'unsaved' ? (
                            <span className="flex items-center space-x-1 text-amber-300 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              <span>{outputLanguage === 'pt' ? 'A escrever...' : 'Typing...'}</span>
                            </span>
                          ) : autoSaveStatus === 'error' ? (
                            <span className="flex items-center space-x-1 text-rose-400 text-[10px]">
                              <AlertCircle className="w-3 h-3" />
                              <span>{outputLanguage === 'pt' ? 'Erro ao guardar' : 'Save error'}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">
                              {outputLanguage === 'pt' ? 'Edição interativa ativa' : 'Interactive editor active'}
                            </span>
                          )}
                        </>
                      ) : (
                        <span>
                          {outputLanguage === 'pt'
                            ? 'Nenhuma Master Note gerada ainda para este projeto'
                            : 'No Master Note generated yet for this project'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {(masterSummary || masterNoteDraft) && (
                        <>
                          {/* 1. BOTÃO DE VISUALIZAÇÃO FORMATADA */}
                          <button
                            onClick={() => setViewFormattedMasterNote(!viewFormattedMasterNote)}
                            className={`px-2.5 py-1 border rounded text-xs transition-colors flex items-center space-x-1.5 cursor-pointer font-mono ${
                              viewFormattedMasterNote
                                ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
                                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                            }`}
                            title={
                              viewFormattedMasterNote
                                ? outputLanguage === 'pt'
                                  ? 'Voltar ao modo interativo / editar'
                                  : 'Back to interactive editor'
                                : outputLanguage === 'pt'
                                ? 'Ver Markdown formatado'
                                : 'View formatted Markdown'
                            }
                          >
                            {viewFormattedMasterNote ? (
                              <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 text-indigo-400" />
                            )}
                            <span>
                              {viewFormattedMasterNote
                                ? outputLanguage === 'pt'
                                  ? 'Modo Interativo'
                                  : 'Interactive'
                                : outputLanguage === 'pt'
                                ? 'Visualização'
                                : 'Preview'}
                            </span>
                          </button>

                          {/* 2. BOTÃO DE COPIAR */}
                          <button
                            onClick={handleCopyMaster}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded text-xs transition-colors flex items-center space-x-1.5 cursor-pointer font-mono"
                          >
                            {copiedMaster ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedMaster ? (outputLanguage === 'pt' ? 'Copiado!' : 'Copied!') : (outputLanguage === 'pt' ? 'Copiar' : 'Copy')}</span>
                          </button>

                          {/* 3. DOWNLOAD */}
                          <button
                            onClick={handleDownloadMaster}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded text-xs transition-colors flex items-center space-x-1.5 cursor-pointer font-mono"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download .md</span>
                          </button>

                          {/* 4. APAGAR */}
                          <button
                            onClick={handleDeleteMasterSummary}
                            disabled={deletingMasterNote}
                            title={outputLanguage === 'pt' ? 'Apagar Master Note' : 'Delete Master Note'}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-700/60 text-slate-400 hover:text-rose-300 rounded text-xs transition-colors flex items-center space-x-1.5 cursor-pointer font-mono"
                          >
                            {deletingMasterNote ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            )}
                            <span>{outputLanguage === 'pt' ? 'Apagar' : 'Delete'}</span>
                          </button>
                        </>
                      )}

                      {/* 5. BOTÃO DE AI RESPETIVO */}
                      <button
                        onClick={handleRegenerateSummary}
                        disabled={regeneratingSummary || activeFolderNotes.length === 0}
                        title={
                          activeFolderNotes.length === 0
                            ? outputLanguage === 'pt'
                              ? 'Adiciona pelo menos uma nota ao projeto para gerar o Master Summary'
                              : 'Add at least one note to project to generate master summary'
                            : outputLanguage === 'pt'
                            ? 'Regenerar síntese mestra com IA'
                            : 'Regenerate master synthesis with AI'
                        }
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm font-mono"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${regeneratingSummary ? 'animate-spin' : ''}`} />
                        <span>
                          {regeneratingSummary
                            ? outputLanguage === 'pt'
                              ? 'A regenerar...'
                              : 'Regenerating...'
                            : outputLanguage === 'pt'
                            ? 'Regenerar com IA'
                            : 'Regenerate with AI'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 font-sans">
                    {loadingSummary ? (
                      <div className="space-y-4 animate-pulse max-w-4xl mx-auto">
                        <div className="h-8 bg-slate-800 rounded w-1/3" />
                        <div className="h-4 bg-slate-800 rounded w-2/3" />
                        <div className="h-40 bg-slate-800 rounded" />
                      </div>
                    ) : masterSummary || masterNoteDraft ? (
                      viewFormattedMasterNote ? (
                        <article className="max-w-4xl mx-auto markdown-body">
                          <div
                            dangerouslySetInnerHTML={{ __html: formattedMasterSummaryHtml }}
                          />
                        </article>
                      ) : (
                        <div className="max-w-4xl mx-auto min-h-full flex flex-col">
                          <textarea
                            value={masterNoteDraft}
                            onChange={(e) => setMasterNoteDraft(e.target.value)}
                            onBlur={() => {
                              if (masterNoteDraft !== lastSavedContentRef.current) {
                                performAutoSave(masterNoteDraft);
                              }
                            }}
                            placeholder={
                              outputLanguage === 'pt'
                                ? 'Clica aqui para escrever ou editar as tuas notas em Markdown...'
                                : 'Click here to write or edit your notes in Markdown...'
                            }
                            className="w-full flex-1 min-h-[600px] bg-transparent text-slate-200 font-sans text-sm leading-relaxed resize-none border-0 focus:outline-none focus:ring-0 p-0 placeholder-slate-600 selection:bg-indigo-600/30 whitespace-pre-wrap"
                            spellCheck={false}
                          />
                        </div>
                      )
                    ) : (
                      <div className="max-w-md mx-auto my-12 bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-4">
                        <div className="inline-flex p-3 bg-indigo-950/60 border border-indigo-800/40 rounded-2xl text-indigo-400">
                          <Sparkles className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-white">
                            {outputLanguage === 'pt' ? 'Sem Master Note do Projeto' : 'No Project Master Note'}
                          </h3>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {outputLanguage === 'pt'
                              ? 'Clica em "Adicionar Ficheiro" para importar notas técnicas ou começa a escrever diretamente a Master Note do teu grupo.'
                              : 'Click "Add File" to import notes or start writing your project group Master Note directly.'}
                          </p>
                        </div>
                        <div className="flex items-center justify-center space-x-3 pt-2">
                          <button
                            onClick={handleOpenImportModal}
                            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-md shadow-indigo-600/20 font-mono"
                          >
                            <Plus className="w-4 h-4" />
                            <span>{outputLanguage === 'pt' ? 'Adicionar Ficheiro' : 'Add File'}</span>
                          </button>
                          <button
                            onClick={handleCreateBlankMasterNote}
                            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer font-mono"
                          >
                            <Edit3 className="w-4 h-4 text-indigo-400" />
                            <span>{outputLanguage === 'pt' ? 'Escrever Diretamente' : 'Write Directly'}</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* PROJECT TAB 3: GUIÃO & CHECKLIST (IA) */}
              {activeProjectTab === 'analysis' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-6 py-2.5 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center space-x-2 text-slate-400">
                      <CheckSquare className="w-3.5 h-3.5 text-violet-400" />
                      <span>
                        {projectGuidelines
                          ? outputLanguage === 'pt'
                            ? 'Checklist de Entregas e Requisitos do Projeto'
                            : 'Project Deliverables Checklist & Requirements'
                          : outputLanguage === 'pt'
                          ? 'Nenhum guião analisado ainda'
                          : 'No guidelines analyzed yet'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {projectGuidelines && (
                        <>
                          <button
                            onClick={handleCopyGuidelines}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            {copiedAnalysis ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                            <span>{copiedAnalysis ? (outputLanguage === 'pt' ? 'Copiado!' : 'Copied!') : (outputLanguage === 'pt' ? 'Copiar' : 'Copy')}</span>
                          </button>

                          <button
                            onClick={handleDownloadGuidelines}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download .md</span>
                          </button>
                        </>
                      )}

                      <button
                        onClick={() => setShowAnalysisForm(!showAnalysisForm)}
                        className="px-3 py-1 bg-violet-600 hover:bg-violet-500 text-white rounded text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm shadow-violet-600/20"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>
                          {showAnalysisForm
                            ? outputLanguage === 'pt'
                              ? 'Fechar Formulário'
                              : 'Close Form'
                            : projectGuidelines
                            ? outputLanguage === 'pt'
                              ? 'Re-analisar Guião com IA'
                              : 'Re-analyze Guidelines'
                            : outputLanguage === 'pt'
                            ? 'Analisar Guião com IA'
                            : 'Analyze Guidelines'}
                        </span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    {loadingProjectLog ? (
                      <div className="space-y-4 animate-pulse max-w-4xl mx-auto">
                        <div className="h-8 bg-slate-800 rounded w-1/3" />
                        <div className="h-4 bg-slate-800 rounded w-2/3" />
                        <div className="h-40 bg-slate-800 rounded" />
                      </div>
                    ) : showAnalysisForm || !projectGuidelines ? (
                      <div className="max-w-3xl mx-auto bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-white flex items-center space-x-2">
                            <CheckSquare className="w-4 h-4 text-violet-400" />
                            <span>
                              {outputLanguage === 'pt'
                                ? 'Análise Inteligente de Guião e Checklist de Entregas'
                                : 'Guidelines Analysis & Deliverables Checklist'}
                            </span>
                          </h3>
                          <p className="text-xs text-slate-400 leading-relaxed font-mono">
                            {outputLanguage === 'pt'
                              ? 'Cola o texto do guião/enunciado ou prompts de outras IAs. O Gemini extrairá objetivos, datas de entrega, erros comuns e gerará uma checklist com caixas de seleção (- [ ]).'
                              : 'Paste project specs or prompts from other AIs. Gemini will extract milestones, deadlines, pitfalls, and generate an actionable checklist (- [ ]).'}
                          </p>
                        </div>

                        <form onSubmit={handleAnalyzeProjectGuidelines} className="space-y-4">
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                              {outputLanguage === 'pt'
                                ? 'Texto do Guião / Requisitos / Prompt de IA *'
                                : 'Guideline Text / Specifications / AI Prompt *'}
                            </label>
                            <textarea
                              rows={8}
                              required
                              placeholder={
                                outputLanguage === 'pt'
                                  ? 'Cola aqui as instruções do professor, guião de laboratório ou prompt...'
                                  : 'Paste professor guidelines, lab sheet, or project prompt here...'
                              }
                              value={projectGuidelinePrompt}
                              onChange={(e) => setProjectGuidelinePrompt(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-violet-500 leading-relaxed"
                            />
                          </div>

                          <div className="flex items-center justify-between pt-2">
                            <span className="text-[10px] text-slate-500 font-mono">
                              {projectGuidelinePrompt.length} chars
                            </span>
                            <div className="flex items-center space-x-2">
                              {projectGuidelines && (
                                <button
                                  type="button"
                                  onClick={() => setShowAnalysisForm(false)}
                                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                                >
                                  {outputLanguage === 'pt' ? 'Cancelar' : 'Cancel'}
                                </button>
                              )}
                              <button
                                type="submit"
                                disabled={isAnalyzingGuidelines || !projectGuidelinePrompt.trim()}
                                className="px-4 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl flex items-center space-x-1.5 transition-colors cursor-pointer shadow-md shadow-violet-600/20 font-mono"
                              >
                                {isAnalyzingGuidelines ? (
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckSquare className="w-3.5 h-3.5" />
                                )}
                                <span>
                                  {isAnalyzingGuidelines
                                    ? outputLanguage === 'pt'
                                      ? 'A sintetizar...'
                                      : 'Analyzing...'
                                    : outputLanguage === 'pt'
                                    ? 'Gerar Guião & Checklist com IA'
                                    : 'Generate Guidelines & Checklist'}
                                </span>
                              </button>
                            </div>
                          </div>
                        </form>
                      </div>
                    ) : (
                      <article className="max-w-4xl mx-auto markdown-body">
                        <div dangerouslySetInnerHTML={{ __html: formattedGuidelinesHtml }} />
                      </article>
                    )}
                  </div>
                </div>
              )}

              {/* PROJECT TAB 4: FICHEIROS & APONTAMENTOS */}
              {activeProjectTab === 'notes' && (
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  <div className="flex items-center justify-between max-w-5xl mx-auto">
                    <h3 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                      {outputLanguage === 'pt' ? 'Ficheiros do Projeto' : 'Project Files'} ({activeFolderNotes.length})
                    </h3>
                    <button
                      onClick={handleOpenImportModal}
                      className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-sm shadow-emerald-600/20 font-mono"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{outputLanguage === 'pt' ? 'Adicionar Ficheiro / Nota' : 'Add File / Note'}</span>
                    </button>
                  </div>

                  {activeFolderNotes.length === 0 ? (
                    <div className="max-w-md mx-auto my-12 bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-4">
                      <FileText className="w-8 h-8 text-slate-500 mx-auto" />
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-white">
                          {outputLanguage === 'pt' ? 'Sem ficheiros neste projeto' : 'No files in this project'}
                        </h4>
                        <p className="text-xs text-slate-400">
                          {outputLanguage === 'pt'
                            ? 'Podes associar notas de reuniões ou colar markdown diretamente.'
                            : 'You can link meeting notes or paste raw markdown.'}
                        </p>
                      </div>
                      <button
                        onClick={handleOpenImportModal}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>{outputLanguage === 'pt' ? 'Adicionar Ficheiro' : 'Add File'}</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
                      {activeFolderNotes.map((note) => (
                        <div
                          key={note.id}
                          className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 space-y-3 transition-colors flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                              <span className="flex items-center space-x-1 text-emerald-300">
                                <User className="w-3 h-3" />
                                <span className="truncate max-w-[180px]">{note.author_email}</span>
                              </span>
                              <span>
                                {new Date(note.imported_at).toLocaleDateString(
                                  outputLanguage === 'pt' ? 'pt-PT' : 'en-US'
                                )}
                              </span>
                            </div>
                            <h4 className="text-sm font-bold text-white leading-snug">{note.title}</h4>
                            <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                              {note.content_markdown.replace(/[#*`_\[\]]/g, '').slice(0, 200)}...
                            </p>
                          </div>
                          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                            <span className="text-slate-500 text-[10px]">
                              {note.content_markdown.length.toLocaleString()}{' '}
                              {outputLanguage === 'pt' ? 'caracteres' : 'chars'}
                            </span>
                            <button
                              onClick={() => setPreviewNote(note)}
                              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>{outputLanguage === 'pt' ? 'Ler Ficheiro' : 'Read File'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* ========================================================================= */
            /* COURSE / SECTION WORKSPACE (LIVING MASTER NOTE, SYLLABUS & WEEKS)         */
            /* ========================================================================= */
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Header for Teóricas Root / Week Folder / Regular Course */}
              <div className="border-b border-slate-800 px-6 py-4 bg-slate-900/40 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1.5">
                  {/* Breadcrumbs */}
                  {isWeekFolder ? (
                    <div className="flex items-center space-x-1.5 text-xs font-mono text-slate-400">
                      {activeCourseAncestor && (
                        <>
                          <button
                            onClick={() => setSelectedFolderId(activeCourseAncestor.id)}
                            className="hover:text-white transition-colors cursor-pointer"
                          >
                            {activeCourseAncestor.name}
                          </button>
                          <ChevronRight className="w-3 h-3 text-slate-600" />
                        </>
                      )}
                      {parentFolder && (
                        <>
                          <button
                            onClick={() => setSelectedFolderId(parentFolder.id)}
                            className="hover:text-indigo-300 text-indigo-400 font-semibold transition-colors cursor-pointer flex items-center space-x-1"
                          >
                            <span>Teóricas</span>
                            <span className="text-[10px] text-slate-500 font-normal">
                              ({outputLanguage === 'pt' ? 'Home Page' : 'Home'})
                            </span>
                          </button>
                          <ChevronRight className="w-3 h-3 text-slate-600" />
                        </>
                      )}
                      <span className="text-white font-bold">{activeFolder.name}</span>
                    </div>
                  ) : isTeoricasRoot && activeCourseAncestor ? (
                    <div className="flex items-center space-x-1.5 text-xs font-mono text-slate-400">
                      <button
                        onClick={() => setSelectedFolderId(activeCourseAncestor.id)}
                        className="hover:text-white transition-colors cursor-pointer"
                      >
                        {activeCourseAncestor.name}
                      </button>
                      <ChevronRight className="w-3 h-3 text-slate-600" />
                      <span className="text-indigo-400 font-semibold">Teóricas</span>
                    </div>
                  ) : null}

                  {/* Title & Badge */}
                  <div className="flex items-center space-x-2">
                    <span
                      className={`px-2 py-0.5 border text-xs font-mono font-bold rounded ${
                        isTeoricasRoot
                          ? 'bg-indigo-950 border-indigo-700 text-indigo-300'
                          : isWeekFolder
                          ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                          : 'bg-indigo-950 border-indigo-700 text-indigo-300'
                      }`}
                    >
                      {isTeoricasRoot
                        ? outputLanguage === 'pt'
                          ? 'TEÓRICAS • HOME PAGE'
                          : 'THEORY • HOME PAGE'
                        : isWeekFolder
                        ? outputLanguage === 'pt'
                          ? 'SEMANA TEÓRICA'
                          : 'THEORY WEEK'
                        : activeFolder.course_code || activeFolder.folder_type.toUpperCase()}
                    </span>
                    <h2 className="text-base font-bold text-white tracking-tight">
                      {isTeoricasRoot
                        ? activeCourseAncestor
                          ? `${activeCourseAncestor.name} — Home Page & Syllabus`
                          : `${activeFolder.name} — Home Page & Syllabus`
                        : isWeekFolder
                        ? `${activeFolder.name} — ${
                            outputLanguage === 'pt' ? 'Matéria da Semana' : 'Weekly Content'
                          }`
                        : activeFolder.name}
                    </h2>
                  </div>

                  {/* Subtitle */}
                  <p className="text-xs text-slate-400 font-mono">
                    {isTeoricasRoot
                      ? `${teoricasWeekSubfolders.length} ${
                          outputLanguage === 'pt' ? 'semana(s) no índice' : 'week(s) indexed'
                        } • ${allTeoricasNotes.length} ${
                          outputLanguage === 'pt'
                            ? 'aula(s) lecionadas no total'
                            : 'total lecture(s) imported'
                        }`
                      : isWeekFolder
                      ? `${activeFolderNotes.length} ${
                          outputLanguage === 'pt'
                            ? 'aula(s) lecionada(s) nesta semana'
                            : 'lecture(s) in this week'
                        }`
                      : `${activeFolderNotes.length} ${
                          outputLanguage === 'pt'
                            ? 'aula(s) importada(s) • Base de Conhecimento Colaborativa'
                            : 'lecture(s) imported • Collaborative Knowledge Base'
                        }`}
                  </p>
                </div>

                {/* Header Action Buttons & Tabs */}
                <div className="flex items-center space-x-3">
                  {/* Tabs selector */}
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-1 flex items-center space-x-1 text-xs font-mono">
                    <button
                      onClick={() => setActiveCourseTab('master')}
                      className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        activeCourseTab === 'master'
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {isTeoricasRoot
                          ? outputLanguage === 'pt'
                            ? 'Home Page & Syllabus'
                            : 'Home Page & Syllabus'
                          : isWeekFolder
                          ? outputLanguage === 'pt'
                            ? 'Master Note da Semana'
                            : 'Weekly Master Note'
                          : 'Master Note'}
                      </span>
                    </button>

                    {isTeoricasRoot && (
                      <button
                        onClick={() => setActiveCourseTab('weeks')}
                        className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                          activeCourseTab === 'weeks'
                            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Layers className="w-3.5 h-3.5" />
                        <span>
                          {outputLanguage === 'pt' ? 'Índice de Semanas' : 'Weeks Directory'} (
                          {teoricasWeekSubfolders.length})
                        </span>
                      </button>
                    )}

                    <button
                      onClick={() => setActiveCourseTab('notes')}
                      className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        activeCourseTab === 'notes'
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>
                        {isTeoricasRoot
                          ? outputLanguage === 'pt'
                            ? `Todas as Aulas (${allTeoricasNotes.length})`
                            : `All Lectures (${allTeoricasNotes.length})`
                          : outputLanguage === 'pt'
                          ? `Aulas (${activeFolderNotes.length})`
                          : `Lectures (${activeFolderNotes.length})`}
                      </span>
                    </button>
                  </div>

                  {/* Context-aware action buttons */}
                  {isTeoricasRoot ? (
                    <>
                      <button
                        onClick={() => setShowSyllabusModal(true)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer font-mono"
                        title={
                          outputLanguage === 'pt'
                            ? 'Configurar objetivos, datas de exames e regras da cadeira com IA'
                            : 'Configure course syllabus, exam dates, and rules with AI'
                        }
                      >
                        <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                        <span>
                          {outputLanguage === 'pt' ? 'Configurar Syllabus' : 'Setup Syllabus'}
                        </span>
                      </button>

                      <button
                        onClick={() => handleQuickAddWeek()}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer font-mono"
                        title={outputLanguage === 'pt' ? 'Adicionar nova semana' : 'Add new week'}
                      >
                        <Plus className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{outputLanguage === 'pt' ? '+ Nova Semana' : '+ New Week'}</span>
                      </button>

                      <button
                        onClick={handleOpenImportModal}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-sm shadow-emerald-600/20 font-mono"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{outputLanguage === 'pt' ? 'Importar Aula' : 'Import Lecture'}</span>
                      </button>
                    </>
                  ) : isWeekFolder ? (
                    <>
                      <button
                        onClick={() => parentFolder && setSelectedFolderId(parentFolder.id)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer font-mono"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>{outputLanguage === 'pt' ? 'Home Page' : 'Home Page'}</span>
                      </button>

                      <button
                        onClick={handleOpenImportModal}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-sm shadow-emerald-600/20 font-mono"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{outputLanguage === 'pt' ? 'Importar nesta Semana' : 'Import into Week'}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={handleOpenImportModal}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-sm shadow-emerald-600/20 font-mono"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>{outputLanguage === 'pt' ? 'Importar Aula' : 'Import Lecture'}</span>
                      </button>

                      <button
                        onClick={() => handleOpenCreateSubfolder(activeFolder)}
                        className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer font-mono"
                        title={
                          outputLanguage === 'pt' ? 'Criar subpasta nesta cadeira' : 'Create subfolder'
                        }
                      >
                        <Plus className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{outputLanguage === 'pt' ? '+ Subpasta' : '+ Subfolder'}</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* VIEW 1: MASTER NOTE / SYLLABUS TAB */}
              {activeCourseTab === 'master' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-6 py-2.5 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center space-x-3 text-slate-400">
                      {masterSummary || masterNoteDraft ? (
                        <>
                          {masterSummary && (
                            <span className="px-1.5 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-700/60 rounded text-[10px] font-bold">
                              v{masterSummary.version}
                            </span>
                          )}
                          <span>
                            {masterSummary
                              ? outputLanguage === 'pt'
                                ? `Baseado em ${masterSummary.sources_count} aula(s)/fonte(s)`
                                : `Based on ${masterSummary.sources_count} source(s)`
                              : outputLanguage === 'pt'
                              ? 'Nota personalizada'
                              : 'Custom note'}
                          </span>
                          <span>•</span>
                          {masterSummary && (
                            <>
                              <span className="text-slate-500">
                                {outputLanguage === 'pt' ? 'Atualizado em ' : 'Updated at '}
                                {new Date(masterSummary.last_updated_at).toLocaleTimeString(
                                  outputLanguage === 'pt' ? 'pt-PT' : 'en-US',
                                  { hour: '2-digit', minute: '2-digit' }
                                )}
                              </span>
                              <span>•</span>
                            </>
                          )}
                          {/* Live auto-save indicator */}
                          {autoSaveStatus === 'saving' ? (
                            <span className="flex items-center space-x-1 text-amber-400 text-[10px]">
                              <RefreshCw className="w-3 h-3 animate-spin" />
                              <span>{outputLanguage === 'pt' ? 'A guardar...' : 'Saving...'}</span>
                            </span>
                          ) : autoSaveStatus === 'saved' ? (
                            <span className="flex items-center space-x-1 text-emerald-400 text-[10px]">
                              <Check className="w-3 h-3" />
                              <span>{outputLanguage === 'pt' ? 'Guardado automaticamente' : 'Auto-saved'}</span>
                            </span>
                          ) : autoSaveStatus === 'unsaved' ? (
                            <span className="flex items-center space-x-1 text-amber-300 text-[10px]">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                              <span>{outputLanguage === 'pt' ? 'A escrever...' : 'Typing...'}</span>
                            </span>
                          ) : autoSaveStatus === 'error' ? (
                            <span className="flex items-center space-x-1 text-rose-400 text-[10px]">
                              <AlertCircle className="w-3 h-3" />
                              <span>{outputLanguage === 'pt' ? 'Erro ao guardar' : 'Save error'}</span>
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[10px]">
                              {outputLanguage === 'pt' ? 'Edição interativa ativa' : 'Interactive editor active'}
                            </span>
                          )}
                        </>
                      ) : (
                        <span>
                          {isTeoricasRoot
                            ? outputLanguage === 'pt'
                              ? 'Syllabus Geral da Cadeira ainda não gerado'
                              : 'Course Syllabus not generated yet'
                            : isWeekFolder
                            ? outputLanguage === 'pt'
                              ? `Master Note para ${activeFolder.name} ainda não gerada`
                              : `Master Note for ${activeFolder.name} not generated yet`
                            : outputLanguage === 'pt'
                            ? 'Nenhum Master Summary gerado ainda para esta cadeira'
                            : 'No Master Summary generated yet for this course'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {(masterSummary || masterNoteDraft) && (
                        <>
                          {/* 1. BOTÃO DE VISUALIZAÇÃO FORMATADA */}
                          <button
                            onClick={() => setViewFormattedMasterNote(!viewFormattedMasterNote)}
                            className={`px-2.5 py-1 border rounded text-xs transition-colors flex items-center space-x-1.5 cursor-pointer font-mono ${
                              viewFormattedMasterNote
                                ? 'bg-indigo-950/80 border-indigo-500 text-indigo-200'
                                : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                            }`}
                            title={
                              viewFormattedMasterNote
                                ? outputLanguage === 'pt'
                                  ? 'Voltar ao modo interativo / editar'
                                  : 'Back to interactive editor'
                                : outputLanguage === 'pt'
                                ? 'Ver Markdown formatado'
                                : 'View formatted Markdown'
                            }
                          >
                            {viewFormattedMasterNote ? (
                              <Edit3 className="w-3.5 h-3.5 text-indigo-400" />
                            ) : (
                              <Eye className="w-3.5 h-3.5 text-indigo-400" />
                            )}
                            <span>
                              {viewFormattedMasterNote
                                ? outputLanguage === 'pt'
                                  ? 'Modo Interativo'
                                  : 'Interactive'
                                : outputLanguage === 'pt'
                                ? 'Visualização'
                                : 'Preview'}
                            </span>
                          </button>

                          {/* 2. BOTÃO DE COPIAR */}
                          <button
                            onClick={handleCopyMaster}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded text-xs transition-colors flex items-center space-x-1.5 cursor-pointer font-mono"
                          >
                            {copiedMaster ? (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>
                              {copiedMaster
                                ? outputLanguage === 'pt'
                                  ? 'Copiado!'
                                  : 'Copied!'
                                : outputLanguage === 'pt'
                                ? 'Copiar'
                                : 'Copy'}
                            </span>
                          </button>

                          {/* 3. DOWNLOAD */}
                          <button
                            onClick={handleDownloadMaster}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded text-xs transition-colors flex items-center space-x-1.5 cursor-pointer font-mono"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download .md</span>
                          </button>

                          {/* 4. APAGAR */}
                          <button
                            onClick={handleDeleteMasterSummary}
                            disabled={deletingMasterNote}
                            title={outputLanguage === 'pt' ? 'Apagar Master Note' : 'Delete Master Note'}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-700/60 text-slate-400 hover:text-rose-300 rounded text-xs transition-colors flex items-center space-x-1.5 cursor-pointer font-mono"
                          >
                            {deletingMasterNote ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                            )}
                            <span>{outputLanguage === 'pt' ? 'Apagar' : 'Delete'}</span>
                          </button>
                        </>
                      )}

                      {/* 5. BOTÕES DE AI RESPETIVOS À DESIGNAÇÃO */}
                      {isTeoricasRoot ? (
                        <button
                          onClick={() => setShowSyllabusModal(true)}
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm font-mono"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>
                            {masterSummary || masterNoteDraft
                              ? outputLanguage === 'pt'
                                ? 'Atualizar Syllabus com IA'
                                : 'Update Syllabus with AI'
                              : outputLanguage === 'pt'
                              ? 'Configurar Syllabus com IA'
                              : 'Setup Syllabus with AI'}
                          </span>
                        </button>
                      ) : (
                        <button
                          onClick={handleRegenerateSummary}
                          disabled={regeneratingSummary || activeFolderNotes.length === 0}
                          title={
                            activeFolderNotes.length === 0
                              ? outputLanguage === 'pt'
                                ? 'Importa pelo menos uma aula para gerar o sumário'
                                : 'Import at least one lecture to generate master summary'
                              : outputLanguage === 'pt'
                              ? 'Regenerar síntese mestra com IA'
                              : 'Regenerate master synthesis with AI'
                          }
                          className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm font-mono"
                        >
                          <RefreshCw
                            className={`w-3.5 h-3.5 ${regeneratingSummary ? 'animate-spin' : ''}`}
                          />
                          <span>
                            {regeneratingSummary
                              ? outputLanguage === 'pt'
                                ? 'A regenerar...'
                                : 'Regenerating...'
                              : outputLanguage === 'pt'
                              ? 'Regenerar com IA'
                              : 'Regenerate with AI'}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 font-sans">
                    {loadingSummary ? (
                      <div className="space-y-4 animate-pulse max-w-4xl mx-auto">
                        <div className="h-8 bg-slate-800 rounded w-1/3" />
                        <div className="h-4 bg-slate-800 rounded w-2/3" />
                        <div className="h-40 bg-slate-800 rounded" />
                      </div>
                    ) : masterSummary || masterNoteDraft ? (
                      viewFormattedMasterNote ? (
                        <article className="max-w-4xl mx-auto markdown-body">
                          <div
                            dangerouslySetInnerHTML={{ __html: formattedMasterSummaryHtml }}
                          />
                        </article>
                      ) : (
                        <div className="max-w-4xl mx-auto min-h-full flex flex-col">
                          <textarea
                            value={masterNoteDraft}
                            onChange={(e) => setMasterNoteDraft(e.target.value)}
                            onBlur={() => {
                              if (masterNoteDraft !== lastSavedContentRef.current) {
                                performAutoSave(masterNoteDraft);
                              }
                            }}
                            placeholder={
                              outputLanguage === 'pt'
                                ? 'Clica aqui para escrever ou editar notas em Markdown...'
                                : 'Click here to write or edit notes in Markdown...'
                            }
                            className="w-full flex-1 min-h-[600px] bg-transparent text-slate-200 font-sans text-sm leading-relaxed resize-none border-0 focus:outline-none focus:ring-0 p-0 placeholder-slate-600 selection:bg-indigo-600/30 whitespace-pre-wrap"
                            spellCheck={false}
                          />
                        </div>
                      )
                    ) : isTeoricasRoot ? (
                      <div className="max-w-lg mx-auto my-12 bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-4">
                        <div className="inline-flex p-3 bg-indigo-950/60 border border-indigo-800/40 rounded-2xl text-indigo-400">
                          <Sparkles className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-white">
                            {outputLanguage === 'pt'
                              ? 'Home Page & Syllabus da Cadeira'
                              : 'Course Home Page & Syllabus'}
                          </h3>
                          <p className="text-xs text-slate-400 leading-relaxed font-mono">
                            {outputLanguage === 'pt'
                              ? 'Configura o plano geral da cadeira com os objetivos da UC, calendário de frequências e exames, prazos de entrega e critérios de avaliação para toda a turma.'
                              : 'Set up the general course syllabus with competencies, exam calendars, project deadlines, and grading criteria for the entire cohort.'}
                          </p>
                        </div>
                        <div className="flex items-center justify-center space-x-3 pt-2">
                          <button
                            onClick={() => setShowSyllabusModal(true)}
                            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-md shadow-indigo-600/20 font-mono"
                          >
                            <Sparkles className="w-4 h-4" />
                            <span>
                              {outputLanguage === 'pt'
                                ? 'Configurar Syllabus com IA'
                                : 'Setup Syllabus with AI'}
                            </span>
                          </button>
                          <button
                            onClick={handleCreateBlankMasterNote}
                            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer font-mono"
                          >
                            <Edit3 className="w-4 h-4 text-indigo-400" />
                            <span>
                              {outputLanguage === 'pt' ? 'Escrever Diretamente' : 'Write Directly'}
                            </span>
                          </button>
                          <button
                            onClick={() => setActiveCourseTab('weeks')}
                            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer font-mono"
                          >
                            <Layers className="w-4 h-4 text-indigo-400" />
                            <span>
                              {outputLanguage === 'pt' ? 'Ver Semanas' : 'View Weeks'}
                            </span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="max-w-md mx-auto my-12 bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-4">
                        <div className="inline-flex p-3 bg-indigo-950/60 border border-indigo-800/40 rounded-2xl text-indigo-400">
                          <Sparkles className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h3 className="text-base font-bold text-white">
                            {outputLanguage === 'pt'
                              ? `Sem Síntese Mestra para ${activeFolder.name}`
                              : `No Master Synthesis for ${activeFolder.name}`}
                          </h3>
                          <p className="text-xs text-slate-400 leading-relaxed">
                            {outputLanguage === 'pt' ? (
                              <>
                                Clica em <strong>Importar Aula</strong> para adicionar apontamentos do teu histórico ou clica abaixo para começar a escrever diretamente.
                              </>
                            ) : (
                              <>
                                Click <strong>Import Lecture</strong> to add notes from history or click below to start writing directly.
                              </>
                            )}
                          </p>
                        </div>
                        <div className="flex items-center justify-center space-x-3 pt-2">
                          <button
                            onClick={handleOpenImportModal}
                            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
                          >
                            <Plus className="w-4 h-4" />
                            <span>
                              {outputLanguage === 'pt' ? 'Importar Primeira Aula' : 'Import First Lecture'}
                            </span>
                          </button>
                          <button
                            onClick={handleCreateBlankMasterNote}
                            className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-colors cursor-pointer font-mono"
                          >
                            <Edit3 className="w-4 h-4 text-indigo-400" />
                            <span>
                              {outputLanguage === 'pt' ? 'Escrever Diretamente' : 'Write Directly'}
                            </span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 2: ÍNDICE DE SEMANAS (TEÓRICAS ONLY) */}
              {isTeoricasRoot && activeCourseTab === 'weeks' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  <div className="px-6 py-2.5 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center space-x-2 text-slate-400">
                      <Layers className="w-3.5 h-3.5 text-indigo-400" />
                      <span>
                        {outputLanguage === 'pt'
                          ? 'Índice de Semanas e Tópicos Lecionados'
                          : 'Weekly Lecture Index & Modules'}
                      </span>
                    </div>

                    <button
                      onClick={() => handleQuickAddWeek()}
                      className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm shadow-indigo-600/20 font-mono"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{outputLanguage === 'pt' ? '+ Adicionar Semana' : '+ Add Week'}</span>
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-6">
                    {teoricasWeekSubfolders.length === 0 ? (
                      <div className="max-w-md mx-auto my-12 bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-4">
                        <div className="inline-flex p-3 bg-amber-950/60 border border-amber-800/40 rounded-2xl text-amber-400">
                          <Calendar className="w-8 h-8" />
                        </div>
                        <div className="space-y-1">
                          <h4 className="text-sm font-bold text-white">
                            {outputLanguage === 'pt'
                              ? 'Nenhuma semana criada ainda'
                              : 'No weeks created yet'}
                          </h4>
                          <p className="text-xs text-slate-400 leading-relaxed font-mono">
                            {outputLanguage === 'pt'
                              ? 'Ao importar apontamentos com títulos como "Semana 1", "Semana 2" ou "Aula 1", as semanas serão criadas e associadas aqui automaticamente com a respetiva Master Note. Podes também criar a primeira semana agora.'
                              : 'When importing notes with titles like "Week 1", "Week 2", or "Lecture 1", weeks will be created and linked here automatically with their dedicated Master Note. You can also create the first week manually now.'}
                          </p>
                        </div>
                        <button
                          onClick={() => handleQuickAddWeek('Semana 1')}
                          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer font-mono shadow-md shadow-indigo-600/20"
                        >
                          <Plus className="w-4 h-4" />
                          <span>{outputLanguage === 'pt' ? 'Criar Semana 1' : 'Create Week 1'}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="max-w-5xl mx-auto space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {teoricasWeekSubfolders.map((week) => {
                            const weekNotes = notes.filter((n) => n.folder_id === week.id);
                            return (
                              <div
                                key={week.id}
                                className="bg-slate-900/70 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-5 space-y-3.5 transition-all flex flex-col justify-between group"
                              >
                                <div className="space-y-2.5">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-2">
                                      <div className="p-1.5 bg-amber-950/60 border border-amber-700/60 rounded-lg text-amber-400">
                                        <Calendar className="w-4 h-4" />
                                      </div>
                                      <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                                        {week.name}
                                      </h4>
                                    </div>
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-slate-800 text-slate-300 font-bold border border-slate-700">
                                      {weekNotes.length}{' '}
                                      {outputLanguage === 'pt' ? 'aula(s)' : 'lecture(s)'}
                                    </span>
                                  </div>

                                  {/* Preview of notes inside this week */}
                                  <div className="space-y-1 font-mono text-xs">
                                    {weekNotes.length === 0 ? (
                                      <p className="text-[11px] text-slate-500 italic">
                                        {outputLanguage === 'pt'
                                          ? 'Sem aulas importadas nesta semana'
                                          : 'No lectures imported in this week'}
                                      </p>
                                    ) : (
                                      weekNotes.slice(0, 2).map((n) => (
                                        <div
                                          key={n.id}
                                          className="text-slate-300 text-[11px] truncate flex items-center space-x-1"
                                        >
                                          <span className="text-indigo-400">•</span>
                                          <span className="truncate">{n.title}</span>
                                        </div>
                                      ))
                                    )}
                                    {weekNotes.length > 2 && (
                                      <p className="text-[10px] text-slate-500 font-mono">
                                        +{weekNotes.length - 2} {outputLanguage === 'pt' ? 'mais' : 'more'}
                                      </p>
                                    )}
                                  </div>
                                </div>

                                <div className="pt-2 border-t border-slate-800/80">
                                  <button
                                    onClick={() => {
                                      setSelectedFolderId(week.id);
                                      setViewFormattedMasterNote(true);
                                    }}
                                    className="w-full flex items-center justify-center space-x-1.5 py-2 px-3 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/40 hover:border-indigo-400 text-indigo-300 hover:text-white rounded-xl text-xs font-semibold font-mono transition-all cursor-pointer shadow-sm"
                                  >
                                    <span>
                                      {outputLanguage === 'pt' ? 'Abrir Semana' : 'Open Week'}
                                    </span>
                                    <ArrowRight className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* VIEW 3: LECTURE NOTES TAB */}
              {activeCourseTab === 'notes' && (
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {(isTeoricasRoot ? allTeoricasNotes : activeFolderNotes).length === 0 ? (
                    <div className="max-w-md mx-auto my-12 bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-4">
                      <div className="inline-flex p-3 bg-slate-800 border border-slate-700 rounded-2xl text-slate-400">
                        <FileText className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-white">
                          {outputLanguage === 'pt'
                            ? 'Nenhuma aula importada nesta pasta'
                            : 'No lectures imported in this folder'}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {outputLanguage === 'pt'
                            ? 'Importa apontamentos gerados no SynapseVault ou cola resumos em Markdown para partilhar com os colegas.'
                            : 'Import notes generated in SynapseVault or paste Markdown summaries to share with classmates.'}
                        </p>
                      </div>
                      <button
                        onClick={handleOpenImportModal}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>
                          {outputLanguage === 'pt' ? 'Importar Aula / Markdown' : 'Import Lecture / Markdown'}
                        </span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-5xl mx-auto">
                      {(isTeoricasRoot ? allTeoricasNotes : activeFolderNotes).map((note) => {
                        const noteFolder = folders.find((f) => f.id === note.folder_id);
                        return (
                          <div
                            key={note.id}
                            className="bg-slate-900/80 border border-slate-800 hover:border-slate-700 rounded-xl p-5 space-y-3 transition-colors flex flex-col justify-between"
                          >
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                                <span className="flex items-center space-x-1 text-indigo-300">
                                  <User className="w-3 h-3" />
                                  <span className="truncate max-w-[150px]">{note.author_email}</span>
                                </span>
                                {noteFolder && noteFolder.id !== activeFolder.id && (
                                  <span className="px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-700/60 text-amber-300 text-[10px] font-bold">
                                    {noteFolder.name}
                                  </span>
                                )}
                                <span>
                                  {new Date(note.imported_at).toLocaleDateString(
                                    outputLanguage === 'pt' ? 'pt-PT' : 'en-US'
                                  )}
                                </span>
                              </div>

                              <h4 className="text-sm font-bold text-white leading-snug">{note.title}</h4>

                              <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                                {note.content_markdown.replace(/[#*`_\[\]]/g, '').slice(0, 200)}...
                              </p>
                            </div>

                            <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs font-mono">
                              <span className="text-slate-500 text-[10px]">
                                {note.content_markdown.length.toLocaleString()}{' '}
                                {outputLanguage === 'pt' ? 'caracteres' : 'chars'}
                              </span>

                              <div className="flex items-center space-x-1.5">
                                <button
                                  onClick={() => setPreviewNote(note)}
                                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white rounded text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>{outputLanguage === 'pt' ? 'Ler Aula' : 'Read Lecture'}</span>
                                </button>

                                {(isOwner ||
                                  Boolean(
                                    currentUser?.email &&
                                      note.author_email &&
                                      note.author_email.toLowerCase() === currentUser.email.toLowerCase()
                                  )) && (
                                  <button
                                    onClick={() => handleDeleteNote(note)}
                                    disabled={deletingNoteId === note.id}
                                    title={outputLanguage === 'pt' ? 'Apagar Aula' : 'Delete Lecture'}
                                    className="p-1.5 bg-slate-800 hover:bg-rose-950/60 border border-transparent hover:border-rose-600/50 text-slate-400 hover:text-rose-400 rounded text-xs transition-colors flex items-center justify-center cursor-pointer"
                                  >
                                    {deletingNoteId === note.id ? (
                                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                    )}
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* ========================================================================= */}
      {/* MODAL: CONFIGURAR SYLLABUS DA CADEIRA COM IA                              */}
      {/* ========================================================================= */}
      {showSyllabusModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">
                  {outputLanguage === 'pt'
                    ? `Configurar Syllabus de ${activeCourseAncestor?.name || activeFolder?.name}`
                    : `Setup Syllabus for ${activeCourseAncestor?.name || activeFolder?.name}`}
                </h2>
              </div>
              <button
                onClick={() => setShowSyllabusModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleGenerateSyllabus} className="space-y-4 flex-1 flex flex-col">
              <div className="space-y-1">
                <p className="text-xs text-slate-300 leading-relaxed font-mono">
                  {outputLanguage === 'pt'
                    ? 'Cola o texto da Ficha de Unidade Curricular (FUC), os slides de apresentação da disciplina ou notas iniciais do professor.'
                    : 'Paste the course syllabus description, introductory slides text, or professor guidelines.'}
                </p>
                <p className="text-[11px] text-slate-400 font-mono">
                  {outputLanguage === 'pt'
                    ? 'O Gemini estruturará os objetivos da UC, metodologia, calendário de frequências/exames, prazos de entrega e critérios de avaliação.'
                    : 'Gemini will synthesize course goals, assessment calendar (exams/tests), project deadlines, and grading rules.'}
                </p>
              </div>

              <div className="flex-1 flex flex-col">
                <label className="block text-xs font-medium text-slate-300 mb-1.5 font-mono">
                  {outputLanguage === 'pt'
                    ? 'Texto de Apresentação / FUC da Cadeira *'
                    : 'Course Presentation / Syllabus Text *'}
                </label>
                <textarea
                  required
                  rows={10}
                  placeholder={
                    outputLanguage === 'pt'
                      ? 'Cola aqui o conteúdo da FUC, plano do semestre, datas das frequências, regras de avaliação...'
                      : 'Paste course presentation, semester plan, exam dates, grading rules here...'
                  }
                  value={syllabusSourceText}
                  onChange={(e) => setSyllabusSourceText(e.target.value)}
                  className="w-full flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-[10px] text-slate-500 font-mono">
                  {syllabusSourceText.length} chars
                </span>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setShowSyllabusModal(false)}
                    className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {outputLanguage === 'pt' ? 'Cancelar' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    disabled={isGeneratingSyllabus || !syllabusSourceText.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 font-mono"
                  >
                    {isGeneratingSyllabus && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>
                      {isGeneratingSyllabus
                        ? outputLanguage === 'pt'
                          ? 'A sintetizar...'
                          : 'Synthesizing...'
                        : outputLanguage === 'pt'
                        ? 'Sintetizar Syllabus com IA'
                        : 'Synthesize Syllabus'}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: IMPORTAR AULA / COLAR MARKDOWN DIRETO                              */}
      {/* ========================================================================= */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">
                  {outputLanguage === 'pt'
                    ? `Adicionar a ${activeFolder?.name}`
                    : `Add to ${activeFolder?.name}`}
                </h2>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <div className="flex items-center space-x-2 border-b border-slate-800 pb-2 text-xs font-mono">
              <button
                type="button"
                onClick={() => setImportModalTab('history')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer ${
                  importModalTab === 'history'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {outputLanguage === 'pt' ? 'Do Meu Histórico Pessoal' : 'From My History'}
              </button>
              <button
                type="button"
                onClick={() => setImportModalTab('paste')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  importModalTab === 'paste'
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileCode className="w-3.5 h-3.5 text-emerald-400" />
                <span>{outputLanguage === 'pt' ? 'Colar Markdown Direto' : 'Paste Raw Markdown'}</span>
              </button>
            </div>

            {/* Smart Week Destination Selector if importing on Teóricas Root */}
            {isTeoricasRoot && (
              <div className="bg-indigo-950/40 border border-indigo-500/30 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-indigo-300 flex items-center space-x-1.5 font-mono">
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <span>
                      {outputLanguage === 'pt'
                        ? 'Semana de Destino (Deteção Inteligente):'
                        : 'Target Week (Smart Routing):'}
                    </span>
                  </label>
                  {(() => {
                    const detected = detectWeekFromTitle(
                      importModalTab === 'paste' ? directNoteTitle : ''
                    );
                    return detected ? (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-700/50">
                        {outputLanguage === 'pt' ? `Detetado: ${detected}` : `Detected: ${detected}`}
                      </span>
                    ) : null;
                  })()}
                </div>

                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setTargetWeekSelection('')}
                    className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      !targetWeekSelection
                        ? 'bg-indigo-600 text-white font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {outputLanguage === 'pt' ? '⚡ Auto (Pelo Título)' : '⚡ Auto (From Title)'}
                  </button>

                  {teoricasWeekSubfolders.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setTargetWeekSelection(w.name)}
                      className={`px-2 py-1 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                        targetWeekSelection === w.name
                          ? 'bg-indigo-600 text-white font-bold'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {w.name}
                    </button>
                  ))}

                  <input
                    type="text"
                    placeholder={
                      outputLanguage === 'pt' ? 'Ou escreve ex: Semana 3' : 'Or type e.g. Week 3'
                    }
                    value={targetWeekSelection}
                    onChange={(e) => setTargetWeekSelection(e.target.value)}
                    className="flex-1 min-w-[130px] bg-slate-950 border border-slate-700 rounded px-2 py-1 text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>
            )}

            {importModalTab === 'history' && (
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                <p className="text-xs text-slate-400 leading-relaxed font-mono mb-2">
                  {outputLanguage === 'pt'
                    ? 'Seleciona uma nota sintetizada no teu histórico pessoal para adicionar a esta pasta.'
                    : 'Select a synthesized note from your personal history to add to this folder.'}
                </p>

                {loadingPersonalNotes ? (
                  <div className="space-y-2 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-16 bg-slate-950 rounded-xl" />
                    ))}
                  </div>
                ) : personalNotes.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 font-mono">
                    {outputLanguage === 'pt'
                      ? 'Não tens nenhuma nota sintetizada no teu histórico. Podes usar a aba "Colar Markdown Direto" ou ir ao Studio.'
                      : 'You have no synthesized notes in your history. You can use "Paste Raw Markdown" or use the Studio.'}
                  </div>
                ) : (
                  personalNotes.map((pNote) => {
                    const isMatchingCode = pNote.course_code === activeFolder?.course_code;
                    const isImporting = importingNoteId === pNote.id;

                    return (
                      <div
                        key={pNote.id}
                        className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                          isMatchingCode
                            ? 'bg-indigo-950/30 border-indigo-700/50'
                            : 'bg-slate-950 border-slate-800'
                        }`}
                      >
                        <div className="space-y-1 max-w-[420px]">
                          <div className="flex items-center space-x-2">
                            <span className="px-1.5 py-0.2 bg-slate-800 text-slate-300 font-mono text-[10px] font-bold rounded">
                              {pNote.course_code}
                            </span>
                            <h4 className="text-xs font-bold text-white truncate">{pNote.title}</h4>
                          </div>
                          <p className="text-[11px] text-slate-400 font-mono">
                            {new Date(pNote.created_at).toLocaleDateString(
                              outputLanguage === 'pt' ? 'pt-PT' : 'en-US'
                            )}{' '}
                            • {pNote.content_markdown.length} chars
                          </p>
                        </div>

                        <button
                          onClick={() => handleImportPersonalNote(pNote)}
                          disabled={isImporting}
                          className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer flex items-center space-x-1 font-mono shadow-sm"
                        >
                          {isImporting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                          <span>
                            {isImporting
                              ? outputLanguage === 'pt'
                                ? 'A importar...'
                                : 'Importing...'
                              : outputLanguage === 'pt'
                              ? 'Importar'
                              : 'Import'}
                          </span>
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {importModalTab === 'paste' && (
              <form onSubmit={handleImportDirectMarkdown} className="space-y-3 flex-1 flex flex-col">
                <p className="text-xs text-slate-400 leading-relaxed font-mono">
                  {outputLanguage === 'pt'
                    ? 'Cola apontamentos em Markdown já feitos anteriormente para juntar a esta pasta e enriquecer o Master Summary.'
                    : 'Paste existing Markdown notes directly to attach to this folder and update the Master Summary.'}
                </p>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
                    {outputLanguage === 'pt' ? 'Título do Apontamento / Resumo *' : 'Title *'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      outputLanguage === 'pt'
                        ? 'ex: Apontamentos Teóricos Semana 3 ou Decisões de Arquitetura'
                        : 'e.g. Week 3 Theory Notes or Architecture Decisions'
                    }
                    value={directNoteTitle}
                    onChange={(e) => setDirectNoteTitle(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div className="flex-1 flex flex-col">
                  <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
                    {outputLanguage === 'pt' ? 'Conteúdo Markdown *' : 'Markdown Content *'}
                  </label>
                  <textarea
                    required
                    rows={8}
                    placeholder={
                      outputLanguage === 'pt'
                        ? 'Cola o teu markdown aqui...'
                        : 'Paste your markdown here...'
                    }
                    value={directNoteContent}
                    onChange={(e) => setDirectNoteContent(e.target.value)}
                    className="w-full flex-1 bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {directNoteContent.length} chars
                  </span>
                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowImportModal(false)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                    >
                      {outputLanguage === 'pt' ? 'Cancelar' : 'Cancel'}
                    </button>
                    <button
                      type="submit"
                      disabled={isImportingDirectNote || !directNoteTitle.trim() || !directNoteContent.trim()}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 font-mono"
                    >
                      {isImportingDirectNote && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                      <span>
                        {isImportingDirectNote
                          ? outputLanguage === 'pt'
                            ? 'A importar...'
                            : 'Importing...'
                          : outputLanguage === 'pt'
                          ? 'Importar Markdown'
                          : 'Import Markdown'}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: CRIAR SUBPASTA (PROJETO OU TEÓRICA)                                */}
      {/* ========================================================================= */}
      {showCreateFolderModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Folder className="w-5 h-5 text-emerald-400" />
                <h2 className="text-base font-bold text-white">
                  {outputLanguage === 'pt' ? 'Nova Subpasta' : 'New Subfolder'}
                </h2>
              </div>
              <button
                onClick={() => setShowCreateFolderModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubfolderSubmit} className="space-y-4">
              <div>
                <p className="text-[11px] text-slate-400 font-mono mb-2">
                  {outputLanguage === 'pt' ? 'Criar dentro de:' : 'Create under:'}{' '}
                  <strong className="text-white">{createParentFolder?.name}</strong>
                </p>

                <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
                  {outputLanguage === 'pt' ? 'Nome da Subpasta *' : 'Subfolder Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    outputLanguage === 'pt'
                      ? 'ex: Projeto Miguel e Vasco, ou Sprint 1'
                      : 'e.g. Project Miguel & Vasco, or Sprint 1'
                  }
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              {isOwner && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
                    {outputLanguage === 'pt' ? 'Tipo de Pasta' : 'Folder Type'}
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <button
                      type="button"
                      onClick={() => setNewFolderType('project')}
                      className={`p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                        newFolderType === 'project'
                          ? 'bg-emerald-950/40 border-emerald-500 text-emerald-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Users className="w-3.5 h-3.5 mb-1 text-emerald-400" />
                      <div>{outputLanguage === 'pt' ? 'Projeto / Grupo' : 'Project / Group'}</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewFolderType('section')}
                      className={`p-2 rounded-xl border text-left transition-colors cursor-pointer ${
                        newFolderType === 'section'
                          ? 'bg-indigo-950/40 border-indigo-500 text-indigo-300 font-bold'
                          : 'bg-slate-950 border-slate-800 text-slate-400'
                      }`}
                    >
                      <Layers className="w-3.5 h-3.5 mb-1 text-indigo-400" />
                      <div>{outputLanguage === 'pt' ? 'Secção / Teóricas' : 'Section / Lecture'}</div>
                    </button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateFolderModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {outputLanguage === 'pt' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isCreatingFolder || !newFolderName.trim()}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shadow-md shadow-emerald-600/20 font-mono"
                >
                  {isCreatingFolder && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {isCreatingFolder
                      ? outputLanguage === 'pt'
                        ? 'A criar...'
                        : 'Creating...'
                      : outputLanguage === 'pt'
                      ? 'Criar Pasta'
                      : 'Create Folder'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: RENOMEAR PASTA                                                     */}
      {/* ========================================================================= */}
      {showRenameModal && renamingFolder && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <Pencil className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">
                  {outputLanguage === 'pt' ? 'Renomear Pasta' : 'Rename Folder'}
                </h2>
              </div>
              <button
                onClick={() => setShowRenameModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleRenameFolderSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1 font-mono">
                  {outputLanguage === 'pt' ? 'Novo Nome da Pasta *' : 'New Folder Name *'}
                </label>
                <input
                  type="text"
                  required
                  value={renamingFolderName}
                  onChange={(e) => setRenamingFolderName(e.target.value)}
                  autoFocus
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRenameModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {outputLanguage === 'pt' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={isRenamingFolder || !renamingFolderName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shadow-md shadow-indigo-600/20 font-mono"
                >
                  {isRenamingFolder && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {isRenamingFolder
                      ? outputLanguage === 'pt'
                        ? 'A guardar...'
                        : 'Saving...'
                      : outputLanguage === 'pt'
                      ? 'Guardar'
                      : 'Save'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: PREVIEW DE AULA INDIVIDUAL                                         */}
      {/* ========================================================================= */}
      {previewNote && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-3xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="space-y-0.5">
                <h3 className="text-sm font-bold text-white">{previewNote.title}</h3>
                <p className="text-[11px] text-slate-400 font-mono">
                  {outputLanguage === 'pt' ? 'Por ' : 'By '}
                  {previewNote.author_email} •{' '}
                  {new Date(previewNote.imported_at).toLocaleString(
                    outputLanguage === 'pt' ? 'pt-PT' : 'en-US'
                  )}
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(previewNote.content_markdown);
                    setCopiedNote(true);
                    setTimeout(() => setCopiedNote(false), 2000);
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs font-mono transition-colors flex items-center space-x-1 cursor-pointer"
                >
                  {copiedNote ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {copiedNote
                      ? outputLanguage === 'pt'
                        ? 'Copiado!'
                        : 'Copied!'
                      : outputLanguage === 'pt'
                      ? 'Copiar'
                      : 'Copy'}
                  </span>
                </button>

                {(isOwner ||
                  Boolean(
                    currentUser?.email &&
                      previewNote.author_email &&
                      previewNote.author_email.toLowerCase() === currentUser.email.toLowerCase()
                  )) && (
                  <button
                    onClick={() => handleDeleteNote(previewNote)}
                    disabled={deletingNoteId === previewNote.id}
                    title={outputLanguage === 'pt' ? 'Apagar Aula' : 'Delete Lecture'}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950/60 border border-slate-700 hover:border-rose-600/50 text-slate-300 hover:text-rose-400 rounded text-xs font-mono transition-colors flex items-center space-x-1 cursor-pointer"
                  >
                    {deletingNoteId === previewNote.id ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    )}
                    <span>{outputLanguage === 'pt' ? 'Apagar' : 'Delete'}</span>
                  </button>
                )}

                <button
                  onClick={() => setPreviewNote(null)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm pl-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 markdown-body">
              <div dangerouslySetInnerHTML={{ __html: renderMarkdown(previewNote.content_markdown) }} />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADICIONAR ALUNO (APENAS OWNER)                                     */}
      {/* ========================================================================= */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">
                  {outputLanguage === 'pt' ? 'Adicionar Aluno à Sala' : 'Add Student to Room'}
                </h2>
              </div>
              <button
                onClick={() => setShowAddMemberModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  {outputLanguage === 'pt' ? 'Email do Aluno *' : 'Student Email *'}
                </label>
                <input
                  type="email"
                  required
                  placeholder="colega@universidade.pt"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  {outputLanguage === 'pt'
                    ? 'O aluno terá acesso imediato à árvore de cadeiras e a todos os Master Summaries.'
                    : 'The student will gain immediate access to courses and all Master Summaries.'}
                </p>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddMemberModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {outputLanguage === 'pt' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={addingMember || !newMemberEmail.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shadow-md shadow-indigo-600/20"
                >
                  {addingMember && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {addingMember
                      ? outputLanguage === 'pt'
                        ? 'A adicionar...'
                        : 'Adding...'
                      : outputLanguage === 'pt'
                      ? 'Adicionar'
                      : 'Add'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
