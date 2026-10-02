'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Cpu,
  Database,
  HardDrive,
  Users,
  FileText,
  RefreshCw,
  ArrowLeft,
  AlertCircle,
  Zap,
  BarChart3,
  Layers,
  CheckCircle2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import AppHeader from '@/components/AppHeader';
import type { AdminMetricsResponse } from '@/app/api/admin/metrics/route';

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<AdminMetricsResponse | null>(null);
  const [currentUser, setCurrentUser] = useState<{ email?: string } | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

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
      setAccessDenied(res.status === 401 || res.status === 403);
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
  if (authChecked && accessDenied && !loading) {
    return (
      <div className="min-h-screen bg-canvas text-ink flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-surface border border-danger-line rounded-xl p-8 text-center space-y-5 shadow-2xl">
          <div className="inline-flex p-3 bg-danger-soft border border-danger-line rounded-xl text-danger">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-ink tracking-tight">Acesso de Administrador Restrito</h2>
            <p className="text-xs text-muted leading-relaxed">
              O painel de telemetria é estritamente exclusivo a administradores autorizados da plataforma.
              A tua sessão atual ({currentUser?.email || 'anónimo'}) não tem privilégios de administrador.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center space-x-2 px-4 py-2.5 bg-raised hover:bg-raised-strong text-ink text-xs font-medium rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao Studio</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink selection:bg-accent-soft font-sans">
      {/* Top Navbar */}
      <AppHeader active="admin" language="pt" email={currentUser?.email}>
        <button
          onClick={() => fetchMetrics(true)}
          disabled={refreshing || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs font-medium text-ink-soft hover:bg-raised disabled:opacity-50 transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'A atualizar...' : 'Atualizar'}</span>
        </button>
      </AppHeader>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Error Banner */}
        {error && (
          <div className="p-4 bg-danger-soft border border-danger-line rounded-xl flex items-center space-x-3 text-danger text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading && !metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-surface border border-line rounded-xl" />
            ))}
          </div>
        )}

        {metrics && (
          <>
            {/* Primary KPI Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Groq Whisper STT */}
              <div className="bg-surface border border-line rounded-xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">
                    Groq Whisper STT
                  </span>
                  <div className="p-2 bg-warn-soft border border-warn-line rounded-lg text-warn">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-bold text-ink tracking-tight">
                    {metrics.groq.totalMinutesTranscribed} <span className="text-sm font-normal text-muted">min</span>
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {metrics.groq.totalHoursTranscribed} h total ({metrics.groq.totalSecondsTranscribed.toLocaleString()} s)
                  </div>
                </div>

                {/* Groq Hourly Limit Bar */}
                <div className="space-y-1.5 pt-1 border-t border-line">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted">Quota Horária (7200s):</span>
                    <span className={metrics.groq.percentHourlyQuotaUsed > 80 ? 'text-danger font-bold' : 'text-ok'}>
                      {metrics.groq.lastHourAudioSeconds}s ({metrics.groq.percentHourlyQuotaUsed}%)
                    </span>
                  </div>
                  <div className="w-full bg-raised h-1.5 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        metrics.groq.percentHourlyQuotaUsed > 80 ? 'bg-danger-solid-hover' : 'bg-ok-solid-hover'
                      }`}
                      style={{ width: `${Math.max(2, metrics.groq.percentHourlyQuotaUsed)}%` }}
                    />
                  </div>
                  <div className="text-xs text-faint">
                    Modelo: {metrics.groq.sttModel}
                  </div>
                </div>
              </div>

              {/* Card 2: Google Gemini Tokens */}
              <div className="bg-surface border border-line rounded-xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">
                    Google Gemini AI
                  </span>
                  <div className="p-2 bg-accent-soft border border-accent-line rounded-lg text-accent-ink">
                    <Cpu className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-bold text-ink tracking-tight">
                    {metrics.gemini.estimatedTokens.total.toLocaleString()}{' '}
                    <span className="text-sm font-normal text-muted">tokens</span>
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {metrics.gemini.totalCalls} chamadas de síntese
                  </div>
                </div>

                <div className="space-y-1 pt-1 border-t border-line text-xs text-muted">
                  <div className="flex justify-between">
                    <span>Input est.:</span>
                    <span className="text-ink">{metrics.gemini.estimatedTokens.input.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Output est.:</span>
                    <span className="text-ink">{metrics.gemini.estimatedTokens.output.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-accent-ink">
                    <span>Custo Estimado:</span>
                    <span>$0.00 (Free Tier)</span>
                  </div>
                </div>
              </div>

              {/* Card 3: Cloudflare R2 Ephemeral */}
              <div className="bg-surface border border-line rounded-xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">
                    Cloudflare R2 Storage
                  </span>
                  <div className="p-2 bg-ok-soft border border-ok-line rounded-lg text-ok">
                    <HardDrive className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-bold text-ok tracking-tight flex items-center space-x-2">
                    <span>{metrics.r2.persistentStorageMb.toFixed(2)} MB</span>
                    <CheckCircle2 className="w-5 h-5 text-ok inline" />
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    Armazenamento permanente
                  </div>
                </div>

                <div className="space-y-1 pt-1 border-t border-line text-xs text-muted">
                  <div className="flex justify-between">
                    <span>Ficheiros auto-expurgados:</span>
                    <span className="text-ink">{metrics.r2.totalFilesAutoPurged}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Vol. efêmero processado:</span>
                    <span className="text-ink">~{metrics.r2.estimatedProcessedMb} MB</span>
                  </div>
                  <div className="text-xs text-ok truncate">
                    Invariant: Purge imediato pós-leitura
                  </div>
                </div>
              </div>

              {/* Card 4: Supabase PostgreSQL */}
              <div className="bg-surface border border-line rounded-xl p-5 space-y-3 relative overflow-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-muted">
                    Supabase PostgreSQL
                  </span>
                  <div className="p-2 bg-info-soft border border-info-line rounded-lg text-info">
                    <Database className="w-4 h-4" />
                  </div>
                </div>

                <div>
                  <div className="text-2xl font-bold text-ink tracking-tight">
                    {metrics.summary.totalNotes} <span className="text-sm font-normal text-muted">notas</span>
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {metrics.summary.activeCoursesCount} cadeiras ativas • {metrics.summary.uniqueStudentsCount} utilizadores
                  </div>
                </div>

                <div className="space-y-1 pt-1 border-t border-line text-xs text-muted">
                  <div className="flex justify-between">
                    <span>Notas com Áudio:</span>
                    <span className="text-ink">{metrics.summary.audioNotesCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Notas com Slides/PDF:</span>
                    <span className="text-ink">{metrics.summary.pdfNotesCount} ({metrics.summary.totalPdfPages} págs)</span>
                  </div>
                  <div className="flex justify-between text-info">
                    <span>Segurança:</span>
                    <span>RLS + Whitelist Ativa</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Model Distribution & Student Utilization */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Gemini Models Distribution */}
              <div className="bg-surface border border-line rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2">
                  <Layers className="w-4 h-4 text-accent-ink" />
                  <h3 className="text-xs font-bold text-ink">
                    Distribuição de Modelos Gemini
                  </h3>
                </div>

                <div className="space-y-2.5">
                  {Object.entries(metrics.gemini.modelDistribution).length === 0 ? (
                    <div className="text-xs text-faint italic py-2">Nenhum registo ainda</div>
                  ) : (
                    Object.entries(metrics.gemini.modelDistribution).map(([model, count]) => {
                      const pct = Math.round((count / metrics.gemini.totalCalls) * 100);
                      return (
                        <div key={model} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-ink-soft font-semibold">{model}</span>
                            <span className="text-muted">
                              {count} ({pct}%)
                            </span>
                          </div>
                          <div className="w-full bg-raised h-1.5 rounded-full overflow-hidden">
                            <div className="bg-accent-hover h-full rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Student Whitelist Activity */}
              <div className="lg:col-span-2 bg-surface border border-line rounded-xl p-5 space-y-4">
                <div className="flex items-center space-x-2">
                  <Users className="w-4 h-4 text-ok" />
                  <h3 className="text-xs font-bold text-ink">
                    Utilizadores & Alunos ({metrics.studentBreakdown.length})
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-line text-muted">
                        <th className="pb-2">Email</th>
                        <th className="pb-2 text-center">Notas Criadas</th>
                        <th className="pb-2 text-right">Última Atividade</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {metrics.studentBreakdown.map((student) => (
                        <tr key={student.email} className="hover:bg-raised">
                          <td className="py-2.5 text-ink flex items-center space-x-2">
                            <span>{student.email}</span>
                            {student.isAdmin && (
                              <span className="px-1.5 py-0.2 text-xs bg-accent-soft text-accent-ink border border-accent-line rounded font-semibold">
                                Admin
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-center text-ink-soft font-semibold">{student.notesCount}</td>
                          <td className="py-2.5 text-right text-muted">
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
            <div className="bg-surface border border-line rounded-xl p-5 space-y-4">
              <div className="flex items-center space-x-2">
                <BarChart3 className="w-4 h-4 text-warn" />
                <h3 className="text-xs font-bold text-ink">
                  Consumos & Sínteses por Cadeira Académica
                </h3>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-muted">
                      <th className="pb-2">Cadeira</th>
                      <th className="pb-2 text-center">Total Notas</th>
                      <th className="pb-2 text-center">Áudio Transcrito</th>
                      <th className="pb-2 text-center">Páginas PDF</th>
                      <th className="pb-2 text-right">Tokens Estimados</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {metrics.courseBreakdown.map((course) => (
                      <tr key={course.courseCode} className="hover:bg-raised">
                        <td className="py-2.5 text-ink font-bold">
                          <span className="px-2 py-0.5 bg-raised border border-line-strong rounded">
                            {course.courseCode}
                          </span>
                        </td>
                        <td className="py-2.5 text-center text-ink-soft">{course.notesCount}</td>
                        <td className="py-2.5 text-center text-muted">
                          {course.audioSeconds > 0 ? `${Math.round(course.audioSeconds / 60)} min (${course.audioSeconds}s)` : '—'}
                        </td>
                        <td className="py-2.5 text-center text-muted">
                          {course.pdfPages > 0 ? `${course.pdfPages} págs` : '—'}
                        </td>
                        <td className="py-2.5 text-right text-accent-ink font-semibold">
                          ~{course.estimatedTokens.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Recent Synthesis Audit Log */}
            <div className="bg-surface border border-line rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4 text-info" />
                  <h3 className="text-xs font-bold text-ink">
                    Histórico de Sínteses Recentes (Audit Log)
                  </h3>
                </div>
                <span className="text-xs text-faint">Últimas {metrics.recentNotes.length} execuções</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-line text-muted">
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
                  <tbody className="divide-y divide-line">
                    {metrics.recentNotes.map((note) => (
                      <tr key={note.id} className="hover:bg-raised">
                        <td className="py-2.5 text-muted whitespace-nowrap">
                          {new Date(note.createdAt).toLocaleString('pt-PT', {
                            dateStyle: 'short',
                            timeStyle: 'medium',
                          })}
                        </td>
                        <td className="py-2.5 text-ink-soft font-semibold whitespace-nowrap">
                          <span className="px-1.5 py-0.5 bg-raised border border-line-strong rounded text-xs">
                            {note.courseCode}
                          </span>
                        </td>
                        <td className="py-2.5 text-ink max-w-55 truncate" title={note.title}>
                          {note.title}
                        </td>
                        <td className="py-2.5 text-muted max-w-40 truncate" title={note.authorEmail}>
                          {note.authorEmail}
                        </td>
                        <td className="py-2.5 text-accent-ink whitespace-nowrap text-xs">
                          {note.modelUsed}
                        </td>
                        <td className="py-2.5 text-center text-muted whitespace-nowrap">
                          {note.audioDurationSeconds > 0 ? `${Math.round(note.audioDurationSeconds / 60)}m (${note.audioDurationSeconds}s)` : '—'}
                        </td>
                        <td className="py-2.5 text-center text-muted whitespace-nowrap">
                          {note.pdfPagesProcessed > 0 ? `${note.pdfPagesProcessed}p` : '—'}
                        </td>
                        <td className="py-2.5 text-right text-ink-soft font-medium whitespace-nowrap">
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
