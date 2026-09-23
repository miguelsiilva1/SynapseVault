'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Users,
  FolderTree,
  Plus,
  ArrowLeft,
  Sparkles,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  AlertCircle,
  RefreshCw,
  LogOut,
  GraduationCap,
  Globe,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import type { StudyRoomRecord } from '@/lib/db/rooms';

export default function RoomsHubPage() {
  const [currentUser, setCurrentUser] = useState<{ email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
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
  }, [currentUser]);

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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-40 px-6 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title={outputLanguage === 'pt' ? 'Voltar ao Studio' : 'Back to Studio'}
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-lg shadow-md shadow-indigo-500/20">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm tracking-tight text-white">SynapseVault</span>
                <span className="px-1.5 py-0.2 text-[10px] uppercase font-mono font-semibold tracking-wider bg-violet-950 border border-violet-700 text-violet-300 rounded">
                  Study Rooms
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {outputLanguage === 'pt'
                  ? 'NotebookLM Coletivo & Sínteses Partilhadas'
                  : 'Collective NotebookLM & Shared Synthesis'}
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

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors shadow-sm shadow-indigo-600/20 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{outputLanguage === 'pt' ? 'Criar Nova Sala' : 'Create New Room'}</span>
          </button>

          {currentUser?.email && (
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300 max-w-[140px] truncate">{currentUser.email}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-6 space-y-6">
        {/* Banner Section */}
        <div className="relative overflow-hidden bg-gradient-to-r from-indigo-950/60 via-slate-900 to-slate-900 border border-indigo-900/40 rounded-2xl p-6 shadow-xl">
          <div className="max-w-2xl space-y-2">
            <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-[11px] font-mono">
              <Sparkles className="w-3 h-3 text-indigo-400" />
              <span>Multiplayer Academic Vault</span>
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {outputLanguage === 'pt' ? 'Salas de Estudo Colaborativas' : 'Collaborative Study Rooms'}
            </h1>
            <p className="text-xs text-slate-300 leading-relaxed">
              {outputLanguage === 'pt' ? (
                <>
                  Organiza o teu semestre universitário com o teu grupo de estudo. Cada cadeira possui uma estrutura em árvore (
                  <code className="text-indigo-300">3º Ano → 1º Semestre → Cadeiras</code>) com uma <strong>Síntese Mestra (Master Note)</strong> que
                  evolui e se aprofunda automaticamente à medida que os alunos importam apontamentos e gravações.
                </>
              ) : (
                <>
                  Organize your academic semester with your study group. Each course features a folder hierarchy (
                  <code className="text-indigo-300">Year 3 → Semester 1 → Courses</code>) with an evolving <strong>Master Note</strong> that
                  deepens automatically as students import lecture notes and audio syntheses.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl flex items-center space-x-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Rooms Grid */}
        {loadingRooms ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-44 bg-slate-900 border border-slate-800 rounded-xl" />
            ))}
          </div>
        ) : rooms.length === 0 ? (
          <div className="bg-slate-900/50 border border-dashed border-slate-800 rounded-2xl p-12 text-center space-y-4">
            <div className="inline-flex p-3 bg-indigo-950/60 border border-indigo-800/40 rounded-2xl text-indigo-400">
              <FolderTree className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">
                {outputLanguage === 'pt' ? 'Nenhuma sala de estudo encontrada' : 'No study rooms found'}
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                {outputLanguage === 'pt'
                  ? 'Ainda não pertences a nenhuma sala. Cria a primeira sala para a tua turma e convida os teus colegas pelo email.'
                  : 'You do not belong to any room yet. Create the first room for your group and invite colleagues by email.'}
              </p>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer shadow-lg shadow-indigo-600/20"
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
                className="group bg-slate-900/80 hover:bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-xl p-5 space-y-4 transition-all duration-200 flex flex-col justify-between shadow-lg shadow-black/40 hover:-translate-y-0.5"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/40">
                      {room.role === 'owner'
                        ? outputLanguage === 'pt'
                          ? 'Criador / Admin'
                          : 'Creator / Admin'
                        : outputLanguage === 'pt'
                        ? 'Membro'
                        : 'Member'}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {new Date(room.created_at).toLocaleDateString(
                        outputLanguage === 'pt' ? 'pt-PT' : 'en-US'
                      )}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {room.name}
                  </h3>

                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                    {room.description ||
                      (outputLanguage === 'pt'
                        ? 'Sala de estudo colaborativa com hierarquia curricular e Master Knowledge Base.'
                        : 'Collaborative study room with academic hierarchy and Master Knowledge Base.')}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/60 flex items-center justify-between text-xs font-mono">
                  <div className="flex items-center space-x-1.5 text-slate-400">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {outputLanguage === 'pt' ? '8 Cadeiras Base' : '8 Core Courses'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 text-indigo-400 group-hover:text-indigo-300 font-semibold">
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
          <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <FolderTree className="w-5 h-5 text-indigo-400" />
                <h2 className="text-base font-bold text-white">
                  {outputLanguage === 'pt' ? 'Criar Nova Sala de Estudo' : 'Create New Study Room'}
                </h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRoom} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
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
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-mono"
                />
                <p className="text-[10px] text-slate-500">
                  {outputLanguage === 'pt'
                    ? 'Os colegas convidados terão acesso direto aos apontamentos e à Master Note assim que iniciarem sessão.'
                    : 'Invited colleagues will gain instant access to lecture notes and the Master Note upon signing in.'}
                </p>
              </div>

              <div className="p-3 bg-indigo-950/40 border border-indigo-900/60 rounded-xl text-[11px] text-indigo-300 space-y-1 font-mono">
                <div className="font-semibold flex items-center space-x-1">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{outputLanguage === 'pt' ? 'Estrutura Automática:' : 'Automatic Structure:'}</span>
                </div>
                <p className="text-slate-400 text-[10px]">
                  {outputLanguage === 'pt'
                    ? 'A sala será criada com a hierarquia 3º Ano → 1º Semestre e as 8 cadeiras base prontas a receber apontamentos.'
                    : 'The room will be created with Year 3 → Semester 1 hierarchy and 8 core courses ready for notes.'}
                </p>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  {outputLanguage === 'pt' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={creating || !roomName.trim()}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer flex items-center space-x-1.5 shadow-md shadow-indigo-600/20"
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
