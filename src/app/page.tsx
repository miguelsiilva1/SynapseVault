'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
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
  X,
  User,
  LogOut,
  ShieldCheck,
  Activity,
  History,
  GraduationCap,
  FolderTree,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  BookOpen,
  Clock,
  RefreshCw,
  Eye,
  Trash2,
  Pencil,
  Check,
  FileCode,
} from 'lucide-react';

import { compressAudio } from '@/lib/audio/compressAudio';
import { createClient } from '@/lib/supabase/client';
import { isUserAdmin } from '@/lib/auth/whitelist';
import type { PersonalNoteRecord } from '@/lib/db/notes';


interface CourseOption {

  id: string;
  name: string;
  nameEn?: string;
  code: string;
}

const DEFAULT_COURSES: CourseOption[] = [
  { id: '1', name: 'Administração de Sistemas', nameEn: 'Systems Administration', code: 'ASSIST' },
  { id: '2', name: 'Gestão', nameEn: 'Management', code: 'GESTA' },
  { id: '3', name: 'Redes e Sistemas de Comunicações', nameEn: 'Networks and Communication Systems', code: 'REDSC' },
  { id: '4', name: 'Segurança Informática', nameEn: 'Computer Security', code: 'SEINF' },
  { id: '5', name: 'Sistemas Distribuídos', nameEn: 'Distributed Systems', code: 'SIDIS' },
  { id: '6', name: 'Sistemas Gráficos e Interação', nameEn: 'Computer Graphics and Interaction', code: 'SGRAI' },
  { id: '7', name: 'Telecomunicações na Aeronáutica', nameEn: 'Aeronautical Telecommunications', code: 'STAER' },
  { id: '8', name: 'Vibração e Ondas', nameEn: 'Vibrations and Waves', code: 'VIBON' },
];

const AVAILABLE_MODELS = [
  { id: 'gemini-3.6-flash', label: 'Gemini 3.6 Flash (Fast & Stable)', tag: 'Recommended' },
  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (Latest Preview)', tag: 'Latest' },
  { id: 'custom', label: 'Custom Model ID...', tag: 'Advanced' },
];

