'use client';

import React, { useEffect, useState, use, useMemo } from 'react';
import Link from 'next/link';
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
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type {
  StudyRoomRecord,
  RoomFolderRecord,
  RoomMemberRecord,
  RoomNoteRecord,
  MasterSummaryRecord,
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

  // Selected State
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'master' | 'notes'>('master');

  // Master Summary State
  const [masterSummary, setMasterSummary] = useState<MasterSummaryRecord | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [regeneratingSummary, setRegeneratingSummary] = useState(false);

  // Personal Notes Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [personalNotes, setPersonalNotes] = useState<PersonalNoteRecord[]>([]);
  const [loadingPersonalNotes, setLoadingPersonalNotes] = useState(false);
  const [importingNoteId, setImportingNoteId] = useState<string | null>(null);

  // Note View Modal State
  const [previewNote, setPreviewNote] = useState<RoomNoteRecord | null>(null);
  const [copiedMaster, setCopiedMaster] = useState(false);
  const [copiedNote, setCopiedNote] = useState(false);

  // Folder tree toggle states
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});

  // Load language preference
  useEffect(() => {
    const savedLang = localStorage.getItem('synapse_language');
    if (savedLang === 'en' || savedLang === 'pt') {
      setOutputLanguage(savedLang);
    }
  }, []);

  const handleSetLanguage = (lang: 'pt' | 'en') => {
    setOutputLanguage(lang);
    localStorage.setItem('synapse_language', lang);
  };

  // 1. Auth & Initial Load
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
      setFolders(data.folders || []);
      setNotes(data.notes || []);

      // Auto-expand all folders
      const expandMap: Record<string, boolean> = {};
      (data.folders || []).forEach((f: RoomFolderRecord) => {
        expandMap[f.id] = true;
      });
      setExpandedFolders(expandMap);

      // Select first course folder if none selected
      const firstCourse = (data.folders || []).find((f: RoomFolderRecord) => f.folder_type === 'course');
      if (firstCourse && !selectedFolderId) {
        setSelectedFolderId(firstCourse.id);
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

  // 2. Fetch Master Summary whenever selected folder changes
  useEffect(() => {
    if (!selectedFolderId || activeFolder?.folder_type !== 'course') {
      setMasterSummary(null);
      return;
    }

    const fetchSummary = async () => {
      setLoadingSummary(true);
      try {
        const res = await fetch(`/api/rooms/${roomId}/master-summary?folderId=${selectedFolderId}`);
        if (res.ok) {
          const data = await res.json();
          setMasterSummary(data.summary || null);
        }
      } catch {
        // non-blocking
      } finally {
        setLoadingSummary(false);
      }
    };

    fetchSummary();
  }, [roomId, selectedFolderId, activeFolder]);

  // 3. Open Import Modal & load personal notes
  const handleOpenImportModal = async () => {
    setShowImportModal(true);
    setLoadingPersonalNotes(true);
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

  // 4. Import a personal note into active course folder
  const handleImportPersonalNote = async (pNote: PersonalNoteRecord) => {
    if (!selectedFolderId) return;
    setImportingNoteId(pNote.id);

    try {
      const res = await fetch(`/api/rooms/${roomId}/import-note`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId: selectedFolderId,
          sourceNoteId: pNote.id,
          title: pNote.title,
          contentMarkdown: pNote.content_markdown,
          triggerMasterUpdate: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || (outputLanguage === 'pt' ? 'Falha ao importar nota.' : 'Failed to import note.')
        );
      }

      if (data.masterSummary) {
        setMasterSummary(data.masterSummary);
      }

      await loadRoomData();
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

  // 5. Regenerate Master Summary with IA
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

  // Copy Master
  const handleCopyMaster = () => {
    if (!masterSummary?.content_markdown) return;
    navigator.clipboard.writeText(masterSummary.content_markdown);
    setCopiedMaster(true);
    setTimeout(() => setCopiedMaster(false), 2000);
  };

  // Download Master
  const handleDownloadMaster = () => {
    if (!masterSummary?.content_markdown || !activeFolder) return;
    const blob = new Blob([masterSummary.content_markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${activeFolder.course_code || 'Course'}_Master_Summary.md`;
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

  // Toggle folder in tree
  const toggleFolder = (folderId: string) => {
    setExpandedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  // Organize folders into tree: year -> semester -> course
  const yearFolders = folders.filter((f) => f.folder_type === 'year');
  const semesterFolders = folders.filter((f) => f.folder_type === 'semester');
  const courseFolders = folders.filter((f) => f.folder_type === 'course');

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

      {/* Main Workspace Grid: Tree (Left) | Course Content (Center) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Academic Hierarchy Tree */}
        <aside className="w-72 bg-slate-950 border-r border-slate-800/80 flex flex-col p-4 space-y-4 overflow-y-auto">
          <div className="flex items-center justify-between text-xs font-mono font-semibold uppercase tracking-wider text-slate-400 pb-2 border-b border-slate-800">
            <span className="flex items-center space-x-1.5">
              <FolderTree className="w-3.5 h-3.5 text-indigo-400" />
              <span>{outputLanguage === 'pt' ? 'Estrutura de Pastas' : 'Folder Hierarchy'}</span>
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
                    {expandedFolders[year.id] ? (
                      <ChevronDown className="w-3.5 h-3.5 text-indigo-400" />
                    ) : (
                      <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                    )}
                    <FolderOpen className="w-4 h-4 text-indigo-400" />
                    <span>{year.name}</span>
                  </span>
                </button>

                {expandedFolders[year.id] && (
                  <div className="pl-4 space-y-1 border-l border-slate-800/80 ml-2">
                    {semesterFolders
                      .filter((s) => s.parent_id === year.id)
                      .map((sem) => (
                        <div key={sem.id} className="space-y-1">
                          <button
                            onClick={() => toggleFolder(sem.id)}
                            className="w-full flex items-center justify-between px-2 py-1 rounded text-slate-300 hover:bg-slate-900 text-left font-semibold transition-colors cursor-pointer"
                          >
                            <span className="flex items-center space-x-1.5">
                              {expandedFolders[sem.id] ? (
                                <ChevronDown className="w-3 h-3 text-indigo-400" />
                              ) : (
                                <ChevronRight className="w-3 h-3 text-slate-500" />
                              )}
                              <Folder className="w-3.5 h-3.5 text-amber-400" />
                              <span>{sem.name}</span>
                            </span>
                          </button>

                          {expandedFolders[sem.id] && (
                            <div className="pl-3 space-y-0.5 border-l border-slate-800/80 ml-2">
                              {courseFolders
                                .filter((c) => c.parent_id === sem.id)
                                .map((course) => {
                                  const isSelected = selectedFolderId === course.id;
                                  const noteCount = notes.filter((n) => n.folder_id === course.id).length;
                                  return (
                                    <button
                                      key={course.id}
                                      onClick={() => setSelectedFolderId(course.id)}
                                      className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-left transition-all cursor-pointer ${
                                        isSelected
                                          ? 'bg-indigo-600/20 border border-indigo-500/40 text-indigo-300 font-semibold'
                                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900/60'
                                      }`}
                                    >
                                      <span className="truncate flex items-center space-x-1.5 pr-2">
                                        <BookOpen
                                          className={`w-3.5 h-3.5 flex-shrink-0 ${
                                            isSelected ? 'text-indigo-400' : 'text-slate-500'
                                          }`}
                                        />
                                        <span className="truncate">{course.course_code || course.name}</span>
                                      </span>
                                      <span
                                        className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono flex-shrink-0 ${
                                          noteCount > 0
                                            ? 'bg-indigo-950 text-indigo-300 font-bold border border-indigo-800/60'
                                            : 'text-slate-600'
                                        }`}
                                      >
                                        {noteCount}
                                      </span>
                                    </button>
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
                    <span className="truncate max-w-[130px]" title={m.user_email}>
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

        {/* Center Column: Course Knowledge Base (Master Note & Lecture Notes) */}
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
                ? 'Seleciona uma cadeira na árvore lateral para visualizar o Master Summary e apontamentos.'
                : 'Select a course in the left hierarchy to view the Master Summary and lecture notes.'}
            </div>
          ) : (
            <>
              {/* Course Top Header */}
              <div className="border-b border-slate-800 px-6 py-4 bg-slate-900/40 flex items-center justify-between">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-indigo-950 border border-indigo-700 text-indigo-300 text-xs font-mono font-bold rounded">
                      {activeFolder.course_code || 'COURSE'}
                    </span>
                    <h2 className="text-base font-bold text-white tracking-tight">{activeFolder.name}</h2>
                  </div>
                  <p className="text-xs text-slate-400 font-mono">
                    {activeFolderNotes.length}{' '}
                    {outputLanguage === 'pt'
                      ? 'aula(s) importada(s) • Base de Conhecimento Colaborativa'
                      : 'lecture(s) imported • Collaborative Knowledge Base'}
                  </p>
                </div>

                {/* Tab Switcher & Import Button */}
                <div className="flex items-center space-x-3">
                  <div className="bg-slate-900 border border-slate-800 rounded-lg p-1 flex items-center space-x-1 text-xs font-mono">
                    <button
                      onClick={() => setActiveTab('master')}
                      className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        activeTab === 'master'
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Master Note</span>
                    </button>
                    <button
                      onClick={() => setActiveTab('notes')}
                      className={`px-3 py-1 rounded-md font-semibold transition-all cursor-pointer flex items-center space-x-1.5 ${
                        activeTab === 'notes'
                          ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>
                        {outputLanguage === 'pt' ? 'Aulas' : 'Lectures'} ({activeFolderNotes.length})
                      </span>
                    </button>
                  </div>

                  <button
                    onClick={handleOpenImportModal}
                    className="flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer shadow-sm shadow-emerald-600/20 font-mono"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{outputLanguage === 'pt' ? 'Importar Aula' : 'Import Lecture'}</span>
                  </button>
                </div>
              </div>

              {/* Tab 1: Master Note (Living Synthesis) */}
              {activeTab === 'master' && (
                <div className="flex-1 flex flex-col overflow-hidden">
                  {/* Master Note Status Bar */}
                  <div className="px-6 py-2.5 bg-slate-900/60 border-b border-slate-800/60 flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center space-x-3 text-slate-400">
                      {masterSummary ? (
                        <>
                          <span className="px-1.5 py-0.2 bg-indigo-950 text-indigo-300 border border-indigo-700/60 rounded text-[10px] font-bold">
                            v{masterSummary.version}
                          </span>
                          <span>
                            {outputLanguage === 'pt'
                              ? `Baseado em ${masterSummary.sources_count} aula(s)`
                              : `Based on ${masterSummary.sources_count} lecture(s)`}
                          </span>
                          <span>•</span>
                          <span className="text-slate-500">
                            {outputLanguage === 'pt' ? 'Atualizado em ' : 'Updated at '}
                            {new Date(masterSummary.last_updated_at).toLocaleTimeString(
                              outputLanguage === 'pt' ? 'pt-PT' : 'en-US',
                              {
                                hour: '2-digit',
                                minute: '2-digit',
                              }
                            )}
                          </span>
                        </>
                      ) : (
                        <span>
                          {outputLanguage === 'pt'
                            ? 'Nenhum Master Summary gerado ainda para esta cadeira'
                            : 'No Master Summary generated yet for this course'}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      {masterSummary && (
                        <>
                          <button
                            onClick={handleCopyMaster}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded text-xs transition-colors flex items-center space-x-1 cursor-pointer"
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
                          <button
                            onClick={handleDownloadMaster}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white rounded text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download .md</span>
                          </button>
                        </>
                      )}

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
                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-xs font-semibold rounded transition-colors flex items-center space-x-1.5 cursor-pointer shadow-sm"
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

                  {/* Master Note Content View */}
                  <div className="flex-1 overflow-y-auto p-8 font-sans">
                    {loadingSummary ? (
                      <div className="space-y-4 animate-pulse max-w-4xl mx-auto">
                        <div className="h-8 bg-slate-800 rounded w-1/3" />
                        <div className="h-4 bg-slate-800 rounded w-2/3" />
                        <div className="h-4 bg-slate-800 rounded w-full" />
                        <div className="h-40 bg-slate-800 rounded" />
                      </div>
                    ) : masterSummary?.content_markdown ? (
                      <article className="max-w-4xl mx-auto prose prose-invert prose-indigo prose-sm leading-relaxed">
                        <pre className="whitespace-pre-wrap font-sans text-slate-200 text-sm leading-relaxed bg-transparent border-0 p-0">
                          {masterSummary.content_markdown}
                        </pre>
                      </article>
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
                                Clica em <strong>Importar Aula</strong> para adicionar os teus apontamentos do estúdio.
                                O motor Gemini criará automaticamente o Master Summary e enriquecerá os capítulos de estudo a cada nova aula adicionada.
                              </>
                            ) : (
                              <>
                                Click <strong>Import Lecture</strong> to add your synthesized notes from the studio.
                                Gemini will automatically construct the Master Summary and enrich study chapters with every new lecture added.
                              </>
                            )}
                          </p>
                        </div>
                        <button
                          onClick={handleOpenImportModal}
                          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-md shadow-indigo-600/20"
                        >
                          <Plus className="w-4 h-4" />
                          <span>
                            {outputLanguage === 'pt' ? 'Importar Primeira Aula' : 'Import First Lecture'}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tab 2: Individual Lecture Notes Feed */}
              {activeTab === 'notes' && (
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {activeFolderNotes.length === 0 ? (
                    <div className="max-w-md mx-auto my-12 bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-8 text-center space-y-4">
                      <div className="inline-flex p-3 bg-slate-800 border border-slate-700 rounded-2xl text-slate-400">
                        <FileText className="w-8 h-8" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-bold text-white">
                          {outputLanguage === 'pt'
                            ? 'Nenhuma aula importada nesta cadeira'
                            : 'No lectures imported in this course'}
                        </h3>
                        <p className="text-xs text-slate-400">
                          {outputLanguage === 'pt'
                            ? 'Importa os teus apontamentos gerados no SynapseVault para partilhares com os colegas.'
                            : 'Import notes generated in SynapseVault to share with classmates.'}
                        </p>
                      </div>
                      <button
                        onClick={handleOpenImportModal}
                        className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                      >
                        <Plus className="w-4 h-4" />
                        <span>
                          {outputLanguage === 'pt' ? 'Importar do Meu Histórico' : 'Import from My History'}
                        </span>
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
                              <span className="flex items-center space-x-1 text-indigo-300">
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
                              <span>{outputLanguage === 'pt' ? 'Ler Aula' : 'Read Lecture'}</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      </div>

      {/* Modal Importar do Histórico Pessoal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <BookOpen className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">
                  {outputLanguage === 'pt'
                    ? `Importar para ${activeFolder?.name}`
                    : `Import to ${activeFolder?.name}`}
                </h2>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed font-mono">
              {outputLanguage === 'pt'
                ? 'Seleciona uma nota sintetizada no teu histórico pessoal para adicionar a esta cadeira. O Master Summary será atualizado com os novos tópicos.'
                : 'Select a note from your personal history to add to this course. The Master Summary will automatically merge and expand with new topics.'}
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {loadingPersonalNotes ? (
                <div className="space-y-2 animate-pulse">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-slate-950 rounded-xl" />
                  ))}
                </div>
              ) : personalNotes.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500 font-mono">
                  {outputLanguage === 'pt'
                    ? 'Não tens nenhuma nota sintetizada no teu histórico. Vai ao Studio para processar gravações ou PDFs primeiro.'
                    : 'You have no synthesized notes in your history. Go to the Studio to process lectures or PDFs first.'}
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
          </div>
        </div>
      )}

      {/* Modal Preview de Aula Individual */}
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

                <button
                  onClick={() => setPreviewNote(null)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm pl-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              <pre className="whitespace-pre-wrap font-sans text-slate-200 text-xs leading-relaxed">
                {previewNote.content_markdown}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* Modal Adicionar Aluno (Apenas Owner) */}
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
