'use client';

import React, { useState } from 'react';
import {
  FileAudio,
  FileText,
  Upload,
  Cpu,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Sparkles,
  Zap,
} from 'lucide-react';
import { compressAudio } from '@/lib/audio/compressAudio';

interface CourseOption {
  id: string;
  name: string;
  code: string;
}

const DEFAULT_COURSES: CourseOption[] = [
  { id: '1', name: 'Distributed Systems', code: 'DS' },
  { id: '2', name: 'Operating Systems', code: 'OS' },
  { id: '3', name: 'Computer Networks', code: 'CN' },
  { id: '4', name: 'Algorithms & Data Structures', code: 'AED' },
  { id: '5', name: 'Database Architecture', code: 'DB' },
];

export default function Home() {
  const [selectedCourse, setSelectedCourse] = useState<CourseOption>(DEFAULT_COURSES[0]);
  const [lectureTitle, setLectureTitle] = useState('');
  const [lectureDate, setLectureDate] = useState(new Date().toISOString().split('T')[0]);
  const [modelName, setModelName] = useState('gemini-2.5-pro');

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

  // Audio Selection and Automatic In-Browser Compression
  const handleAudioSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAudioFile(file);
    setCompressedAudio(null);
    setErrorMessage(null);
    setCompressionProgress(0);
    setStatusMessage(`Compressing audio (${(file.size / (1024 * 1024)).toFixed(1)}MB)...`);

    try {
      const compressed = await compressAudio(file, {
        onProgress: (progress: number) => {
          setCompressionProgress(progress);
        },
      });
      setCompressedAudio(compressed);
      setCompressionProgress(100);
      setStatusMessage(
        `Optimized: ${(file.size / (1024 * 1024)).toFixed(1)}MB -> ${(compressed.size / (1024 * 1024)).toFixed(1)}MB (-${Math.round(
          (1 - compressed.size / file.size) * 100
        )}%)`
      );
    } catch (err) {
      console.error(err);
      setErrorMessage('Audio compression failed. File may be unreadable or format unsupported.');
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

  // Upload helper using Presigned URL
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
      setErrorMessage('Please specify a lecture title.');
      return;
    }

    if (!audioFile && !pdfFile) {
      setErrorMessage('Select at least one artifact: lecture audio or slides PDF.');
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);
    setSynthesizedMarkdown(null);

    try {
      let audioKey: string | undefined;
      let pdfKey: string | undefined;

      // 1. Storage Upload
      if (compressedAudio || audioFile) {
        setStatusMessage('Streaming audio binary to Cloudflare R2...');
        const fileToUpload = compressedAudio || audioFile!;
        audioKey = await uploadToStorage(fileToUpload, 'audio/mp3');
      }

      if (pdfFile) {
        setStatusMessage('Streaming PDF slide deck to Cloudflare R2...');
        pdfKey = await uploadToStorage(pdfFile, 'application/pdf');
      }

      // 2. Orchestration & LLM Synthesis
      setStatusMessage('Executing transcription and semantic synthesis...');
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
          modelName,
        }),
      });

      if (!processRes.ok) {
        const errJson = await processRes.json();
        throw new Error(errJson.error || 'Synthesis pipeline returned an error.');
      }

      const result = await processRes.json();
      setSynthesizedMarkdown(result.markdown);
      setStatusMessage('Synthesis complete.');
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

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-[#0d1322] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-indigo-600 rounded-lg shadow-sm">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-white">SynapseVault</h1>
            <p className="text-xs text-slate-400">Academic Lecture Synthesis Engine for Obsidian</p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-1 text-xs">
            <button
              onClick={() => setModelName('gemini-2.5-pro')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                modelName === 'gemini-2.5-pro'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 inline mr-1" />
              Gemini 2.5 Pro
            </button>
            <button
              onClick={() => setModelName('gemini-2.5-flash')}
              className={`px-3 py-1 rounded font-medium transition-colors ${
                modelName === 'gemini-2.5-flash'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 inline mr-1" />
              Flash
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Form & Uploads */}
        <section className="lg:col-span-5 space-y-6">
          <div className="bg-[#0f172a] border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
              Session Metadata
            </h2>

            {/* Course Selector */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Target Academic Course
              </label>
              <select
                value={selectedCourse.code}
                onChange={(e) => {
                  const course = DEFAULT_COURSES.find((c) => c.code === e.target.value);
                  if (course) setSelectedCourse(course);
                }}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {DEFAULT_COURSES.map((course) => (
                  <option key={course.id} value={course.code}>
                    {course.name} ({course.code})
                  </option>
                ))}
              </select>
            </div>

            {/* Lecture Title */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Lecture / Topic Title
              </label>
              <input
                type="text"
                placeholder="e.g. Raft Consensus Algorithm & Leader Election"
                value={lectureTitle}
                onChange={(e) => setLectureTitle(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">Date</label>
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
              Artifact Ingestion
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
                      {audioFile ? audioFile.name : 'Select or drop lecture audio'}
                    </span>
                    <span className="text-xs text-slate-400">
                      MP3, WAV, M4A, WebM (downsampled to 16kHz mono in browser)
                    </span>
                  </div>
                </div>
              </label>

              {/* Compression Progress Bar */}
              {compressionProgress !== null && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Web Audio Optimization</span>
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
                      {pdfFile ? pdfFile.name : 'Select or drop lecture slides (PDF)'}
                    </span>
                    <span className="text-xs text-slate-400">
                      Digital text streams extracted directly to conserve vision tokens
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
                  <span>Processing Pipeline...</span>
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4" />
                  <span>Synthesize Obsidian Note</span>
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
                <h3 className="text-sm font-semibold text-white">Obsidian Markdown Output</h3>
                <p className="text-xs text-slate-400">Structured graph note with LaTeX, callouts & wikilinks</p>
              </div>

              {synthesizedMarkdown && (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCopyMarkdown}
                    className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 rounded-md flex items-center space-x-1.5 transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                  <button
                    onClick={handleDownloadMarkdown}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-xs font-medium text-white rounded-md flex items-center space-x-1.5 transition-colors shadow-sm"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download .md</span>
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
                  <p className="font-sans text-sm font-medium text-slate-400">No note synthesized yet</p>
                  <p className="font-sans text-xs text-slate-600 max-w-sm mt-1">
                    Select a course, upload the lecture recording or slides, and initiate synthesis to view the structured Obsidian graph note.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
