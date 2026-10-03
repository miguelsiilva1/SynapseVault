'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  FileAudio,
  FileText,
  Upload,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  Plus,
  X,
  ShieldCheck,
  History,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  RefreshCw,
  Eye,
  Trash2,
  Pencil,
  Check,
  FileCode,
} from 'lucide-react';

import { compressAudio } from '@/lib/audio/compressAudio';
import { createClient } from '@/lib/supabase/client';
import AppHeader from '@/components/AppHeader';
import type { PersonalNoteRecord } from '@/lib/db/notes';
import { renderMarkdown } from '@/lib/utils/markdownRenderer';


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
];

export default function Home() {
  const [courses, setCourses] = useState<CourseOption[]>(DEFAULT_COURSES);
  const [selectedCourse, setSelectedCourse] = useState<CourseOption>(DEFAULT_COURSES[0]);
  const [lectureTitle, setLectureTitle] = useState('');
  const [lectureDate, setLectureDate] = useState(new Date().toISOString().split('T')[0]);
  const [outputLanguage, setOutputLanguage] = useState<'pt' | 'en'>('pt');

  // Model Selection
  const [modelPreset, setModelPreset] = useState<string>('gemini-3.6-flash');

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
  const [viewFormattedNote, setViewFormattedNote] = useState<boolean>(true);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [noteSaveStatus, setNoteSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const lastSavedNoteRef = useRef<string>('');
  const formattedNoteHtml = useMemo(
    () => (synthesizedMarkdown ? renderMarkdown(synthesizedMarkdown) : ''),
    [synthesizedMarkdown]
  );

  // Auth State
  const [currentUser, setCurrentUser] = useState<{ email?: string } | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authEmailInput, setAuthEmailInput] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authCodeSent, setAuthCodeSent] = useState(false);
  const [authCodeInput, setAuthCodeInput] = useState('');

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload only when the user changes
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
        const rateLimited = error.status === 429 || /rate limit/i.test(error.message);
        setAuthMessage(
          rateLimited
            ? outputLanguage === 'pt'
              ? 'Limite de emails atingido. Tenta outra vez dentro de uma hora, ou entra com Google ou GitHub.'
              : 'Email limit reached. Try again in an hour, or sign in with Google or GitHub.'
            : error.message
        );
      } else {
        setAuthCodeSent(true);
        setAuthMessage(
          outputLanguage === 'pt'
            ? 'Email enviado. Escreve aqui o código que recebeste (vê também o lixo/spam).'
            : 'Email sent. Type the code you received here (check spam too).'
        );
      }
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : 'OTP dispatch failed.');
    }
  };

  // The emailed code works on any device and survives mail scanners that open links.
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = authCodeInput.replace(/\D/g, '');
    if (!token) return;
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.verifyOtp({
        email: authEmailInput.trim(),
        token,
        type: 'email',
      });
      if (error) {
        setAuthMessage(
          outputLanguage === 'pt'
            ? 'Código errado ou expirado. Pede um novo código.'
            : 'Wrong or expired code. Request a new one.'
        );
      }
    } catch (err) {
      setAuthMessage(err instanceof Error ? err.message : 'Code verification failed.');
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

  const activeModelName = modelPreset;

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

      const saved = await res.json();
      showNote(pastedMarkdown.trim(), saved.id || null);
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
        const fileToUpload = compressedAudio || audioFile!;
        if (!compressedAudio && fileToUpload.size > 25 * 1024 * 1024) {
          throw new Error(
            outputLanguage === 'pt'
              ? 'O áudio excede o limite de 25MB da transcrição e precisa de ser comprimido.'
              : 'The audio exceeds the 25MB transcription limit and must be compressed.'
          );
        }
        setStatusMessage(outputLanguage === 'pt' ? 'A enviar áudio para Cloudflare R2...' : 'Streaming audio binary to Cloudflare R2...');
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
      showNote(result.markdown, result.noteId || null);
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

  // Shows a note in the output panel. noteId is null for content that is not saved (sample note).
  const showNote = (markdown: string, noteId: string | null) => {
    setSynthesizedMarkdown(markdown);
    setActiveNoteId(noteId);
    setNoteSaveStatus('idle');
    lastSavedNoteRef.current = markdown;
  };

  // Interactive mode: saves edits of the open note when the editor loses focus
  const handleSaveNoteEdits = async () => {
    const content = synthesizedMarkdown || '';
    if (!activeNoteId || !content.trim() || content === lastSavedNoteRef.current) return;
    setNoteSaveStatus('saving');
    try {
      const res = await fetch('/api/notes/personal', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: activeNoteId, contentMarkdown: content }),
      });
      if (!res.ok) throw new Error();
      lastSavedNoteRef.current = content;
      setPersonalNotes((prev) => prev.map((n) => (n.id === activeNoteId ? { ...n, content_markdown: content } : n)));
      setNoteSaveStatus('saved');
    } catch {
      setNoteSaveStatus('error');
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
    setActiveNoteId(null);
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
      <div className="min-h-screen bg-canvas flex items-center justify-center text-muted font-sans">
        <div className="flex flex-col items-center space-y-3">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-faint">
            {outputLanguage === 'pt' ? 'A verificar sessão...' : 'Verifying session...'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-canvas text-ink flex flex-col font-sans">
      <AppHeader
        active="studio"
        language={outputLanguage}
        onLanguageChange={(lang) => {
          setOutputLanguage(lang);
          localStorage.setItem('synapse_language', lang);
        }}
        email={currentUser?.email}
        onSignOut={handleSignOut}
      >
        {currentUser && (
          <button
            onClick={() => {
              setShowHistoryDrawer(true);
              loadPersonalNotes();
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line text-xs font-medium text-ink-soft hover:bg-raised transition-colors cursor-pointer"
          >
            <History className="w-3.5 h-3.5" />
            <span>{outputLanguage === 'pt' ? 'As minhas notas' : 'My notes'}</span>
            {personalNotes.length > 0 && <span className="text-faint">{personalNotes.length}</span>}
          </button>
        )}
      </AppHeader>



      {/* Auth Gate: If unauthenticated, show locked entry portal */}
      {!currentUser ? (
        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-surface border border-line rounded-xl p-8 shadow-2xl space-y-6 text-center">
            <div className="inline-flex p-3 bg-accent-soft border border-accent-line rounded-xl text-accent-ink shadow-inner">
              <ShieldCheck className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="text-xl font-bold text-ink tracking-tight">
                {outputLanguage === 'pt' ? 'Acesso Restrito ao Grupo' : 'Restricted Academic Portal'}
              </h2>
              <p className="text-xs text-muted leading-relaxed">
                {outputLanguage === 'pt'
                  ? 'O SynapseVault é de uso exclusivo da nossa turma/grupo de estudo. Autentica-te com uma conta autorizada na whitelist para aceder ao estúdio de síntese e às notas.'
                  : 'SynapseVault is restricted to our university study group. Authenticate with an authorized account to access the workspace.'}
              </p>
            </div>

            <div className="space-y-3 pt-2">
              {/* Google Button */}
              <button
                onClick={handleGoogleSignIn}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-100 text-slate-900 border border-line-strong text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors"
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
                className="w-full py-2.5 px-4 bg-[#24292F] hover:bg-[#1f2328] text-on-accent text-xs font-semibold rounded-xl flex items-center justify-center space-x-2 transition-colors border border-line-strong shadow-sm"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>{outputLanguage === 'pt' ? 'Entrar com Conta GitHub' : 'Sign In with GitHub'}</span>
              </button>
            </div>

            <div className="flex items-center my-2">
              <div className="flex-1 border-t border-line" />
              <span className="px-2 text-xs text-faint">
                {outputLanguage === 'pt' ? 'ou email' : 'or email'}
              </span>
              <div className="flex-1 border-t border-line" />
            </div>

            {/* Magic Link */}
            <form onSubmit={handleMagicLinkSignIn} className="space-y-3 text-left">
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1">
                  {outputLanguage === 'pt' ? 'Email Universitário' : 'University Email'}
                </label>
                <input
                  type="email"
                  placeholder="aluno@universidade.pt"
                  value={authEmailInput}
                  onChange={(e) => setAuthEmailInput(e.target.value)}
                  className="w-full bg-surface border border-line-strong rounded-xl px-3.5 py-2 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>

              {authMessage && (
                <div className="text-xs text-accent-ink bg-accent-soft border border-accent-line rounded-lg p-2.5">
                  {authMessage}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 bg-accent hover:bg-accent-hover text-xs font-medium text-on-accent rounded-xl transition-colors shadow-sm"
              >
                {authCodeSent
                  ? outputLanguage === 'pt' ? 'Enviar novo código' : 'Send a new code'
                  : outputLanguage === 'pt' ? 'Enviar código de acesso' : 'Send access code'}
              </button>
            </form>

            {authCodeSent && (
              <form onSubmit={handleVerifyCode} className="space-y-3 text-left">
                <div>
                  <label htmlFor="auth-code" className="block text-xs font-medium text-ink-soft mb-1">
                    {outputLanguage === 'pt' ? 'Código do email' : 'Code from the email'}
                  </label>
                  <input
                    id="auth-code"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="123456"
                    value={authCodeInput}
                    onChange={(e) => setAuthCodeInput(e.target.value)}
                    className="w-full bg-surface border border-line-strong rounded-xl px-3.5 py-2 text-sm tracking-widest text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-brand hover:brightness-110 text-xs font-medium text-on-accent rounded-xl transition-all cursor-pointer"
                >
                  {outputLanguage === 'pt' ? 'Entrar' : 'Sign in'}
                </button>
              </form>
            )}
          </div>
        </main>
      ) : (
        /* Main Workspace (Unlocked for authenticated users) */
        <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Input Form & Uploads */}
          <section className="lg:col-span-5 space-y-6">
          {/* Metadata Card */}
          <div className="bg-surface border border-line rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted">
                {outputLanguage === 'pt' ? 'Aula' : 'Lecture'}
              </h2>
              <button
                onClick={() => setIsCreatingCourse(true)}
                className="text-xs text-accent-ink hover:text-accent-ink flex items-center space-x-1 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{outputLanguage === 'pt' ? 'Nova Cadeira' : 'New Course'}</span>
              </button>
            </div>

            {/* Course Selector */}
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1.5">
                {outputLanguage === 'pt' ? 'Cadeira / Disciplina' : 'Target Academic Course'}
              </label>
              <select
                value={selectedCourse.code}
                onChange={(e) => {
                  const course = courses.find((c) => c.code === e.target.value);
                  if (course) setSelectedCourse(course);
                }}
                className="w-full bg-surface border border-line-strong rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
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
              <label className="block text-xs font-medium text-ink-soft mb-1.5">
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
                className="w-full bg-surface border border-line-strong rounded-lg px-3 py-2 text-sm text-ink placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1.5">
                {outputLanguage === 'pt' ? 'Data da Aula' : 'Date'}
              </label>
              <input
                type="date"
                value={lectureDate}
                onChange={(e) => setLectureDate(e.target.value)}
                className="w-full bg-surface border border-line-strong rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
          </div>

          {/* Ingestion Dropzones */}
          <div className="bg-surface border border-line rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold text-muted">
              {outputLanguage === 'pt' ? 'Materiais' : 'Materials'}
            </h2>

            {/* Audio Upload */}
            <div className="border border-dashed border-line-strong hover:border-accent-line rounded-xl p-4 bg-surface transition-colors">
              <label className="cursor-pointer block">
                <input
                  type="file"
                  accept="audio/*,.mp3,.wav,.m4a,.webm,.ogg"
                  onChange={handleAudioSelect}
                  className="hidden"
                />
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 bg-accent-soft border border-accent-line rounded-lg text-accent-ink">
                    <FileAudio className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-ink block">
                      {audioFile
                        ? audioFile.name
                        : outputLanguage === 'pt'
                        ? 'Arrasta ou seleciona gravação da aula'
                        : 'Select or drop lecture audio'}
                    </span>
                    <span className="text-xs text-muted">
                      {outputLanguage === 'pt'
                        ? 'MP3, WAV, M4A, WebM (comprimido para 16kHz mono no browser)'
                        : 'MP3, WAV, M4A, WebM (downsampled to 16kHz mono in browser)'}
                    </span>
                  </div>
                </div>
              </label>

              {/* Compression Progress Bar */}
              {compressionProgress !== null && (
                <div className="mt-3 pt-3 border-t border-line">
                  <div className="flex justify-between text-xs text-muted mb-1">
                    <span>{outputLanguage === 'pt' ? 'Otimização Web Audio' : 'Web Audio Optimization'}</span>
                    <span>{compressionProgress}%</span>
                  </div>
                  <div className="w-full bg-raised h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-accent-hover h-full transition-all duration-150"
                      style={{ width: `${compressionProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* PDF Upload */}
            <div className="border border-dashed border-line-strong hover:border-accent-line rounded-xl p-4 bg-surface transition-colors">
              <label className="cursor-pointer block">
                <input type="file" accept="application/pdf" onChange={handlePdfSelect} className="hidden" />
                <div className="flex items-start space-x-3">
                  <div className="p-2.5 bg-raised border border-line-strong rounded-lg text-ink-soft">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <span className="text-sm font-medium text-ink block">
                      {pdfFile
                        ? pdfFile.name
                        : outputLanguage === 'pt'
                        ? 'Arrasta ou seleciona slides da aula (PDF)'
                        : 'Select or drop lecture slides (PDF)'}
                    </span>
                    <span className="text-xs text-muted">
                      {outputLanguage === 'pt'
                        ? 'Texto extraído diretamente sem gastar tokens de visão'
                        : 'Digital text streams extracted directly to conserve vision tokens'}
                    </span>
                  </div>
                </div>
              </label>
            </div>

            {/* Markdown Direct Paste */}
            <div className="border border-dashed border-line-strong hover:border-accent-line rounded-xl p-4 bg-surface transition-colors space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2.5 bg-ok-soft border border-ok-line rounded-lg text-ok">
                    <FileCode className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-ink block">
                      {outputLanguage === 'pt' ? 'Colar Resumo em Markdown' : 'Paste Markdown Summary'}
                    </span>
                    <span className="text-xs text-muted">
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
                    className="text-xs text-muted hover:text-danger transition-colors cursor-pointer"
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
                className="w-full bg-canvas border border-line rounded-lg p-2.5 text-xs text-ink placeholder:text-faint focus:outline-none focus:ring-1 focus:ring-accent leading-relaxed"
              />

              {pastedMarkdown.trim() && (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-faint">
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
                    className="px-2.5 py-1 bg-raised hover:bg-raised-strong disabled:opacity-50 border border-line-strong text-ink hover:text-ink rounded text-xs transition-colors flex items-center space-x-1.5 cursor-pointer"
                  >
                    {isSavingDirectNote && <RefreshCw className="w-3 h-3 animate-spin text-accent-ink" />}
                    <span>{outputLanguage === 'pt' ? 'Guardar Direto (Sem IA)' : 'Save Direct (No AI)'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Status / Errors */}
            {statusMessage && (
              <div className="text-xs text-accent-ink bg-accent-soft border border-accent-line rounded-lg p-2.5 flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-accent-ink shrink-0" />
                <span>{statusMessage}</span>
              </div>
            )}

            {errorMessage && (
              <div className="text-xs text-danger bg-danger-soft border border-danger-line rounded-lg p-2.5 flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-danger shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Model */}
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="model-preset" className="text-xs font-medium text-ink-soft">
                {outputLanguage === 'pt' ? 'Modelo' : 'Model'}
              </label>
              <select
                id="model-preset"
                value={modelPreset}
                onChange={(e) => setModelPreset(e.target.value)}
                className="bg-surface border border-line-strong rounded-lg px-2.5 py-1.5 text-xs text-ink focus:outline-none focus:ring-2 focus:ring-accent cursor-pointer"
              >
                {AVAILABLE_MODELS.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Button */}
            <button
              onClick={handleStartPipeline}
              disabled={isProcessing || isCompressing || isAlreadySynthesized}
              className={`w-full py-3 px-4 rounded-lg font-medium text-sm text-on-accent flex items-center justify-center space-x-2 transition-all ${
                isProcessing || isCompressing
                  ? 'bg-brand opacity-60 cursor-not-allowed'
                  : isAlreadySynthesized
                  ? 'bg-ok-solid cursor-default'
                  : 'bg-brand hover:brightness-110 active:scale-[0.99] cursor-pointer'
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
                  <CheckCircle2 className="w-4 h-4" />
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
                      ? 'Gerar resumo'
                      : 'Generate summary'}
                  </span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Right Column: Output / Obsidian View */}
        <section className="lg:col-span-7 flex flex-col">
          <div className="bg-surface border border-line rounded-xl flex-1 flex flex-col shadow-sm overflow-hidden">
            {/* Output Header */}
            <div className="border-b border-line px-5 py-3.5 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-ink">
                  {outputLanguage === 'pt' ? 'Resumo' : 'Summary'}
                </h3>
                <p className="text-xs text-muted">
                  {outputLanguage === 'pt'
                    ? 'Markdown pronto para o Obsidian'
                    : 'Markdown ready for Obsidian'}
                </p>
              </div>

              {synthesizedMarkdown !== null && (
                <div className="flex items-center space-x-2">
                  {!viewFormattedNote && (
                    <span className="text-xs text-faint">
                      {!activeNoteId
                        ? outputLanguage === 'pt' ? 'Edição local (não guardada)' : 'Local edit (not saved)'
                        : noteSaveStatus === 'saving'
                        ? outputLanguage === 'pt' ? 'A guardar...' : 'Saving...'
                        : noteSaveStatus === 'saved'
                        ? outputLanguage === 'pt' ? 'Guardado automaticamente' : 'Auto-saved'
                        : noteSaveStatus === 'error'
                        ? outputLanguage === 'pt' ? 'Erro ao guardar' : 'Save error'
                        : outputLanguage === 'pt' ? 'Edição interativa ativa' : 'Interactive editor active'}
                    </span>
                  )}
                  <button
                    onClick={() => setViewFormattedNote(!viewFormattedNote)}
                    title={
                      viewFormattedNote
                        ? outputLanguage === 'pt' ? 'Editar o Markdown' : 'Edit the Markdown'
                        : outputLanguage === 'pt' ? 'Ver Markdown formatado' : 'View formatted Markdown'
                    }
                    className="px-2.5 py-1.5 bg-raised hover:bg-raised-strong text-xs font-medium text-ink rounded-md flex items-center space-x-1.5 transition-colors"
                  >
                    {viewFormattedNote ? <Pencil className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>
                      {viewFormattedNote
                        ? outputLanguage === 'pt' ? 'Modo Interativo' : 'Interactive'
                        : outputLanguage === 'pt' ? 'Visualização' : 'Preview'}
                    </span>
                  </button>
                  <button
                    onClick={handleCopyMarkdown}
                    className="px-2.5 py-1.5 bg-raised hover:bg-raised-strong text-xs font-medium text-ink rounded-md flex items-center space-x-1.5 transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-ok" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? (outputLanguage === 'pt' ? 'Copiado!' : 'Copied') : (outputLanguage === 'pt' ? 'Copiar' : 'Copy')}</span>
                  </button>
                  <button
                    onClick={handleDownloadMarkdown}
                    className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-xs font-medium text-on-accent rounded-md flex items-center space-x-1.5 transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{outputLanguage === 'pt' ? 'Descarregar .md' : 'Download .md'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Output Body */}
            <div className="flex-1 p-5 overflow-auto text-xs text-ink-soft leading-relaxed">
              {synthesizedMarkdown !== null ? (
                viewFormattedNote ? (
                  <article className="markdown-body font-sans">
                    <div dangerouslySetInnerHTML={{ __html: formattedNoteHtml }} />
                  </article>
                ) : (
                  <textarea
                    value={synthesizedMarkdown}
                    onChange={(e) => setSynthesizedMarkdown(e.target.value)}
                    onBlur={handleSaveNoteEdits}
                    spellCheck={false}
                    className="w-full h-full min-h-150 bg-transparent text-ink-soft text-xs leading-relaxed resize-none border-0 focus:outline-none whitespace-pre-wrap"
                  />
                )
              ) : (
                <div className="h-full min-h-105 flex flex-col items-center justify-center text-center p-6 text-faint">
                  <FileText className="w-10 h-10 text-faint mb-3 stroke-[1.5]" />
                  <p className="font-sans text-sm font-medium text-muted">
                    {outputLanguage === 'pt' ? 'Nenhuma nota gerada ainda' : 'No note synthesized yet'}
                  </p>
                  <p className="font-sans text-xs text-faint max-w-sm mt-1">
                    {outputLanguage === 'pt'
                      ? 'Seleciona a cadeira, envia a gravação ou slides e clica em sintetizar para gerar a nota estruturada.'
                      : 'Select a course, upload the lecture recording or slides, and initiate synthesis to view the structured Obsidian graph note.'}
                  </p>
                  <button
                    onClick={handleLoadSample}
                    className="mt-4 px-3 py-1.5 bg-raised hover:bg-raised-strong text-xs font-medium text-ink-soft rounded-lg transition-colors border border-line-strong hover:text-ink"
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
          <div className="bg-surface border border-line rounded-xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <h3 className="text-sm font-bold text-ink">
                {outputLanguage === 'pt' ? 'Adicionar Nova Cadeira' : 'Create New Academic Course'}
              </h3>
              <button
                onClick={() => setIsCreatingCourse(false)}
                className="text-muted hover:text-ink transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1">
                  {outputLanguage === 'pt' ? 'Nome da Cadeira' : 'Course Name'}
                </label>
                <input
                  type="text"
                  placeholder={outputLanguage === 'pt' ? 'ex: Arquitetura de Computadores' : 'e.g. Computer Architecture'}
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full bg-surface border border-line-strong rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-ink-soft mb-1">
                  {outputLanguage === 'pt' ? 'Sigla / Código' : 'Course Code'}
                </label>
                <input
                  type="text"
                  placeholder={outputLanguage === 'pt' ? 'ex: AC' : 'e.g. CA'}
                  value={newCourseCode}
                  onChange={(e) => setNewCourseCode(e.target.value)}
                  className="w-full bg-surface border border-line-strong rounded-lg px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
                  required
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatingCourse(false)}
                  className="px-3 py-2 text-xs text-muted hover:text-ink transition-colors"
                >
                  {outputLanguage === 'pt' ? 'Cancelar' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-accent hover:bg-accent-hover text-xs font-medium text-on-accent rounded-lg transition-colors"
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
            <div className="w-screen max-w-md bg-surface border-l border-line p-6 flex flex-col space-y-4 shadow-2xl">
              {/* Drawer Header */}
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div className="flex items-center space-x-2">
                  <History className="w-5 h-5 text-accent-ink" />
                  <h3 className="text-base font-bold text-ink">Meu Histórico</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-accent-soft text-accent-ink font-bold">
                    {personalNotes.length} notas
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-raised text-muted">
                    {groupedPersonalNotes.length} cadeiras
                  </span>
                </div>
                <button
                  onClick={() => setShowHistoryDrawer(false)}
                  className="text-muted hover:text-ink transition-colors cursor-pointer text-sm p-1 rounded hover:bg-raised"
                >
                  ✕
                </button>
              </div>

              <p className="text-xs text-muted leading-relaxed">
                Notas organizadas por cadeira curricular. Podes copiar ou descarregar diretamente sem abrir no editor.
              </p>

              {/* Drawer Content */}
              <div className="flex-1 overflow-y-auto space-y-3 pr-1 text-xs">
                {loadingHistory ? (
                  <div className="space-y-3 animate-pulse">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-20 bg-canvas rounded-xl" />
                    ))}
                  </div>
                ) : personalNotes.length === 0 ? (
                  <div className="text-center py-16 space-y-2 text-faint">
                    <Folder className="w-8 h-8 mx-auto text-faint" />
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
                        className="bg-canvas border border-line rounded-xl overflow-hidden transition-colors"
                      >
                        {/* Course Folder Header (Accordion) */}
                        <button
                          onClick={() => toggleCourseFolder(courseCode)}
                          className="w-full flex items-center justify-between p-3 bg-surface hover:bg-surface text-left transition-colors cursor-pointer"
                        >
                          <div className="flex items-center space-x-2 truncate pr-2">
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-accent-ink shrink-0" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-faint shrink-0" />
                            )}
                            {isExpanded ? (
                              <FolderOpen className="w-4 h-4 text-warn shrink-0" />
                            ) : (
                              <Folder className="w-4 h-4 text-warn shrink-0" />
                            )}
                            <span className="font-bold text-ink text-xs">{courseCode}</span>
                            <span className="text-muted text-xs truncate max-w-42.5">
                              - {courseDisplayName}
                            </span>
                          </div>

                          <span className="px-1.5 py-0.2 rounded-full text-xs font-bold bg-accent-soft text-accent-ink border border-accent-line shrink-0">
                            {courseNotes.length}
                          </span>
                        </button>

                        {/* Notes List inside Course Folder */}
                        {isExpanded && (
                          <div className="p-2 space-y-2 border-t border-line">
                            {courseNotes.map((note) => {
                              const isCopied = copiedNoteId === note.id;

                              return (
                                <div
                                  key={note.id}
                                  className="bg-surface hover:bg-surface border border-line hover:border-line-strong rounded-lg p-2.5 space-y-1.5 transition-colors"
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
                                        className="w-full bg-canvas border border-accent rounded px-2 py-1 text-xs text-ink focus:outline-none focus:ring-1 focus:ring-accent"
                                      />
                                      <button
                                        onClick={() => handleSaveNoteTitle(note.id)}
                                        disabled={isSavingTitle || !editingTitle.trim()}
                                        title={outputLanguage === 'pt' ? 'Guardar' : 'Save'}
                                        className="p-1 bg-ok-solid hover:bg-ok-solid-hover text-on-accent rounded transition-colors cursor-pointer shrink-0 disabled:opacity-50"
                                      >
                                        <Check className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        onClick={() => setEditingNoteId(null)}
                                        disabled={isSavingTitle}
                                        title={outputLanguage === 'pt' ? 'Cancelar' : 'Cancel'}
                                        className="p-1 bg-raised hover:bg-raised-strong text-ink-soft rounded transition-colors cursor-pointer shrink-0"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ) : (
                                    <h4
                                      className="text-xs font-bold text-ink leading-snug wrap-break-word"
                                      title={note.title}
                                    >
                                      {note.title}
                                    </h4>
                                  )}

                                  <div className="flex items-center justify-between pt-1 border-t border-line gap-2">
                                    <div className="text-xs text-faint flex items-center space-x-1.5 truncate">
                                      <span>
                                        {new Date(note.lecture_date || note.created_at).toLocaleDateString('pt-PT')}
                                      </span>
                                      <span>•</span>
                                      <span>{note.content_markdown.length.toLocaleString()} chars</span>
                                    </div>

                                    {editingNoteId !== note.id && (
                                      <div className="flex items-center space-x-1 shrink-0">
                                        {/* 1. Rename Note */}
                                        <button
                                          onClick={() => {
                                            setEditingNoteId(note.id);
                                            setEditingTitle(note.title);
                                          }}
                                          title={outputLanguage === 'pt' ? 'Mudar nome da nota' : 'Rename note'}
                                          className="p-1.5 bg-raised hover:bg-raised-strong text-muted hover:text-ink rounded transition-colors cursor-pointer"
                                        >
                                          <Pencil className="w-3.5 h-3.5" />
                                        </button>

                                        {/* 2. Copy Direct */}
                                        <button
                                          onClick={() => handleCopyNoteDirect(note)}
                                          title={isCopied ? 'Copiado!' : 'Copiar Markdown'}
                                          className="p-1.5 bg-raised hover:bg-raised-strong text-ink-soft hover:text-ink rounded transition-colors cursor-pointer"
                                        >
                                          {isCopied ? (
                                            <CheckCircle2 className="w-3.5 h-3.5 text-ok" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                        </button>

                                        {/* 3. Download Direct */}
                                        <button
                                          onClick={() => handleDownloadNoteDirect(note)}
                                          title="Descarregar .md (Obsidian)"
                                          className="p-1.5 bg-raised hover:bg-raised-strong text-ink-soft hover:text-ink rounded transition-colors cursor-pointer"
                                        >
                                          <Download className="w-3.5 h-3.5" />
                                        </button>

                                        {/* 4. Load in Studio Editor */}
                                        <button
                                          onClick={() => {
                                            showNote(note.content_markdown, note.id);
                                            setLectureTitle(note.title);
                                            setShowHistoryDrawer(false);
                                          }}
                                          title="Abrir no Studio"
                                          className="p-1.5 bg-accent-soft hover:bg-accent-soft text-accent-ink hover:text-ink rounded transition-colors cursor-pointer border border-accent-line"
                                        >
                                          <Eye className="w-3.5 h-3.5" />
                                        </button>

                                        {/* 5. Delete Note */}
                                        <button
                                          onClick={() => handleDeleteNoteDirect(note.id)}
                                          title={outputLanguage === 'pt' ? 'Apagar nota permanentemente' : 'Delete note permanently'}
                                          className="p-1.5 bg-raised hover:bg-danger-soft text-muted hover:text-danger rounded transition-colors cursor-pointer border border-transparent hover:border-danger-line"
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