export default function Home() {
  const [courses, setCourses] = useState<CourseOption[]>(DEFAULT_COURSES);
  const [selectedCourse, setSelectedCourse] = useState<CourseOption>(DEFAULT_COURSES[0]);
  const [lectureTitle, setLectureTitle] = useState('');
  const [lectureDate, setLectureDate] = useState(new Date().toISOString().split('T')[0]);
  const [outputLanguage, setOutputLanguage] = useState<'pt' | 'en'>('pt');

  // Model Selection
  const [modelPreset, setModelPreset] = useState<string>('gemini-3.6-flash');
  const [customModelId, setCustomModelId] = useState<string>('');

  // Course Creation Modal State
  const [isCreatingCourse, setIsCreatingCourse] = useState(false);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');

  // File & Markdown States
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [compressedAudio, setCompressedAudio] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pastedMarkdown, setPastedMarkdown] = useState<string>('');
  const [isSavingDirectNote, setIsSavingDirectNote] = useState<boolean>(false);

  // Compression & Upload State
  const [isCompressing, setIsCompressing] = useState<boolean>(false);
  const [compressionProgress, setCompressionProgress] = useState<number | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Output State
  const [synthesizedMarkdown, setSynthesizedMarkdown] = useState<string | null>(null);
  const [lastSynthesizedKey, setLastSynthesizedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Auth State
  const [currentUser, setCurrentUser] = useState<{ email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authMessage, setAuthMessage] = useState('');

  // Personal History State (Categorized by Course)
  const [personalNotes, setPersonalNotes] = useState<PersonalNoteRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState<boolean>(false);
  const [expandedCourseFolders, setExpandedCourseFolders] = useState<Record<string, boolean>>({});
  const [copiedNoteId, setCopiedNoteId] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState<string>('');
  const [isSavingTitle, setIsSavingTitle] = useState<boolean>(false);



  // Load custom courses from localStorage and subscribe to Supabase Auth
  useEffect(() => {
    const LEGACY_MOCK_CODES = new Set(['SD', 'SO', 'RC', 'AED', 'BD', 'DS', 'ML']);
    let initialCourses = [...DEFAULT_COURSES];

    const savedLang = localStorage.getItem('synapse_language');
    if (savedLang === 'en' || savedLang === 'pt') {
      setOutputLanguage(savedLang);
    }

    try {
      const saved = localStorage.getItem('synapse_custom_courses');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const customOnly = parsed.filter(
            (p: CourseOption) =>
              p.code &&
              !DEFAULT_COURSES.some((d) => d.code === p.code) &&
              !LEGACY_MOCK_CODES.has(p.code)
          );
          initialCourses = [...DEFAULT_COURSES, ...customOnly];
          localStorage.setItem('synapse_custom_courses', JSON.stringify(initialCourses));
        }
      }
    } catch (e) {
      console.error('Failed to load courses from localStorage', e);
    }

    setCourses(initialCourses);
    setSelectedCourse(initialCourses[0]);

    try {
      const supabase = createClient();
      (async () => {
        try {
          const { data } = await supabase.from('courses').select('*').order('name');
          if (data && data.length > 0) {
            const courseMap = new Map<string, CourseOption>();
            for (const d of DEFAULT_COURSES) {
              courseMap.set(d.code, d);
            }
            for (const c of data) {
              const def = DEFAULT_COURSES.find((d) => d.code === c.code);
              courseMap.set(c.code, {
                id: c.id,
                name: c.name,
                nameEn: def?.nameEn,
                code: c.code,
              });
            }
            const unique = Array.from(courseMap.values());
            setCourses(unique);
            setSelectedCourse(unique[0]);
          }
        } catch (e) {
          console.warn('Failed to load courses from Supabase', e);
        }
      })();
      supabase.auth
        .getUser()
        .then(({ data: { user } }) => {
          if (user) setCurrentUser({ email: user.email });
          setAuthLoading(false);
        })
        .catch(() => setAuthLoading(false));

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((_event, session) => {
        setCurrentUser(session?.user ? { email: session.user.email } : null);
        setAuthLoading(false);
      });

      return () => subscription.unsubscribe();
    } catch (e) {
      console.error('Supabase auth initialization skipped in local mode', e);
      setAuthLoading(false);
    }
  }, []);

  // Load personal notes
  const loadPersonalNotes = async () => {
    if (!currentUser?.email) return;
    setLoadingHistory(true);
    try {
      const res = await fetch('/api/notes/personal');
      if (res.ok) {
        const data = await res.json();
        setPersonalNotes(data.notes || []);
      }
    } catch {
      // non-blocking
    } finally {
      setLoadingHistory(false);
    }
  };

  useEffect(() => {
    if (currentUser?.email) {
      loadPersonalNotes();
    }
  }, [currentUser]);

  // Group personal notes by course code
  const groupedPersonalNotes = useMemo(() => {
    const map = new Map<string, PersonalNoteRecord[]>();
    for (const note of personalNotes) {
      const code = note.course_code || 'OUTRO';
      if (!map.has(code)) {
        map.set(code, []);
      }
      map.get(code)!.push(note);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [personalNotes]);

  // Auto-expand all course folders when notes arrive
  useEffect(() => {
    if (personalNotes.length > 0) {
      const expandMap: Record<string, boolean> = {};
      personalNotes.forEach((n) => {
        expandMap[n.course_code || 'OUTRO'] = true;
      });
      setExpandedCourseFolders((prev) => ({ ...expandMap, ...prev }));
    }
  }, [personalNotes]);

  const toggleCourseFolder = (code: string) => {
    setExpandedCourseFolders((prev) => ({
      ...prev,
      [code]: prev[code] === undefined ? false : !prev[code],
    }));
  };

  const handleCopyNoteDirect = (note: PersonalNoteRecord) => {
    navigator.clipboard.writeText(note.content_markdown);
    setCopiedNoteId(note.id);
    setTimeout(() => setCopiedNoteId(null), 2000);
  };

  const handleDownloadNoteDirect = (note: PersonalNoteRecord) => {
    const blob = new Blob([note.content_markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const safeTitle = note.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    link.href = url;
    link.download = `${note.course_code}_${safeTitle}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDeleteNoteDirect = async (noteId: string) => {
    const confirmMsg =
      outputLanguage === 'pt'
        ? 'Tens a certeza que queres apagar esta nota permanentemente do histórico?'
        : 'Are you sure you want to permanently delete this note from history?';

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/notes/personal?id=${encodeURIComponent(noteId)}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setPersonalNotes((prev) => prev.filter((n) => n.id !== noteId));
      } else {
        const data = await res.json();
        alert(data.error || (outputLanguage === 'pt' ? 'Erro ao apagar nota.' : 'Failed to delete note.'));
      }
    } catch (err) {
      console.error('Error deleting note:', err);
      alert(outputLanguage === 'pt' ? 'Erro de comunicação ao apagar nota.' : 'Network error deleting note.');
    }
  };

  const handleSaveNoteTitle = async (noteId: string) => {
    const trimmed = editingTitle.trim();
    if (!trimmed) return;

    setIsSavingTitle(true);
    try {
      const res = await fetch('/api/notes/personal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: noteId, title: trimmed }),
      });

      if (res.ok) {
        setPersonalNotes((prev) =>
          prev.map((n) =>
            n.id === noteId
              ? {
                  ...n,
                  title: trimmed,
                  slug: trimmed.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
                }
              : n
          )
        );
        // Sync lectureTitle if open in editor
        const currentNote = personalNotes.find((n) => n.id === noteId);
        if (currentNote && lectureTitle === currentNote.title) {
          setLectureTitle(trimmed);
        }
        setEditingNoteId(null);
      } else {
        const data = await res.json();
        alert(data.error || (outputLanguage === 'pt' ? 'Erro ao renomear nota.' : 'Failed to rename note.'));
      }
    } catch (err) {
      console.error('Error renaming note:', err);
      alert(outputLanguage === 'pt' ? 'Erro de comunicação ao renomear nota.' : 'Network error renaming note.');
    } finally {
      setIsSavingTitle(false);
    }
  };



  const handleGoogleSignIn = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : 'Google sign-in failed.');
    }
  };

  const handleGitHubSignIn = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : 'GitHub sign-in failed.');
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
    setIsCompressing(true);
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
    } finally {
      setIsCompressing(false);
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
    // Attempt 1: Direct presigned streaming to Cloudflare R2
    try {
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

      if (presignRes.ok) {
        const { uploadUrl, fileKey } = await presignRes.json();

        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || type },
          body: file,
        });

        if (uploadRes.ok) {
          return fileKey;
        }
      }
    } catch (err) {
      console.warn('Direct R2 presigned upload failed or blocked by CORS. Using server relay fallback:', err);
    }

    // Attempt 2: Server-side relay fallback (bypasses browser CORS completely)
    const formData = new FormData();
    formData.append('file', file);
    formData.append('courseId', selectedCourse.code.toLowerCase());

    const directRes = await fetch('/api/upload/direct', {
      method: 'POST',
      body: formData,
    });

    if (!directRes.ok) {
      const errorData = await directRes.json().catch(() => ({}));
      throw new Error(errorData.error || `Upload failed with status ${directRes.status}.`);
    }

    const { fileKey } = await directRes.json();
    return fileKey;
  };

  const currentInputKey = `${selectedCourse.code}_${lectureTitle.trim()}_${audioFile?.name || ''}_${audioFile?.size || 0}_${pdfFile?.name || ''}_${pdfFile?.size || 0}_${pastedMarkdown.trim()}_${outputLanguage}_${activeModelName}`;
  const isAlreadySynthesized = Boolean(lastSynthesizedKey && lastSynthesizedKey === currentInputKey && synthesizedMarkdown);

  const handleDirectSaveMarkdown = async () => {
    if (!lectureTitle.trim()) {
      setErrorMessage(outputLanguage === 'pt' ? 'Indica o título da aula / tópico.' : 'Please enter a lecture title.');
      return;
    }
    if (!pastedMarkdown.trim()) {
      setErrorMessage(
        outputLanguage === 'pt'
          ? 'Cola o conteúdo do resumo em Markdown primeiro.'
          : 'Please paste your markdown content first.'
      );
      return;
    }

    setIsSavingDirectNote(true);
    setErrorMessage(null);
    setStatusMessage(
      outputLanguage === 'pt'
        ? 'A guardar resumo nas notas pessoais...'
        : 'Saving note to personal notes...'
    );

    try {
      const res = await fetch('/api/notes/personal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseName: outputLanguage === 'en' ? (selectedCourse.nameEn || selectedCourse.name) : selectedCourse.name,
          courseCode: selectedCourse.code,
          title: lectureTitle.trim(),
          lectureDate,
          contentMarkdown: pastedMarkdown.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to save note.');
      }

      setSynthesizedMarkdown(pastedMarkdown.trim());
      setLastSynthesizedKey(currentInputKey);
      setStatusMessage(
        outputLanguage === 'pt'
          ? 'Resumo guardado com sucesso no teu histórico!'
          : 'Note saved successfully to your history!'
      );
      loadPersonalNotes();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Erro ao guardar nota.');
    } finally {
      setIsSavingDirectNote(false);
    }
  };

  const handleStartPipeline = async () => {
    if (isProcessing || isCompressing || isAlreadySynthesized) return;

    if (!lectureTitle.trim()) {
      setErrorMessage(outputLanguage === 'pt' ? 'Indica o título da aula / tópico.' : 'Please specify a lecture title.');
      return;
    }

    if (!audioFile && !pdfFile && !pastedMarkdown.trim()) {
      setErrorMessage(
        outputLanguage === 'pt'
          ? 'Seleciona pelo menos um material: áudio da aula, slides PDF ou cola um resumo em Markdown.'
          : 'Select at least one artifact: lecture audio, slides PDF, or paste a markdown summary.'
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
          courseName: outputLanguage === 'en' ? (selectedCourse.nameEn || selectedCourse.name) : selectedCourse.name,
          courseCode: selectedCourse.code,
          lectureTitle,
          lectureDate,
          audioKey,
          pdfKey,
          rawMarkdown: pastedMarkdown.trim() || undefined,
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
      setLastSynthesizedKey(currentInputKey);
      setStatusMessage(outputLanguage === 'pt' ? 'Síntese concluída com sucesso!' : 'Synthesis complete.');
      loadPersonalNotes();
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

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#090d16] flex items-center justify-center text-slate-400 font-sans">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-mono uppercase tracking-wider text-slate-500">
            {outputLanguage === 'pt' ? 'A verificar sessão académica...' : 'Verifying session...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800/80 bg-slate-950/90 backdrop-blur sticky top-0 z-40 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand Left */}
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-gradient-to-tr from-indigo-600 to-violet-500 rounded-xl shadow-md shadow-indigo-600/20">
            <Cpu className="w-4 h-4 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-sm font-bold tracking-tight text-white">SynapseVault</h1>
              <span className="px-1.5 py-0.2 text-[9px] uppercase font-mono font-bold tracking-wider bg-indigo-950 border border-indigo-700/60 text-indigo-300 rounded">
                Studio
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-mono">
              {outputLanguage === 'pt'
                ? 'Síntese Académica para Obsidian'
                : 'Academic Synthesis for Obsidian'}
            </p>
          </div>
        </div>

        {/* Global Controls & Navigation */}
        <div className="flex items-center space-x-3">
          {/* Navigation Links (Salas & Histórico) */}
          {currentUser && (
            <div className="flex items-center space-x-2">
              <Link
                href="/rooms"
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-violet-950/60 hover:bg-violet-900/80 border border-violet-700/60 text-violet-200 hover:text-white rounded-lg text-xs font-mono font-medium transition-colors shadow-sm"
                title={outputLanguage === 'pt' ? 'Salas de Estudo Colaborativas' : 'Study Rooms'}
              >
                <GraduationCap className="w-3.5 h-3.5 text-violet-400" />
                <span>Salas</span>
              </Link>

              <button
                onClick={() => {
                  setShowHistoryDrawer(true);
                  loadPersonalNotes();
                }}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-mono transition-colors cursor-pointer"
                title={outputLanguage === 'pt' ? 'Meu Histórico Pessoal' : 'Personal History'}
              >
                <History className="w-3.5 h-3.5 text-indigo-400" />
                <span>Histórico</span>
                {personalNotes.length > 0 && (
                  <span className="px-1.5 py-0.2 bg-indigo-600 text-white rounded-full text-[10px] font-bold">
                    {personalNotes.length}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Separator */}
          {currentUser && <div className="h-4 w-px bg-slate-800" />}

          {/* Language Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
            <Globe className="w-3.5 h-3.5 text-slate-400 ml-2 mr-1" />
            <button
              onClick={() => {
                setOutputLanguage('pt');
                localStorage.setItem('synapse_language', 'pt');
              }}
              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                outputLanguage === 'pt' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              PT
            </button>
            <button
              onClick={() => {
                setOutputLanguage('en');
                localStorage.setItem('synapse_language', 'en');
              }}
              className={`px-2 py-0.5 rounded font-semibold transition-colors cursor-pointer ${
                outputLanguage === 'en' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              EN
            </button>
          </div>

          {/* Model Selector (Only displayed when authenticated) */}
          {currentUser && (
            <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg px-2 py-1 text-xs font-mono">
              <Sparkles className="w-3.5 h-3.5 text-indigo-400 mr-1.5 flex-shrink-0" />
              <select
                value={modelPreset}
                onChange={(e) => setModelPreset(e.target.value)}
                className="bg-transparent text-slate-200 text-xs font-medium focus:outline-none pr-1 cursor-pointer font-mono"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Separator */}
          {currentUser && <div className="h-4 w-px bg-slate-800" />}

          {/* Admin & Profile */}
          {currentUser && (
            <div className="flex items-center space-x-2">
              {isUserAdmin(currentUser.email) && (
                <Link
                  href="/admin"
                  className="flex items-center space-x-1.5 px-2.5 py-1 bg-indigo-950/80 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-300 hover:text-white rounded-lg text-xs font-mono font-medium transition-colors"
                  title="Consola de Telemetria de Infraestrutura"
                >
                  <Activity className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Admin</span>
                </Link>
              )}

              <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-slate-300 max-w-[130px] truncate font-mono text-[11px]">{currentUser.email}</span>
                <button
                  onClick={handleSignOut}
                  title={outputLanguage === 'pt' ? 'Terminar Sessão' : 'Sign Out'}
                  className="text-slate-400 hover:text-rose-400 transition-colors ml-1 cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </header>



      {/* Custom Model ID Input Bar (when custom is selected) */}
      {modelPreset === 'custom' && currentUser && (
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

      {/* Auth Gate: If unauthenticated, show locked entry portal */}
      {!currentUser ? (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-[#0f172a] border border-slate-800 rounded-2xl p-8 shadow-2xl space-y-6 text-center">
            <div className="inline-flex p-3 bg-indigo-950/80 border border-indigo-800/40 rounded-2xl text-indigo-400 shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white tracking-tight">
                {outputLanguage === 'pt' ? 'Acesso Restrito ao Grupo' : 'Restricted Academic Portal'}
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                {outputLanguage === 'pt'
                  ? 'O SynapseVault é de uso exclusivo da nossa turma/grupo de estudo. Autentica-te com uma conta autorizada na whitelist para aceder ao estúdio de síntese e às notas.'
                  : 'SynapseVault is restricted to our university study group. Authenticate with an authorized account to access the workspace.'}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* Google Button */}
              <button
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors shadow-sm"
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

              {/* GitHub Button */}
              <button
                onClick={handleGitHubSignIn}
                className="w-full py-2.5 px-4 bg-[#24292F] hover:bg-[#1f2328] text-white text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors border border-slate-700 shadow-sm"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>{outputLanguage === 'pt' ? 'Entrar com Conta GitHub' : 'Sign In with GitHub'}</span>
              </button>
            </div>

            <div className="flex items-center my-2">
              <div className="flex-1 border-t border-slate-800" />
              <span className="px-2 text-[10px] uppercase text-slate-500 font-mono tracking-wider">
                {outputLanguage === 'pt' ? 'ou email' : 'or email'}
              </span>
              <div className="flex-1 border-t border-slate-800" />
            </div>

            {/* Magic Link */}
            <form onSubmit={handleMagicLinkSignIn} className="space-y-3 text-left">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">
                  {outputLanguage === 'pt' ? 'Email Universitário' : 'University Email'}
                </label>
                <input
                  type="email"
                  placeholder="aluno@universidade.pt"
                  value={authEmailInput}
                  onChange={(e) => setAuthEmailInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
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
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white rounded-xl transition-colors shadow-sm"
              >
                {outputLanguage === 'pt' ? 'Enviar Link de Acesso' : 'Send Access Link'}
              </button>
            </form>
          </div>
        </main>
      ) : (
        /* Main Workspace (Unlocked for authenticated users) */
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
                  <option key={course.code} value={course.code}>
                    {outputLanguage === 'en' ? (course.nameEn || course.name) : course.name} ({course.code})
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

            {/* Markdown Direct Paste */}
            <div className="border border-dashed border-slate-700 hover:border-indigo-500/60 rounded-xl p-4 bg-slate-900/60 transition-colors space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-emerald-950/60 border border-emerald-800/40 rounded-lg text-emerald-400">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-slate-200 block">
                      {outputLanguage === 'pt' ? 'Colar Resumo em Markdown' : 'Paste Markdown Summary'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {outputLanguage === 'pt'
                        ? 'Resumos já feitos ou apontamentos de outras ferramentas'
                        : 'Existing lecture notes or external summaries'}
                    </span>
                  </div>
                </div>
                {pastedMarkdown.trim() && (
                  <button
                    type="button"
                    onClick={() => setPastedMarkdown('')}
                    className="text-[11px] text-slate-400 hover:text-rose-400 font-mono transition-colors cursor-pointer"
                  >
                    {outputLanguage === 'pt' ? 'Limpar' : 'Clear'}
                  </button>
                )}
              </div>

              <textarea
                rows={3}
                placeholder={
                  outputLanguage === 'pt'
                    ? 'Cola aqui o conteúdo em Markdown (tópicos, resumo anterior, etc.)...'
                    : 'Paste raw Markdown content here (topics, existing summaries, etc.)...'
                }
                value={pastedMarkdown}
                onChange={(e) => setPastedMarkdown(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 placeholder-slate-500 font-mono focus:outline-none focus:border-indigo-500 leading-relaxed"
              />

              {pastedMarkdown.trim() && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {pastedMarkdown.length} {outputLanguage === 'pt' ? 'caracteres' : 'chars'}
                  </span>
                  <button
                    type="button"
                    onClick={handleDirectSaveMarkdown}
                    disabled={isSavingDirectNote || !lectureTitle.trim()}
                    title={
                      outputLanguage === 'pt'
                        ? 'Guardar diretamente no teu histórico sem gastar tokens de IA'
                        : 'Save directly to your history without AI generation'
                    }
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 text-slate-200 hover:text-white rounded text-xs font-mono transition-colors flex items-center space-x-1.5 cursor-pointer"
                  >
                    {isSavingDirectNote && <RefreshCw className="w-3 h-3 animate-spin text-indigo-400" />}
                    <span>{outputLanguage === 'pt' ? 'Guardar Direto (Sem IA)' : 'Save Direct (No AI)'}</span>
                  </button>
                </div>
              )}
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
              disabled={isProcessing || isCompressing || isAlreadySynthesized}
              className={`w-full py-3 px-4 rounded-lg font-medium text-sm text-white flex items-center justify-center space-x-2 shadow-sm transition-all ${
                isProcessing || isCompressing
                  ? 'bg-indigo-700/60 cursor-not-allowed'
                  : isAlreadySynthesized
                  ? 'bg-emerald-700/80 cursor-default'
                  : 'bg-indigo-600 hover:bg-indigo-500 active:scale-[0.99]'
              }`}
            >
              {isCompressing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>
                    {outputLanguage === 'pt'
                      ? `A otimizar áudio no browser (${compressionProgress ?? 0}%)...`
                      : `Compressing audio in browser (${compressionProgress ?? 0}%)...`}
                  </span>
                </>
              ) : isProcessing ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{outputLanguage === 'pt' ? 'A Processar Pipeline...' : 'Processing Pipeline...'}</span>
                </>
              ) : isAlreadySynthesized ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                  <span>
                    {outputLanguage === 'pt'
                      ? 'Nota Já Sintetizada para este Material'
                      : 'Note Already Synthesized for this Material'}
                  </span>
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
      )}

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
      {/* Drawer: Meu Histórico Pessoal (Organizado por Cadeiras) */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setShowHistoryDrawer(false)}
          />
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-md bg-slate-900 border-l border-slate-800 p-6 flex flex-col space-y-4 shadow-2xl">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2">
                  <History className="w-5 h-5 text-indigo-400" />
                  <h3 className="text-base font-bold text-white">Meu Histórico</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-mono font-bold">
                    {personalNotes.length} notas
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-mono">
                    {groupedPersonalNotes.length} cadeiras
                  </span>
                </div>
                <button
                  onClick={() => setShowHistoryDrawer(false)}
                  className="text-slate-400 hover:text-white transition-colors cursor-pointer text-sm p-1 rounded hover:bg-slate-800"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-slate-400 font-mono leading-relaxed">
                Notas organizadas por cadeira curricular. Podes copiar ou descarregar diretamente sem abrir no editor.
              </p>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 font-mono text-xs">
                {loadingHistory ? (
                  <div className="space-y-3 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-slate-950 rounded-xl" />
                    ))}
                  </div>
                ) : personalNotes.length === 0 ? (
                  <div className="text-center py-16 space-y-2 text-slate-500 font-mono">
                    <Folder className="w-8 h-8 mx-auto text-slate-600" />
                    <p>Ainda não sintetizaste nenhuma nota.</p>
                  </div>
                ) : (
                  groupedPersonalNotes.map(([courseCode, courseNotes]) => {
                    const isExpanded = expandedCourseFolders[courseCode] !== false;
                    const matchedCourse = courses.find((c) => c.code === courseCode);
                    const courseDisplayName = matchedCourse
                      ? (outputLanguage === 'en' ? (matchedCourse.nameEn || matchedCourse.name) : matchedCourse.name)
                      : courseCode;

                    return (
                      <div
                        key={courseCode}
                        className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden transition-colors"
                      >
                        {/* Course Folder Header (Accordion) */}
                        <button
                          onClick={() => toggleCourseFolder(courseCode)}
                          className="w-full flex items-center justify-between p-3 bg-slate-900/60 hover:bg-slate-900 text-left transition-colors cursor-pointer"
                        >
                          <div className="flex items-center space-x-2 truncate pr-2">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                            )}
                            {isExpanded ? (
                              <FolderOpen className="w-4 h-4 text-amber-400 flex-shrink-0" />
                            ) : (
                              <Folder className="w-4 h-4 text-amber-500/80 flex-shrink-0" />
                            )}
                            <span className="font-bold text-white text-xs">{courseCode}</span>
                            <span className="text-slate-400 text-xs truncate max-w-[170px]">
                              - {courseDisplayName}
                            </span>
                          </div>

                          <span className="px-1.5 py-0.2 rounded-full text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800/60 flex-shrink-0">
                            {courseNotes.length}
                          </span>
                        </button>

                        {/* Notes List inside Course Folder */}
                        {isExpanded && (
                          <div className="p-2 space-y-2 border-t border-slate-800/60">
                            {courseNotes.map((note) => {
                              const isCopied = copiedNoteId === note.id;

                              return (
                                <div
                                  key={note.id}
                                  className="bg-slate-900/80 hover:bg-slate-900 border border-slate-800/80 hover:border-slate-700 rounded-lg p-2.5 space-y-1.5 transition-colors"
                                >
                                  {editingNoteId === note.id ? (
                                    <div className="flex items-center gap-1.5 py-0.5">
                                      <input
                                        type="text"
                                        value={editingTitle}
                                        onChange={(e) => setEditingTitle(e.target.value)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') handleSaveNoteTitle(note.id);
                                          if (e.key === 'Escape') setEditingNoteId(null);
                                        }}
                                        autoFocus
                                        disabled={isSavingTitle}
                                        placeholder={outputLanguage === 'pt' ? 'Nome da nota...' : 'Note title...'}
                                        className="w-full bg-slate-950 border border-indigo-500 rounded px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-indigo-400"
                                      />
                                      <button
                                        onClick={() => handleSaveNoteTitle(note.id)}
                                        disabled={isSavingTitle || !editingTitle.trim()}
                                        title={outputLanguage === 'pt' ? 'Guardar' : 'Save'}
                                        className="p-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded transition-colors cursor-pointer flex-shrink-0 disabled:opacity-50"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setEditingNoteId(null)}
                                        disabled={isSavingTitle}
                                        title={outputLanguage === 'pt' ? 'Cancelar' : 'Cancel'}
                                        className="p-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded transition-colors cursor-pointer flex-shrink-0"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <h4
                                      className="text-xs font-bold text-white leading-snug break-words"
                                      title={note.title}
                                    >
                                      {note.title}
                                    </h4>
                                  )}

                                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/40 gap-2">
                                    <div className="text-[10px] text-slate-500 flex items-center space-x-1.5 truncate">
                                      <span>
                                        {new Date(note.lecture_date || note.created_at).toLocaleDateString('pt-PT')}
                                      </span>
                                      <span>•</span>
                                      <span>{note.content_markdown.length.toLocaleString()} chars</span>
                                    </div>

                                    {editingNoteId !== note.id && (
                                      <div className="flex items-center space-x-1 flex-shrink-0">
                                        {/* 1. Rename Note */}
                                        <button
                                          onClick={() => {
                                            setEditingNoteId(note.id);
                                            setEditingTitle(note.title);
                                          }}
                                          title={outputLanguage === 'pt' ? 'Mudar nome da nota' : 'Rename note'}
                                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>

                                        {/* 2. Copy Direct */}
                                        <button
                                          onClick={() => handleCopyNoteDirect(note)}
                                          title={isCopied ? 'Copiado!' : 'Copiar Markdown'}
                                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors cursor-pointer"
                                        >
                                          {isCopied ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                        </button>

                                        {/* 3. Download Direct */}
                                        <button
                                          onClick={() => handleDownloadNoteDirect(note)}
                                          title="Descarregar .md (Obsidian)"
                                          className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded transition-colors cursor-pointer"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </button>

                                        {/* 4. Load in Studio Editor */}
                                        <button
                                          onClick={() => {
                                            setSynthesizedMarkdown(note.content_markdown);
                                            setLectureTitle(note.title);
                                            setShowHistoryDrawer(false);
                                          }}
                                          title="Abrir no Studio"
                                          className="p-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 hover:text-white rounded transition-colors cursor-pointer border border-indigo-800/40"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                        </button>

                                        {/* 5. Delete Note */}
                                        <button
                                          onClick={() => handleDeleteNoteDirect(note.id)}
                                          title={outputLanguage === 'pt' ? 'Apagar nota permanentemente' : 'Delete note permanently'}
                                          className="p-1.5 bg-slate-800 hover:bg-rose-950/70 text-slate-400 hover:text-rose-400 rounded transition-colors cursor-pointer border border-transparent hover:border-rose-800/50"
                                        >
                                          <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


