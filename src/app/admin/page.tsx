'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Activity,
  Cpu,
  Database,
  HardDrive,
  Clock,
  Users,
  FileText,
  RefreshCw,
  ArrowLeft,
  ShieldCheck,
  AlertCircle,
  Zap,
  BarChart3,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { isUserAdmin } from '@/lib/auth/whitelist';
import type { AdminMetricsResponse } from '@/app/api/admin/metrics/route';

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AdminMetricsResponse | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email?: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // 1. Check user auth & admin status
  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth
        .getUser()
        .then(({ data: { user } }) => {
          if (user) {
            setCurrentUser({ email: user.email });
          }
          setAuthChecked(true);
        })
        .catch(() => {
          setAuthChecked(true);
        });
    } catch {
      setAuthChecked(true);
    }
  }, []);

  // 2. Fetch metrics
  const fetchMetrics = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const res = await fetch('/api/admin/metrics');
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || `HTTP ${res.status}: Access Denied.`);
      }
      const data: AdminMetricsResponse = await res.json();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar métricas.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authChecked) {
      fetchMetrics();
    }
  }, [authChecked, fetchMetrics]);

  // Unauthorized view
  const isAdmin = currentUser?.email && isUserAdmin(currentUser.email);

  if (authChecked && !isAdmin && !loading && error) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-slate-900 border border-rose-900/40 rounded-2xl p-8 text-center space-y-5 shadow-2xl">
          <div className="inline-flex p-3 bg-rose-950/60 border border-rose-800/40 rounded-2xl text-rose-400">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-white tracking-tight">Acesso de Administrador Restrito</h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              O painel de telemetria é estritamente exclusivo a administradores autorizados da plataforma.
              A tua sessão atual ({currentUser?.email || 'anónimo'}) não tem privilégios de administrador.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Studio</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-indigo-500/30 font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-50 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Link
            href="/"
            className="p-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
            title="Voltar ao Studio"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>

          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-lg shadow-md shadow-indigo-500/20">
              <Activity className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm tracking-tight text-white">SynapseVault</span>
                <span className="px-1.5 py-0.5 text-[10px] uppercase font-mono font-bold tracking-wider bg-indigo-950 border border-indigo-700 text-indigo-300 rounded">
                  Admin Telemetry
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-mono">Consola de Infraestrutura & Consumos</p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {currentUser?.email && (
            <div className="flex items-center space-x-1.5 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-lg text-xs font-mono text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>{currentUser.email}</span>
            </div>
          )}

          <button
            onClick={() => fetchMetrics(true)}
            disabled={refreshing || loading}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors shadow-sm shadow-indigo-600/20"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'A atualizar...' : 'Atualizar'}</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="p-4 bg-rose-950/40 border border-rose-900/60 rounded-xl flex items-center space-x-3 text-rose-300 text-xs">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-slate-900 border border-slate-800 rounded-xl" />
            ))}
          </div>
        )}

        {metrics && (
          <>
            {/* Primary KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Groq Whisper STT */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
                    Groq Whisper STT
                  </span>
                  <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-bold font-mono text-white tracking-tight">
                    {metrics.groq.totalMinutesTranscribed} <span className="text-sm font-normal text-slate-400">min</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {metrics.groq.totalHoursTranscribed} h total ({metrics.groq.totalSecondsTranscribed.toLocaleString()} s)
                  </div>
                </div>

                {/* Groq Hourly Limit Bar */}
                <div className="space-y-1.5 pt-1 border-t border-slate-800/60">
                  <div className="flex justify-between text-[11px] font-mono">
                    <span className="text-slate-400">Quota Horária (7200s):</span>
                    <span className={metrics.groq.percentHourlyQuotaUsed > 80 ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                      {metrics.groq.lastHourAudioSeconds}s ({metrics.groq.percentHourlyQuotaUsed}%)
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        metrics.groq.percentHourlyQuotaUsed > 80 ? 'bg-rose-500' : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(2, metrics.groq.percentHourlyQuotaUsed)}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-slate-500 font-mono">
                    Modelo: {metrics.groq.sttModel}
                  </div>
                </div>
              </div>

              {/* Card 2: Google Gemini Tokens */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
                    Google Gemini AI
                  </span>
                  <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg text-indigo-400">
                    <Cpu className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-bold font-mono text-white tracking-tight">
                    {metrics.gemini.estimatedTokens.total.toLocaleString()}{' '}
                    <span className="text-sm font-normal text-slate-400">tokens</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {metrics.gemini.totalCalls} chamadas de síntese
                  </div>
                </div>

                <div className="space-y-1 pt-1 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
                  <div className="flex justify-between">
                    <span>Input est.:</span>
                    <span className="text-slate-200">{metrics.gemini.estimatedTokens.input.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Output est.:</span>
                    <span className="text-slate-200">{metrics.gemini.estimatedTokens.output.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-indigo-300">
                    <span>Custo Estimado:</span>
                    <span>$0.00 (Free Tier)</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Cloudflare R2 Ephemeral */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
                    Cloudflare R2 Storage
                  </span>
                  <div className="p-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-emerald-400">
                    <HardDrive className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-bold font-mono text-emerald-400 tracking-tight flex items-center space-x-2">
                    <span>{metrics.r2.persistentStorageMb.toFixed(2)} MB</span>
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 inline" />
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Armazenamento permanente
                  </div>
                </div>

                <div className="space-y-1 pt-1 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
                  <div className="flex justify-between">
                    <span>Ficheiros auto-expurgados:</span>
                    <span className="text-slate-200">{metrics.r2.totalFilesAutoPurged}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vol. efêmero processado:</span>
                    <span className="text-slate-200">~{metrics.r2.estimatedProcessedMb} MB</span>
                  </div>
                  <div className="text-[10px] text-emerald-400/90 font-mono truncate">
                    Invariant: Purge imediato pós-leitura
                  </div>
                </div>
              </div>

              {/* Card 4: Supabase PostgreSQL */}
              <div className="bg-slate-900/80 border border-slate-800/80 rounded-xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wider font-mono">
                    Supabase PostgreSQL
                  </span>
                  <div className="p-2 bg-sky-500/10 border border-sky-500/20 rounded-lg text-sky-400">
                    <Database className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-bold font-mono text-white tracking-tight">
                    {metrics.summary.totalNotes} <span className="text-sm font-normal text-slate-400">notas</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {metrics.summary.activeCoursesCount} cadeiras ativas • {metrics.summary.uniqueStudentsCount} utilizadores
                  </div>
                </div>

                <div className="space-y-1 pt-1 border-t border-slate-800/60 text-[11px] font-mono text-slate-400">
                  <div className="flex justify-between">
                    <span>Notas com Áudio:</span>
                    <span className="text-slate-200">{metrics.summary.audioNotesCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Notas com Slides/PDF:</span>
                    <span className="text-slate-200">{metrics.summary.pdfNotesCount} ({metrics.summary.totalPdfPages} págs)</span>
                  </div>
                  <div className="flex justify-between text-sky-300">
                    <span>Segurança:</span>
                    <span>RLS + Whitelist Ativa</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Model Distribution & Student Utilization */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gemini Models Distribution */}
              <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-indigo-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-white">
                    Distribuição de Modelos Gemini
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {Object.entries(metrics.gemini.modelDistribution).length === 0 ? (
                    <div className="text-xs text-slate-500 italic py-2">Nenhum registo ainda</div>
                  ) : (
                    Object.entries(metrics.gemini.modelDistribution).map(([model, count]) => {
                      const pct = Math.round((count / metrics.gemini.totalCalls) * 100);
                      return (
                        <div key={model} className="space-y-1">
                          <div className="flex justify-between text-xs font-mono">
                            <span className="text-slate-300 font-semibold">{model}</span>
                            <span className="text-slate-400">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div className="bg-indigo-500 h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Student Whitelist Activity */}
              <div className="lg:col-span-2 bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-white">
                    Utilizadores & Alunos ({metrics.studentBreakdown.length})
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs font-mono">
                    <thead>
                      <tr className="border-b border-slate-800 text-slate-400">
                        <th className="pb-2">Email</th>
                        <th className="pb-2 text-center">Notas Criadas</th>
                        <th className="pb-2 text-right">Última Atividade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {metrics.studentBreakdown.map((student) => (
                        <tr key={student.email} className="hover:bg-slate-800/30">
                          <td className="py-2.5 text-slate-200 flex items-center space-x-2">
                            <span>{student.email}</span>
                            {isUserAdmin(student.email) && (
                              <span className="px-1.5 py-0.2 text-[9px] bg-indigo-950 text-indigo-300 border border-indigo-700 rounded font-semibold uppercase">
                                Admin
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-center text-slate-300 font-semibold">{student.notesCount}</td>
                          <td className="py-2.5 text-right text-slate-400">
                            {new Date(student.lastActive).toLocaleString('pt-PT', {
                              dateStyle: 'short',
                              timeStyle: 'short',
                            })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Course Activity Table */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-white">
                  Consumos & Sínteses por Cadeira Académica
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2">Cadeira</th>
                      <th className="pb-2 text-center">Total Notas</th>
                      <th className="pb-2 text-center">Áudio Transcrito</th>
                      <th className="pb-2 text-center">Páginas PDF</th>
                      <th className="pb-2 text-right">Tokens Estimados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {metrics.courseBreakdown.map((course) => (
                      <tr key={course.courseCode} className="hover:bg-slate-800/30">
                        <td className="py-2.5 text-slate-200 font-bold">
                          <span className="px-2 py-0.5 bg-slate-800 border border-slate-700 rounded">
                            {course.courseCode}
                          </span>
                        </td>
                        <td className="py-2.5 text-center text-slate-300">{course.notesCount}</td>
                        <td className="py-2.5 text-center text-slate-400">
                          {course.audioSeconds > 0 ? `${Math.round(course.audioSeconds / 60)} min (${course.audioSeconds}s)` : '—'}
                        </td>
                        <td className="py-2.5 text-center text-slate-400">
                          {course.pdfPages > 0 ? `${course.pdfPages} págs` : '—'}
                        </td>
                        <td className="py-2.5 text-right text-indigo-300 font-semibold">
                          ~{course.estimatedTokens.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Synthesis Audit Log */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-sky-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider font-mono text-white">
                    Histórico de Sínteses Recentes (Audit Log)
                  </h3>
                </div>
                <span className="text-[11px] text-slate-500 font-mono">Últimas {metrics.recentNotes.length} execuções</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="pb-2">Data/Hora</th>
                      <th className="pb-2">Cadeira</th>
                      <th className="pb-2">Título</th>
                      <th className="pb-2">Aluno</th>
                      <th className="pb-2">Modelo</th>
                      <th className="pb-2 text-center">Áudio</th>
                      <th className="pb-2 text-center">Slides</th>
                      <th className="pb-2 text-right">Tokens</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {metrics.recentNotes.map((note) => (
                      <tr key={note.id} className="hover:bg-slate-800/30">
                        <td className="py-2.5 text-slate-400 whitespace-nowrap">
                          {new Date(note.createdAt).toLocaleString('pt-PT', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })}
                        </td>
                        <td className="py-2.5 text-slate-300 font-semibold whitespace-nowrap">
                          <span className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[11px]">
                            {note.courseCode}
                          </span>
                        </td>
                        <td className="py-2.5 text-white max-w-[220px] truncate" title={note.title}>
                          {note.title}
                        </td>
                        <td className="py-2.5 text-slate-400 max-w-[160px] truncate" title={note.authorEmail}>
                          {note.authorEmail}
                        </td>
                        <td className="py-2.5 text-indigo-300 whitespace-nowrap text-[11px]">
                          {note.modelUsed}
                        </td>
                        <td className="py-2.5 text-center text-slate-400 whitespace-nowrap">
                          {note.audioDurationSeconds > 0 ? `${Math.round(note.audioDurationSeconds / 60)}m (${note.audioDurationSeconds}s)` : '—'}
                        </td>
                        <td className="py-2.5 text-center text-slate-400 whitespace-nowrap">
                          {note.pdfPagesProcessed > 0 ? `${note.pdfPagesProcessed}p` : '—'}
                        </td>
                        <td className="py-2.5 text-right text-slate-300 font-medium whitespace-nowrap">
                          ~{note.estimatedTokens.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
