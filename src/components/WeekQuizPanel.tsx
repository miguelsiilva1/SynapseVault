'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ListChecks,
  Sparkles,
  RefreshCw,
  Trash2,
  Copy,
  CheckCircle2,
  Download,
  RotateCcw,
  Eye,
  AlertCircle,
} from 'lucide-react';
import { renderMarkdown } from '@/lib/utils/markdownRenderer';
import type { RoomFolderRecord, RoomNoteRecord, RoomQuizRecord, QuizQuestion } from '@/lib/db/rooms';

interface WeekQuizPanelProps {
  roomId: string;
  folderId: string;
  weeks: RoomFolderRecord[];
  notes: RoomNoteRecord[];
  outputLanguage: 'pt' | 'en';
  currentUserEmail?: string;
  isOwner: boolean;
}

function quizToMarkdown(quiz: RoomQuizRecord): string {
  const lines = [`# ${quiz.title}`, '', `Semanas: ${quiz.week_names.join(', ')}`, ''];
  quiz.questions.forEach((q, i) => {
    lines.push(`## ${i + 1}. ${q.question}`, '');
    if (q.type === 'mcq' && q.options) {
      q.options.forEach((o, j) => lines.push(`${String.fromCharCode(65 + j)}) ${o}`));
      lines.push('');
    }
    lines.push('> [!QUESTION]- Resposta', `> ${q.answer.replace(/\n/g, '\n> ')}`);
    if (q.explanation) lines.push('>', `> ${q.explanation.replace(/\n/g, '\n> ')}`);
    lines.push('');
  });
  return lines.join('\n');
}

