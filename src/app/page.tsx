'use client';

import React, { useState, useEffect } from 'react';
import {
  FileAudio,
  FileText,
  Upload,
  Cpu,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Zap,
  Plus,
  Globe,
  Settings,
  X,
  User,
  LogIn,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { compressAudio } from '@/lib/audio/compressAudio';
import { createClient } from '@/lib/supabase/client';

interface CourseOption {
  id: string;
  name: string;
  code: string;
}

const DEFAULT_COURSES: CourseOption[] = [
  { id: '1', name: 'Sistemas Distribuídos', code: 'SD' },
  { id: '2', name: 'Sistemas Operativos', code: 'SO' },
  { id: '3', name: 'Redes de Computadores', code: 'RC' },
  { id: '4', name: 'Algoritmos e Estruturas de Dados', code: 'AED' },
  { id: '5', name: 'Bases de Dados', code: 'BD' },
  { id: '6', name: 'Distributed Systems', code: 'DS' },
  { id: '7', name: 'Machine Learning', code: 'ML' },
];

const AVAILABLE_MODELS = [
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Latest)', tag: 'Recommended' },
  { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro (Deep Reasoning)', tag: 'Pro' },
  { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', tag: 'Fast' },
  { id: 'custom', label: 'Custom Model ID...', tag: 'Advanced' },
];

export default function Home() {
  const [courses, setCourses] = useState<CourseOption[]>(DEFAULT_COURSES);
  const [selectedCourse, setSelectedCourse] = useState<CourseOption>(DEFAULT_COURSES[0]);
  const [lectureTitle, setLectureTitle] = useState('');
  const [lectureDate, setLectureDate] = useState(new Date().toISOString().split('T')[0]);
  const [outputLanguage, setOutputLanguage] = useState<'pt' | 'en'>('pt');

  // Model Selection
  const [modelPreset, setModelPreset] = useState<string>('gemini-3.8-flash');
  const [customModelId, setCustomModelId] = useState<string>('');

  // Course Creation Modal State
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');

  // File States
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [compressedAudio, setCompressedAudio] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // Compression & Upload State
  const [compressionProgress, setCompressionProgress] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Output State
  const [synthesizedMarkdown, setSynthesizedMarkdown] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Auth State
  const [currentUser, setCurrentUser] = useState<{ email?: string } | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  // Load custom courses from localStorage and subscribe to Supabase Auth
  useEffect(() => {
    try {
      const saved = localStorage.getItem('synapse_custom_courses');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCourses(parsed);
          setSelectedCourse(parsed[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load courses from localStorage', e);
    }

    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) setCurrentUser({ email: user.email });
      });

      const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        setCurrentUser(session?.user ? { email: session.user.email } : null);
      });

      return () => subscription.unsubscribe();
    } catch (e) {
      console.error('Supabase auth initialization skipped in local mode', e);
    }
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : 'OAuth sign-in failed.');
    }
  };

  const handleMagicLinkSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmailInput.trim()) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: authEmailInput.trim(),
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) {
        setAuthMessage(error.message);
      } else {
        setAuthMessage(
          outputLanguage === 'pt'
            ? 'Link de acesso enviado! Verifica a tua caixa de correio.'
            : 'Magic sign-in link dispatched. Check your inbox.'
        );
      }
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : 'OTP dispatch failed.');
    }
  };

  const handleSignOut = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      setCurrentUser(null);
    } catch (e) {
      console.error('Sign out error', e);
    }
  };

  const activeModelName = modelPreset === 'custom' ? customModelId.trim() || 'gemini-3.8-flash' : modelPreset;

  const handleCreateCourse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim() || !newCourseCode.trim()) return;

    const newCourse: CourseOption = {
      id: Date.now().toString(),
      name: newCourseName.trim(),
      code: newCourseCode.trim().toUpperCase(),
    };

    const updated = [newCourse, ...courses];
    setCourses(updated);
    setSelectedCourse(newCourse);
    localStorage.setItem('synapse_custom_courses', JSON.stringify(updated));

    setNewCourseName('');
    setNewCourseCode('');
    setIsCreatingCourse(false);
  };

  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFile(file);
    setCompressedAudio(null);
    setErrorMessage(null);
    setCompressionProgress(0);
    setStatusMessage(
      outputLanguage === 'pt'
        ? `A otimizar áudio no browser (${(file.size / (1024 * 1024)).toFixed(1)}MB)...`
        : `Compressing audio in browser (${(file.size / (1024 * 1024)).toFixed(1)}MB)...`
    );

    try {
      const compressed = await compressAudio(file, {
        onProgress: (progress: number) => {
          setCompressionProgress(progress);
        },
      });
      setCompressedAudio(compressed);
      setCompressionProgress(100);
      setStatusMessage(
        outputLanguage === 'pt'
          ? `Otimizado: ${(file.size / (1024 * 1024)).toFixed(1)}MB -> ${(compressed.size / (1024 * 1024)).toFixed(1)}MB (-${Math.round(
              (1 - compressed.size / file.size) * 100
            )}%)`
          : `Optimized: ${(file.size / (1024 * 1024)).toFixed(1)}MB -> ${(compressed.size / (1024 * 1024)).toFixed(1)}MB (-${Math.round(
              (1 - compressed.size / file.size) * 100
            )}%)`
      );
    } catch (err) {
      console.error(err);
      setErrorMessage(
        outputLanguage === 'pt'
          ? 'Erro na compressão de áudio. Formato não suportado ou ficheiro corrompido.'
          : 'Audio compression failed. File may be unreadable or format unsupported.'
      );
      setCompressionProgress(null);
    }
  };

  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
      setErrorMessage(null);
    }
  };

  const uploadToStorage = async (file: File, type: string): Promise<string> => {
    const presignRes = await fetch('/api/upload/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileName: file.name,
        fileType: file.type || type,
        fileSize: file.size,
        courseId: selectedCourse.code.toLowerCase(),
      }),
    });

    if (!presignRes.ok) {
      const errorData = await presignRes.json();
      throw new Error(errorData.error || 'Failed to acquire presigned upload URL.');
    }

    const { uploadUrl, fileKey } = await presignRes.json();

    const uploadRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': file.type || type },
      body: file,
    });

    if (!uploadRes.ok) {
      throw new Error(`Direct binary upload to R2 storage failed (${uploadRes.status}).`);
    }

    return fileKey;
  };

  const handleStartPipeline = async () => {
    if (!lectureTitle.trim()) {
      setErrorMessage(outputLanguage === 'pt' ? 'Indica o título da aula / tópico.' : 'Please specify a lecture title.');
      return;
    }

    if (!audioFile && !pdfFile) {
      setErrorMessage(
        outputLanguage === 'pt'
          ? 'Seleciona pelo menos um material: áudio da aula ou PDF dos slides.'
          : 'Select at least one artifact: lecture audio or slides PDF.'
      );
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSynthesizedMarkdown(null);

    try {
      let audioKey: string | undefined;
      let pdfKey: string | undefined;

      if (compressedAudio || audioFile) {
        setStatusMessage(outputLanguage === 'pt' ? 'A enviar áudio para Cloudflare R2...' : 'Streaming audio binary to Cloudflare R2...');
        const fileToUpload = compressedAudio || audioFile!;
        audioKey = await uploadToStorage(fileToUpload, 'audio/mp3');
      }

      if (pdfFile) {
        setStatusMessage(outputLanguage === 'pt' ? 'A enviar slides PDF para Cloudflare R2...' : 'Streaming PDF slide deck to Cloudflare R2...');
        pdfKey = await uploadToStorage(pdfFile, 'application/pdf');
      }

      setStatusMessage(
        outputLanguage === 'pt'
          ? `A transcrever e sintetizar com ${activeModelName}...`
          : `Executing transcription and semantic synthesis with ${activeModelName}...`
      );

      const processRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: selectedCourse.name,
          courseCode: selectedCourse.code,
          lectureTitle,
          lectureDate,
          audioKey,
          pdfKey,
          modelName: activeModelName,
          outputLanguage,
        }),
      });

      if (!processRes.ok) {
        const errJson = await processRes.json();
        throw new Error(errJson.error || 'Synthesis pipeline returned an error.');
      }

      const result = await processRes.json();
      setSynthesizedMarkdown(result.markdown);
      setStatusMessage(outputLanguage === 'pt' ? 'Síntese concluída com sucesso!' : 'Synthesis complete.');
    } catch (err) {
      console.error(err);
      setErrorMessage(err instanceof Error ? err.message : 'Unknown pipeline error.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadMarkdown = () => {
    if (!synthesizedMarkdown) return;
    const blob = new Blob([synthesizedMarkdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = lectureTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.href = url;
    link.download = `${selectedCourse.code}_${safeTitle}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyMarkdown = () => {
    if (!synthesizedMarkdown) return;
    navigator.clipboard.writeText(synthesizedMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleLoadSample = () => {
    if (outputLanguage === 'pt') {
      setLectureTitle('Algoritmo de Consenso Raft e Replicação de Estado');
      setSynthesizedMarkdown(`---
id: "note-sample-pt-01"
cadeira: "[[${selectedCourse.name}]]"
codigo: "${selectedCourse.code}"
tipo: "aula-teorica"
data: "${lectureDate}"
topicos: [consenso, raft, eleicao-lider, replicacao-de-log]
tags: [faculdade, ${selectedCourse.code.toLowerCase()}, teoria]
---

# Aula: Algoritmo de Consenso Raft e Replicação de Máquinas de Estado

> [!NOTE] Resumo Executivo
> Protocolo de consenso distribuído desenhado para ser compreensível e modular. Garante segurança e consistência sob partições assíncronas de rede com o modelo CFT (Crash-Fault-Tolerant), exigindo maioria estrita de nós operacionais.

---

## 1. Estados dos Nós no Cluster
Cada nó no cluster opera exclusivamente num de três estados finitos:
1. **Seguidor (Follower):** Estado puramente passivo. Responde a RPCs de candidatos e líderes.
2. **Candidato (Candidate):** Transita para este estado quando o heartbeat expira. Inicia eleição.
3. **Líder (Leader):** Gere pedidos de clientes e coordena a replicação de entradas de log.

\`\`\`text
[ Seguidor ] ---> (Timeout de Heartbeat) ---> [ Candidato ]
     ^                                             |
     |                                        (Maioria de Votos)
     |                                             v
     +-------------- (Deteta Termo Superior) - [ Líder ]
\`\`\`

---

## 2. Condição de Quórum e Tolerância a Falhas
Para tolerar $f$ falhas de paragem de nós sem perda de consistência:
$$
N \\ge 2f + 1 \\implies \\text{Quórum} = \\left\\lfloor \\frac{N}{2} \\right\\rfloor + 1
$$

> [!IMPORTANT] Pergunta Típica de Exame
> **Como é evitado o problema de Split-Brain no Raft?**
> Um candidato só é eleito líder se receber a maioria estrita dos votos do cluster. Como duas maiorias se intersetam sempre em pelo menos um nó, é matematicamente impossível existirem dois líderes eleitos no mesmo mandato (*term*).

---

## 3. Conceitos e Ligações Relacionadas
* [[Aula 02: Relógios Lógicos de Lamport]]
* [[Trabalho Prático 1: Implementação de Raft em Go]]
`);
    } else {
      setLectureTitle('Raft Consensus Algorithm & State Machine Replication');
      setSynthesizedMarkdown(`---
id: "note-sample-en-01"
course: "[[${selectedCourse.name}]]"
code: "${selectedCourse.code}"
type: "lecture-summary"
date: "${lectureDate}"
topics: [consensus, raft, leader-election, log-replication]
tags: [academic, ${selectedCourse.code.toLowerCase()}, lecture]
---

# Lecture: Raft Consensus Algorithm & State Machine Replication

> [!NOTE] Executive Overview
> Distributed consensus protocol optimized for understandability. Guarantees safety under asynchronous network partitions assuming Crash-Fault-Tolerant (CFT) node models where $N \\ge 2f + 1$.

---

## 1. Node Finite State Model
Each cluster node executes in one of three mutually exclusive states:
1. **Follower:** Passive entity responding to RPCs from candidates and leaders.
2. **Candidate:** Active state initiating election upon heartbeat timeout.
3. **Leader:** Handles client operations and coordinates state log replication.

\`\`\`text
[ Follower ] ---> (Election Timeout) ---> [ Candidate ]
     ^                                         |
     |                                    (Majority Votes)
     |                                         v
     +-------------- (Discovers Higher Term) - [ Leader ]
\`\`\`

---

## 2. Quorum Invariant & Fault Tolerance
To tolerate $f$ node crash failures without consistency degradation:
$$
N \\ge 2f + 1 \\implies \\text{Quorum} = \\left\\lfloor \\frac{N}{2} \\right\\rfloor + 1
$$

> [!IMPORTANT] Exam Trap
> Raft enforces the Log Completeness Property: a follower rejects a candidate's vote request if the candidate's last log entry has a lower term or shorter log length.

---

## 3. Linked Concepts
* [[Lecture 02: Lamport Logical Clocks]]
* [[Project 1: Distributed Key-Value Store with Raft]]
`);
    }
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-[#0d1322] px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-sm">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">SynapseVault</h1>
            <p className="text-xs text-slate-400">
              {outputLanguage === 'pt'
                ? 'Motor de Síntese Académica para o Obsidian'
                : 'Academic Lecture Synthesis Engine for Obsidian'}
            </p>
          </div>
        </div>

        {/* Global Controls: Language & Model */}
        <div className="flex items-center space-x-3">
          {/* Language Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
            <button
              onClick={() => setOutputLanguage('pt')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                outputLanguage === 'pt' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              PT
            </button>
            <button
              onClick={() => setOutputLanguage('en')}
              className={`px-2.5 py-1 rounded font-medium transition-colors ${
                outputLanguage === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          {/* Model Selector Dropdown */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400 ml-2 mr-1" />
            <select
              value={modelPreset}
              onChange={(e) => setModelPreset(e.target.value)}
              className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none pr-2 py-1 cursor-pointer"
            >
              {AVAILABLE_MODELS.map((m) => (
                <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {/* User Authentication Status */}
          {currentUser ? (
            <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
              <User className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-slate-300 max-w-[140px] truncate">{currentUser.email}</span>
              <button
                onClick={handleSignOut}
                title={outputLanguage === 'pt' ? 'Terminar Sessão' : 'Sign Out'}
                className="text-slate-400 hover:text-rose-400 transition-colors ml-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center space-x-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{outputLanguage === 'pt' ? 'Entrar' : 'Sign In'}</span>
            </button>
          )}
        </div>
      </header>

      {/* Custom Model ID Input Bar (when custom is selected) */}
      {modelPreset === 'custom' && (
        <div className="bg-slate-900/90 border-b border-indigo-900/40 px-6 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2">
            <span className="text-slate-400">Custom Model Identifier:</span>
            <input
              type="text"
              placeholder="e.g. gemini-3.8-flash or gemini-exp"
              value={customModelId}
              onChange={(e) => setCustomModelId(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-white font-mono text-xs w-64 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <span className="text-slate-500">Active model target: {activeModelName}</span>
        </div>
      )}

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form & Uploads */}
        <section className="lg:col-span-5 space-y-6">
          {/* Metadata Card */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
                {outputLanguage === 'pt' ? 'Metadados da Sessão' : 'Session Metadata'}
              </h2>
              <button
                onClick={() => setIsCreatingCourse(true)}
                className="text-xs text-indigo-400 hover:text-indigo-300 flex items-center space-x-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{outputLanguage === 'pt' ? 'Nova Cadeira' : 'New Course'}</span>
              </button>
            </div>

            {/* Course Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {outputLanguage === 'pt' ? 'Cadeira / Disciplina' : 'Target Academic Course'}
              </label>
              <select
                value={selectedCourse.code}
                onChange={(e) => {
                  const course = courses.find((c) => c.code === e.target.value);
                  if (course) setSelectedCourse(course);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                {courses.map((course) => (
                  <option key={course.id} value={course.code}>
                    {course.name} ({course.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Lecture Title */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {outputLanguage === 'pt' ? 'Título da Aula / Tópico' : 'Lecture / Topic Title'}
              </label>
              <input
                type="text"
                placeholder={
                  outputLanguage === 'pt'
                    ? 'ex: Algoritmo de Consenso Raft e Replicação'
                    : 'e.g. Raft Consensus Algorithm & Leader Election'
                }
                value={lectureTitle}
                onChange={(e) => setLectureTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                {outputLanguage === 'pt' ? 'Data da Aula' : 'Date'}
              </label>
              <input
                type="date"
                value={lectureDate}
                onChange={(e) => setLectureDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Ingestion Dropzones */}
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              {outputLanguage === 'pt' ? 'Ingestão de Materiais' : 'Artifact Ingestion'}
            </h2>

            {/* Audio Upload */}
            <div className="border border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-4 bg-slate-900/60 transition-colors">
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                  onChange={handleAudioSelect}
                  className="hidden"
                />
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 bg-indigo-950/70 border border-indigo-800/40 rounded-lg text-indigo-400">
                    <FileAudio className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-200 block">
                      {audioFile
                        ? audioFile.name
                        : outputLanguage === 'pt'
                        ? 'Arrasta ou seleciona gravação da aula'
                        : 'Select or drop lecture audio'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {outputLanguage === 'pt'
                        ? 'MP3, WAV, M4A, WebM (comprimido para 16kHz mono no browser)'
                        : 'MP3, WAV, M4A, WebM (downsampled to 16kHz mono in browser)'}
                    </span>
                  </div>
                </div>
              </label>

              {/* Compression Progress Bar */}
              {compressionProgress !== null && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>{outputLanguage === 'pt' ? 'Otimização Web Audio' : 'Web Audio Optimization'}</span>
                    <span>{compressionProgress}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-500 h-full transition-all duration-150"
                      style={{ width: `${compressionProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* PDF Upload */}
            <div className="border border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-4 bg-slate-900/60 transition-colors">
              <label className="cursor-pointer block">
                <input type="file" accept="application/pdf" onChange={handlePdfSelect} className="hidden" />
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 bg-slate-800 border border-slate-700 rounded-lg text-slate-300">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-slate-200 block">
                      {pdfFile
                        ? pdfFile.name
                        : outputLanguage === 'pt'
                        ? 'Arrasta ou seleciona slides da aula (PDF)'
                        : 'Select or drop lecture slides (PDF)'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {outputLanguage === 'pt'
                        ? 'Texto extraído diretamente sem gastar tokens de visão'
                        : 'Digital text streams extracted directly to conserve vision tokens'}
                    </span>
                  </div>
                </div>
              </label>
            </div>

            {/* Status / Errors */}
            {statusMessage && (
              <div className="text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-900/50 rounded-lg p-2.5 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-400 shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="text-xs text-rose-300 bg-rose-950/40 border border-rose-900/50 rounded-lg p-2.5 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={handleStartPipeline}
              disabled={isProcessing}
              className={`w-full py-3 px-4 rounded-lg font-medium text-sm text-white flex items-center justify-center space-x-2 shadow-sm transition-all ${
                isProcessing
                  ? 'bg-indigo-700/60 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99]'
              }`}
            >
              {isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{outputLanguage === 'pt' ? 'A Processar Pipeline...' : 'Processing Pipeline...'}</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>
                    {outputLanguage === 'pt'
                      ? `Sintetizar Nota Obsidian (${activeModelName})`
                      : `Synthesize Obsidian Note (${activeModelName})`}
                  </span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Right Column: Output / Obsidian View */}
        <section className="lg:col-span-7 flex flex-col">
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl flex-1 flex flex-col shadow-sm overflow-hidden">
            {/* Output Header */}
            <div className="border-b border-slate-800 bg-[#0d1322] px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {outputLanguage === 'pt' ? 'Visualização Obsidian (.md)' : 'Obsidian Markdown Output'}
                </h3>
                <p className="text-xs text-slate-400">
                  {outputLanguage === 'pt'
                    ? 'Nota formatada com YAML, KaTeX LaTeX, Callouts e [[wikilinks]]'
                    : 'Structured graph note with LaTeX, callouts & wikilinks'}
                </p>
              </div>

              {synthesizedMarkdown && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCopyMarkdown}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-md flex items-center space-x-1.5 transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? (outputLanguage === 'pt' ? 'Copiado!' : 'Copied') : (outputLanguage === 'pt' ? 'Copiar' : 'Copy')}</span>
                  </button>
                  <button
                    onClick={handleDownloadMarkdown}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white rounded-md flex items-center space-x-1.5 transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{outputLanguage === 'pt' ? 'Descarregar .md' : 'Download .md'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Output Body */}
            <div className="flex-1 p-5 overflow-auto font-mono text-xs text-slate-300 leading-relaxed bg-[#0b101e]">
              {synthesizedMarkdown ? (
                <pre className="whitespace-pre-wrap select-text">{synthesizedMarkdown}</pre>
              ) : (
                <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center p-6 text-slate-500">
                  <Cpu className="w-12 h-12 text-slate-700 mb-3 stroke-[1.5]" />
                  <p className="font-sans text-sm font-medium text-slate-400">
                    {outputLanguage === 'pt' ? 'Nenhuma nota gerada ainda' : 'No note synthesized yet'}
                  </p>
                  <p className="font-sans text-xs text-slate-600 max-w-sm mt-1">
                    {outputLanguage === 'pt'
                      ? 'Seleciona a cadeira, envia a gravação ou slides e clica em sintetizar para gerar a nota estruturada.'
                      : 'Select a course, upload the lecture recording or slides, and initiate synthesis to view the structured Obsidian graph note.'}
                  </p>
                  <button
                    onClick={handleLoadSample}
                    className="mt-4 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 rounded-lg transition-colors border border-slate-700 hover:text-white"
                  >
                    {outputLanguage === 'pt' ? 'Carregar Exemplo de Nota (.md)' : 'Load Sample Note Preview'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      {/* Modal: Create Custom Course */}
      {isCreatingCourse && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white">
                {outputLanguage === 'pt' ? 'Adicionar Nova Cadeira' : 'Create New Academic Course'}
              </h3>
              <button
                onClick={() => setIsCreatingCourse(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {outputLanguage === 'pt' ? 'Nome da Cadeira' : 'Course Name'}
                </label>
                <input
                  type="text"
                  placeholder={outputLanguage === 'pt' ? 'ex: Arquitetura de Computadores' : 'e.g. Computer Architecture'}
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {outputLanguage === 'pt' ? 'Sigla / Código' : 'Course Code'}
                </label>
                <input
                  type="text"
                  placeholder={outputLanguage === 'pt' ? 'ex: AC' : 'e.g. CA'}
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 uppercase"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingCourse(false)}
                  className="px-3 py-2 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  {outputLanguage === 'pt' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white rounded-lg transition-colors"
                >
                  {outputLanguage === 'pt' ? 'Salvar Cadeira' : 'Save Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Student Whitelist Authentication */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                <h3 className="text-sm font-bold text-white">
                  {outputLanguage === 'pt' ? 'Acesso ao SynapseVault' : 'SynapseVault Group Access'}
                </h3>
              </div>
              <button
                onClick={() => {
                  setIsAuthModalOpen(false);
                  setAuthMessage('');
                }}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              {outputLanguage === 'pt'
                ? 'Plataforma restrita ao grupo de estudo da faculdade. Apenas emails autorizados na lista de alunos têm permissão de síntese.'
                : 'Platform restricted to approved university study members. Only whitelisted student emails can trigger synthesis.'}
            </p>

            {/* Google OAuth Button */}
            <button
              onClick={handleGoogleSignIn}
              className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold rounded-lg flex items-center justify-center space-x-2 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.15z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.24v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.24C.45 8.15 0 9.99 0 12s.45 3.85 1.24 5.42l4.04-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.24 6.58l4.04 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{outputLanguage === 'pt' ? 'Entrar com Conta Google' : 'Sign In with Google'}</span>
            </button>

            <div className="flex items-center my-3">
              <div className="flex-1 border-t border-slate-800" />
              <span className="px-2 text-[10px] uppercase text-slate-500 font-mono tracking-wider">
                {outputLanguage === 'pt' ? 'ou email' : 'or email'}
              </span>
              <div className="flex-1 border-t border-slate-800" />
            </div>

            {/* Magic Link Form */}
            <form onSubmit={handleMagicLinkSignIn} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {outputLanguage === 'pt' ? 'Email Universitário / Pessoal' : 'Student / University Email'}
                </label>
                <input
                  type="email"
                  placeholder="aluno@universidade.pt"
                  value={authEmailInput}
                  onChange={(e) => setAuthEmailInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              {authMessage && (
                <div className="text-xs text-indigo-300 bg-indigo-950/40 border border-indigo-900/50 rounded-lg p-2.5">
                  {authMessage}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white rounded-lg transition-colors shadow-sm"
              >
                {outputLanguage === 'pt' ? 'Enviar Link de Acesso (Magic Link)' : 'Send Magic Access Link'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
