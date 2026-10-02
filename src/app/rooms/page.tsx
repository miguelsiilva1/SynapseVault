'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  FolderTree,
  Plus,
  Sparkles,
  ArrowRight,
  AlertCircle,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import AppHeader from '@/components/AppHeader';
import type { StudyRoomRecord } from '@/lib/db/rooms';

export default function RoomsHubPage() {
  const [currentUser, setCurrentUser] = useState<{ email?: string } | null>(null);
  const [, setAuthLoading] = useState(true);
  const [rooms, setRooms] = useState<StudyRoomRecord[]>([]);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Language State
  const [outputLanguage, setOutputLanguage] = useState<'pt' | 'en'>('pt');

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomDesc, setRoomDesc] = useState('');
  const [memberEmailsInput, setMemberEmailsInput] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingRoomId, setDeletingRoomId] = useState<string | null>(null);

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

  // Load auth
  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth
        .getUser()
        .then(({ data: { user } }) => {
          if (user?.email) {
            setCurrentUser({ email: user.email });
          }
          setAuthLoading(false);
        })
        .catch(() => setAuthLoading(false));
    } catch {
      setAuthLoading(false);
    }
  }, []);

  // Fetch rooms
  const loadRooms = async () => {
    setLoadingRooms(true);
    setError(null);
    try {
      const res = await fetch('/api/rooms');
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          data.error ||
            (outputLanguage === 'pt' ? 'Falha ao carregar salas de estudo.' : 'Failed to load study rooms.')
        );
      }
      const data = await res.json();
      setRooms(data.rooms || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Erro ao listar salas.'
          : 'Error listing study rooms.'
      );
    } finally {
      setLoadingRooms(false);
    }
  };

  useEffect(() => {
    if (currentUser?.email) {
      loadRooms();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the user changes
  }, [currentUser]);

  // Handle delete room (owner only)
  const handleDeleteRoom = async (e: React.MouseEvent, room: StudyRoomRecord) => {
    e.preventDefault();
    e.stopPropagation();
    const confirmMsg =
      outputLanguage === 'pt'
        ? `Eliminar a sala "${room.name}"? Todas as pastas, aulas, Master Notes e logs desta sala são apagados para todos os membros. Esta ação não pode ser desfeita.`
        : `Delete the room "${room.name}"? All folders, notes, Master Notes and logs of this room are removed for every member. This cannot be undone.`;
    if (!window.confirm(confirmMsg)) return;

    setDeletingRoomId(room.id);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${room.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || (outputLanguage === 'pt' ? 'Falha ao eliminar sala.' : 'Failed to delete room.'));
      }
      setRooms((prev) => prev.filter((r) => r.id !== room.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao eliminar sala.');
    } finally {
      setDeletingRoomId(null);
    }
  };

  // Handle create room
  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim()) return;

    setCreating(true);
    try {
      const emails = memberEmailsInput
        .split(/[,;\n]/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.length > 0 && e.includes('@'));

      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roomName.trim(),
          description: roomDesc.trim(),
          memberEmails: emails,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          data.error || (outputLanguage === 'pt' ? 'Falha ao criar sala.' : 'Failed to create room.')
        );
      }

      setShowCreateModal(false);
      setRoomName('');
      setRoomDesc('');
      setMemberEmailsInput('');
      await loadRooms();
    } catch (err) {
      alert(
        err instanceof Error
          ? err.message
          : outputLanguage === 'pt'
          ? 'Falha ao criar sala.'
          : 'Failed to create room.'
      );
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans selection:bg-accent-soft">
      {/* Top Navbar */}
      <AppHeader
        active="rooms"
        language={outputLanguage}
        onLanguageChange={handleSetLanguage}
        email={currentUser?.email}
      >
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-accent-hover text-on-accent text-xs font-medium rounded-lg transition-colors cursor-pointer"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{outputLanguage === 'pt' ? 'Criar sala' : 'Create room'}</span>
        </button>
      </AppHeader>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold text-ink tracking-tight">
            {outputLanguage === 'pt' ? 'Salas de estudo' : 'Study rooms'}
          </h1>
          <p className="text-sm text-muted max-w-2xl">
            {outputLanguage === 'pt'
              ? 'Cada sala organiza as cadeiras em pastas. Os resumos importados pelo grupo alimentam uma nota mestra por cadeira.'
              : 'Each room organises courses into folders. Summaries imported by the group feed one master note per course.'}
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-danger-soft border border-danger-line rounded-xl flex items-center space-x-3 text-danger text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Rooms Grid */}
        {loadingRooms ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 bg-surface border border-line rounded-xl" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-surface border border-dashed border-line rounded-xl p-12 text-center space-y-4">
            <div className="inline-flex p-3 bg-accent-soft border border-accent-line rounded-xl text-accent-ink">
              <FolderTree className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-ink">
                {outputLanguage === 'pt' ? 'Nenhuma sala de estudo encontrada' : 'No study rooms found'}
              </h3>
              <p className="text-xs text-muted max-w-md mx-auto">
                {outputLanguage === 'pt'
                  ? 'Ainda não pertences a nenhuma sala. Cria a primeira sala para a tua turma e convida os teus colegas pelo email.'
                  : 'You do not belong to any room yet. Create the first room for your group and invite colleagues by email.'}
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-accent hover:bg-accent-hover text-on-accent text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-lg"
            >
              <Plus className="w-4 h-4" />
              <span>{outputLanguage === 'pt' ? 'Criar Primeira Sala' : 'Create First Room'}</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {rooms.map((room) => (
              <Link
                key={room.id}
                href={`/rooms/${room.id}`}
                className="group bg-surface hover:bg-surface border border-line hover:border-accent-line rounded-xl p-5 space-y-4 transition-all duration-200 flex flex-col justify-between shadow-lg hover:-translate-y-0.5"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-accent-soft text-accent-ink border border-accent-line">
                      {room.role === 'owner'
                        ? outputLanguage === 'pt'
                          ? 'Criador / Admin'
                          : 'Creator / Admin'
                        : outputLanguage === 'pt'
                        ? 'Membro'
                        : 'Member'}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-faint">
                        {new Date(room.created_at).toLocaleDateString(
                          outputLanguage === 'pt' ? 'pt-PT' : 'en-US'
                        )}
                      </span>
                      {room.role === 'owner' && (
                        <button
                          onClick={(e) => handleDeleteRoom(e, room)}
                          disabled={deletingRoomId === room.id}
                          title={outputLanguage === 'pt' ? 'Eliminar sala' : 'Delete room'}
                          className="p-1.5 rounded text-faint hover:text-danger hover:bg-danger-soft transition-colors cursor-pointer disabled:opacity-40"
                        >
                          {deletingRoomId === room.id ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  <h3 className="text-base font-bold text-ink group-hover:text-accent-ink transition-colors">
                    {room.name}
                  </h3>

                  <p className="text-xs text-muted line-clamp-2 leading-relaxed">
                    {room.description ||
                      (outputLanguage === 'pt'
                        ? 'Sala de estudo colaborativa com hierarquia curricular e Master Knowledge Base.'
                        : 'Collaborative study room with academic hierarchy and Master Knowledge Base.')}
                  </p>
                </div>

                <div className="pt-3 border-t border-line flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 text-muted">
                    <Users className="w-3.5 h-3.5 text-faint" />
                    <span>
                      {outputLanguage === 'pt' ? '8 Cadeiras Base' : '8 Core Courses'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 text-accent-ink group-hover:text-accent-ink font-semibold">
                    <span>{outputLanguage === 'pt' ? 'Entrar' : 'Enter'}</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* Modal Criar Sala */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-surface border border-line rounded-xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div className="flex items-center space-x-2">
                <FolderTree className="w-5 h-5 text-accent-ink" />
                <h2 className="text-base font-bold text-ink">
                  {outputLanguage === 'pt' ? 'Criar Nova Sala de Estudo' : 'Create New Study Room'}
                </h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-muted hover:text-ink transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-soft">
                  {outputLanguage === 'pt' ? 'Nome da Sala *' : 'Room Name *'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={
                    outputLanguage === 'pt'
                      ? 'ex: Engenharia Informática 2026/2027'
                      : 'e.g. Computer Science 2026/2027'
                  }
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  className="w-full bg-canvas border border-line-strong rounded-xl px-3 py-2 text-xs text-ink placeholder:text-faint focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-soft">
                  {outputLanguage === 'pt'
                    ? 'Descrição Curta (Opcional)'
                    : 'Short Description (Optional)'}
                </label>
                <input
                  type="text"
                  placeholder={
                    outputLanguage === 'pt'
                      ? 'ex: Apontamentos e sínteses coletivas do 3º Ano'
                      : 'e.g. Shared notes and master synthesis for Year 3'
                  }
                  value={roomDesc}
                  onChange={(e) => setRoomDesc(e.target.value)}
                  className="w-full bg-canvas border border-line-strong rounded-xl px-3 py-2 text-xs text-ink placeholder:text-faint focus:outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-ink-soft">
                  {outputLanguage === 'pt'
                    ? 'Convidar Colegas (emails separados por vírgula ou linha)'
                    : 'Invite Colleagues (emails separated by comma or line)'}
                </label>
                <textarea
                  rows={3}
                  placeholder={
                    outputLanguage === 'pt'
                      ? 'colega1@universidade.pt\ncolega2@gmail.com'
                      : 'colleague1@university.edu\ncolleague2@gmail.com'
                  }
                  value={memberEmailsInput}
                  onChange={(e) => setMemberEmailsInput(e.target.value)}
                  className="w-full bg-canvas border border-line-strong rounded-xl px-3 py-2 text-xs text-ink placeholder:text-faint focus:outline-none focus:border-accent"
                />
                <p className="text-xs text-faint">
                  {outputLanguage === 'pt'
                    ? 'Os colegas convidados terão acesso direto aos apontamentos e à Master Note assim que iniciarem sessão.'
                    : 'Invited colleagues will gain instant access to lecture notes and the Master Note upon signing in.'}
                </p>
              </div>

              <div className="p-3 bg-accent-soft border border-accent-line rounded-xl text-xs text-accent-ink space-y-1">
                <div className="font-semibold flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{outputLanguage === 'pt' ? 'Estrutura Automática:' : 'Automatic Structure:'}</span>
                </div>
                <p className="text-muted text-xs">
                  {outputLanguage === 'pt'
                    ? 'A sala será criada com a hierarquia 3º Ano → 1º Semestre e as 8 cadeiras base prontas a receber apontamentos.'
                    : 'The room will be created with Year 3 → Semester 1 hierarchy and 8 core courses ready for notes.'}
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs text-muted hover:text-ink transition-colors cursor-pointer"
                >
                  {outputLanguage === 'pt' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={creating || !roomName.trim()}
                  className="px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-50 text-on-accent text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shadow-md"
                >
                  {creating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>
                    {creating
                      ? outputLanguage === 'pt'
                        ? 'A criar...'
                        : 'Creating...'
                      : outputLanguage === 'pt'
                      ? 'Criar Sala'
                      : 'Create Room'}
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