function Md({ text, className = '' }: { text: string; className?: string }) {
  const html = useMemo(() => renderMarkdown(text), [text]);
  return <div className={`markdown-body ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function WeekQuizPanel({
  roomId,
  folderId,
  weeks,
  notes,
  outputLanguage,
  currentUserEmail,
  isOwner,
}: WeekQuizPanelProps) {
  const pt = outputLanguage === 'pt';

  const [quizzes, setQuizzes] = useState<RoomQuizRecord[]>([]);
  const [loadingQuizzes, setLoadingQuizzes] = useState(false);
  const [selectedWeekIds, setSelectedWeekIds] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);
  const [deletingQuizId, setDeletingQuizId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Per-question state for the active quiz: chosen option (mcq) or revealed answer (open)
  const [chosen, setChosen] = useState<Record<number, number>>({});
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const activeQuiz = quizzes.find((q) => q.id === activeQuizId) || null;

  useEffect(() => {
    const load = async () => {
      setLoadingQuizzes(true);
      try {
        const res = await fetch(`/api/rooms/${roomId}/quizzes?folderId=${folderId}`);
        if (res.ok) {
          const data = await res.json();
          setQuizzes(data.quizzes || []);
        }
      } catch {
        // non-blocking
      } finally {
        setLoadingQuizzes(false);
      }
    };
    load();
  }, [roomId, folderId]);

  useEffect(() => {
    setChosen({});
    setRevealed({});
  }, [activeQuizId]);

  const toggleWeek = (id: string) => {
    setSelectedWeekIds((prev) => (prev.includes(id) ? prev.filter((w) => w !== id) : [...prev, id]));
  };

  const handleGenerate = async () => {
    if (selectedWeekIds.length === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch(`/api/rooms/${roomId}/quizzes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderId,
          weekFolderIds: selectedWeekIds,
          instructions,
          outputLanguage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate quiz.');
      setQuizzes((prev) => [data.quiz, ...prev]);
      setActiveQuizId(data.quiz.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async (quiz: RoomQuizRecord) => {
    if (!confirm(pt ? `Apagar o questionário "${quiz.title}"?` : `Delete quiz "${quiz.title}"?`)) return;
    setDeletingQuizId(quiz.id);
    try {
      const res = await fetch(`/api/rooms/${roomId}/quizzes?quizId=${quiz.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete quiz.');
      setQuizzes((prev) => prev.filter((q) => q.id !== quiz.id));
      if (activeQuizId === quiz.id) setActiveQuizId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeletingQuizId(null);
    }
  };

  const handleCopy = () => {
    if (!activeQuiz) return;
    navigator.clipboard.writeText(quizToMarkdown(activeQuiz));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!activeQuiz) return;
    const blob = new Blob([quizToMarkdown(activeQuiz)], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `${activeQuiz.title.replace(/[^a-z0-9]/gi, '_')}_Quiz.md`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  };

  const mcqTotal = activeQuiz?.questions.filter((q) => q.type === 'mcq').length || 0;
  const mcqAnswered = Object.keys(chosen).length;
  const mcqCorrect = activeQuiz
    ? Object.entries(chosen).filter(([i, c]) => activeQuiz.questions[Number(i)]?.correctIndex === c).length
    : 0;

  const canDelete = (quiz: RoomQuizRecord) =>
    isOwner ||
    Boolean(currentUserEmail && quiz.created_by_email.toLowerCase() === currentUserEmail.toLowerCase());

  const renderQuestion = (q: QuizQuestion, i: number) => {
    const pick = chosen[i];
    const answered = pick !== undefined;
    const showAnswer = q.type === 'mcq' ? answered : revealed[i];

    return (
      <div key={i} className="bg-surface border border-line rounded-xl p-5 space-y-3">
        <div className="flex items-center gap-2 text-xs">
          <span className="font-bold text-accent-ink">{i + 1}.</span>
          {q.week && (
            <span className="px-1.5 py-0.5 rounded bg-warn-soft border border-warn-line text-warn font-bold">
              {q.week}
            </span>
          )}
          <span className="px-1.5 py-0.5 rounded bg-raised border border-line-strong text-ink-soft">
            {q.type === 'mcq' ? (pt ? 'Escolha múltipla' : 'Multiple choice') : pt ? 'Resposta aberta' : 'Open answer'}
          </span>
        </div>

        <Md text={q.question} className="text-sm font-semibold text-ink" />

        {q.type === 'mcq' && q.options ? (
          <div className="space-y-2">
            {q.options.map((opt, j) => {
              const isCorrect = j === q.correctIndex;
              const state = !answered
                ? 'bg-surface hover:bg-raised border-line-strong cursor-pointer'
                : isCorrect
                ? 'bg-ok-soft border-ok-line text-ok'
                : j === pick
                ? 'bg-danger-soft border-danger-line text-danger'
                : 'bg-surface border-line opacity-60';
              return (
                <button
                  key={j}
                  disabled={answered}
                  onClick={() => setChosen((prev) => ({ ...prev, [i]: j }))}
                  className={`w-full text-left flex items-start gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${state}`}
                >
                  <span className="font-bold">{String.fromCharCode(65 + j)})</span>
                  <Md text={opt} className="flex-1" />
                </button>
              );
            })}
          </div>
        ) : (
          !showAnswer && (
            <button
              onClick={() => setRevealed((prev) => ({ ...prev, [i]: true }))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-raised hover:bg-raised-strong text-ink text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>{pt ? 'Mostrar resposta' : 'Show answer'}</span>
            </button>
          )
        )}

        {showAnswer && (
          <div className="border-t border-line pt-3 space-y-2 text-sm">
            {q.type === 'open' && <Md text={q.answer} className="text-ink" />}
            {q.explanation && <Md text={q.explanation} className="text-muted" />}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6 items-start">
        {/* Generator form and saved quizzes */}
        <div className="space-y-4">
          <div className="bg-surface border border-line rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-accent-ink" />
              <h3 className="text-sm font-bold text-ink">{pt ? 'Novo questionário' : 'New quiz'}</h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-ink-soft">{pt ? 'Semanas' : 'Weeks'}</span>
                {weeks.length > 0 && (
                  <button
                    onClick={() =>
                      setSelectedWeekIds(
                        selectedWeekIds.length === weeks.length ? [] : weeks.map((w) => w.id)
                      )
                    }
                    className="text-accent-ink hover:text-ink cursor-pointer"
                  >
                    {selectedWeekIds.length === weeks.length
                      ? pt ? 'Limpar' : 'Clear'
                      : pt ? 'Selecionar todas' : 'Select all'}
                  </button>
                )}
              </div>
              {weeks.length === 0 ? (
                <p className="text-xs text-faint italic">
                  {pt ? 'Ainda não há semanas nesta cadeira.' : 'No weeks in this course yet.'}
                </p>
              ) : (
                <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                  {weeks.map((week) => {
                    const count = notes.filter((n) => n.folder_id === week.id).length;
                    return (
                      <label
                        key={week.id}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-raised cursor-pointer text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedWeekIds.includes(week.id)}
                          onChange={() => toggleWeek(week.id)}
                          className="accent-accent"
                        />
                        <span className="flex-1 text-ink truncate">{week.name}</span>
                        <span className="text-xs text-faint">
                          {count} {pt ? 'aula(s)' : 'lecture(s)'}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-ink-soft">
                {pt ? 'Como queres as perguntas? (opcional)' : 'How should the questions be? (optional)'}
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={7}
                maxLength={5000}
                placeholder={
                  pt
                    ? 'Ex: 15 perguntas de escolha múltipla ao estilo do exame, dificuldade alta. Exemplo de pergunta:\n"Qual das seguintes afirmações sobre o ponto crítico das vendas é verdadeira?"'
                    : 'E.g. 15 exam-style multiple choice questions, hard. Example question:\n"Which of the following statements about the break-even point is true?"'
                }
                className="w-full bg-canvas border border-line-strong rounded-lg p-3 text-sm text-ink placeholder:text-faint focus:outline-none focus:border-accent resize-y"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 text-xs text-danger bg-danger-soft border border-danger-line rounded-lg p-2.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              onClick={handleGenerate}
              disabled={generating || selectedWeekIds.length === 0}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 bg-accent hover:bg-accent-hover disabled:opacity-40 text-on-accent text-sm font-semibold rounded-lg transition-colors cursor-pointer shadow-sm"
            >
              {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              <span>
                {generating
                  ? pt ? 'A gerar...' : 'Generating...'
                  : pt ? `Gerar questionário (${selectedWeekIds.length})` : `Generate quiz (${selectedWeekIds.length})`}
              </span>
            </button>
          </div>

          <div className="bg-surface border border-line rounded-xl p-5 space-y-3">
            <h3 className="text-sm font-bold text-ink">{pt ? 'Questionários da sala' : 'Room quizzes'}</h3>
            {loadingQuizzes ? (
              <div className="h-10 bg-raised rounded animate-pulse" />
            ) : quizzes.length === 0 ? (
              <p className="text-xs text-faint italic">{pt ? 'Nenhum questionário ainda.' : 'No quizzes yet.'}</p>
            ) : (
              <div className="space-y-1.5">
                {quizzes.map((quiz) => (
                  <div
                    key={quiz.id}
                    className={`flex items-start gap-2 p-2.5 rounded-lg border transition-colors ${
                      quiz.id === activeQuizId ? 'bg-accent-soft border-accent-line' : 'border-transparent hover:bg-raised'
                    }`}
                  >
                    <button onClick={() => setActiveQuizId(quiz.id)} className="flex-1 text-left cursor-pointer min-w-0">
                      <div className="text-sm font-semibold text-ink truncate">{quiz.title}</div>
                      <div className="text-xs text-muted truncate">
                        {quiz.questions.length} {pt ? 'perguntas' : 'questions'} • {quiz.week_names.join(', ')}
                      </div>
                      <div className="text-xs text-faint truncate">
                        {quiz.created_by_email} •{' '}
                        {new Date(quiz.created_at).toLocaleDateString(pt ? 'pt-PT' : 'en-US')}
                      </div>
                    </button>
                    {canDelete(quiz) && (
                      <button
                        onClick={() => handleDelete(quiz)}
                        disabled={deletingQuizId === quiz.id}
                        title={pt ? 'Apagar questionário' : 'Delete quiz'}
                        className="p-1.5 hover:bg-danger-soft rounded text-muted hover:text-danger cursor-pointer"
                      >
                        {deletingQuizId === quiz.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Active quiz */}
        {activeQuiz ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1">
                <h3 className="text-base font-bold text-ink">{activeQuiz.title}</h3>
                <p className="text-xs text-muted">
                  {activeQuiz.week_names.join(', ')}
                  {mcqTotal > 0 && (
                    <>
                      {' • '}
                      <span className="font-semibold text-ink-soft">
                        {mcqCorrect}/{mcqAnswered} {pt ? 'certas' : 'correct'} ({mcqAnswered}/{mcqTotal}{' '}
                        {pt ? 'respondidas' : 'answered'})
                      </span>
                    </>
                  )}
                </p>
                {activeQuiz.instructions && (
                  <p className="text-xs text-faint line-clamp-2" title={activeQuiz.instructions}>
                    {pt ? 'Prompt: ' : 'Prompt: '}
                    {activeQuiz.instructions}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => {
                    setChosen({});
                    setRevealed({});
                  }}
                  className="px-2.5 py-1 bg-surface hover:bg-raised border border-line-strong text-ink-soft hover:text-ink rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>{pt ? 'Recomeçar' : 'Restart'}</span>
                </button>
                <button
                  onClick={handleCopy}
                  className="px-2.5 py-1 bg-surface hover:bg-raised border border-line-strong text-ink-soft hover:text-ink rounded flex items-center gap-1.5 cursor-pointer"
                >
                  {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? (pt ? 'Copiado!' : 'Copied!') : pt ? 'Copiar' : 'Copy'}</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="px-2.5 py-1 bg-surface hover:bg-raised border border-line-strong text-ink-soft hover:text-ink rounded flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .md</span>
                </button>
              </div>
            </div>
            {activeQuiz.questions.map(renderQuestion)}
          </div>
        ) : (
          <div className="bg-surface border border-dashed border-line rounded-xl p-8 text-center space-y-3">
            <div className="inline-flex p-3 bg-accent-soft border border-accent-line rounded-xl text-accent-ink">
              <ListChecks className="w-8 h-8" />
            </div>
            <h3 className="text-base font-bold text-ink">{pt ? 'Questionários por semana' : 'Weekly quizzes'}</h3>
            <p className="text-xs text-muted leading-relaxed max-w-md mx-auto">
              {pt
                ? 'Escolhe as semanas, escreve como queres as perguntas (tipo, número, dificuldade, exemplos) e gera. A IA usa a Master Note de cada semana, ou as aulas importadas se não houver Master Note. Os questionários ficam guardados para toda a sala.'
                : 'Pick the weeks, describe the questions you want (type, count, difficulty, examples) and generate. The AI uses each week’s Master Note, or its imported lectures when there is none. Quizzes are saved for the whole room.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
