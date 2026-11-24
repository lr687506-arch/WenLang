import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { supabase, isSafeMediaUrl } from '../services/supabaseClient';
import { resolveTermMeaning, type LookupResult } from '../services/translationService';
import { useAuth } from '../context/AuthContext';
import type { TextItem, AuthorAnnotation, Exam } from '../types/database';
import { getLanguageLabel } from '../constants/languages';
import type { ThemeMode } from '../hooks/useTheme';
import {
  ArrowLeft,
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  BookmarkPlus,
  BookmarkCheck,
  BookMarked,
  Languages,
  ClipboardCheck,
  X,
  Loader2,
  AlertCircle,
  Sun,
  Moon,
  Trash2,
} from 'lucide-react';

interface ReadingViewProps {
  textId: string;
  onBack: () => void;
  onStartExam: (examId: string, textId: string) => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

interface TextSegment {
  text: string;
  startIndex: number;
  endIndex: number;
  annotation?: AuthorAnnotation;
}

interface PopoverState {
  selectedText: string;
  rect: { top: number; left: number; bottom: number; width: number };
  loading: boolean;
  error: string | null;
  result: LookupResult | null;
  saved: boolean;
  saving: boolean;
}

const FONT_SIZES = [
  { id: 'sm', label: 'P', className: 'text-[16px] leading-[1.8]' },
  { id: 'md', label: 'M', className: 'text-[19px] leading-[1.85]' },
  { id: 'lg', label: 'G', className: 'text-[22px] leading-[1.9]' },
  { id: 'xl', label: 'XG', className: 'text-[26px] leading-[1.95]' },
];

function formatTime(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '00:00';
  const mins = Math.floor(sec / 60);
  const rem = Math.floor(sec % 60);
  return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
}

/**
 * Splits a paragraph into plain segments and author-annotated segments
 * without overlapping, prioritizing explicit start_index/end_index first
 * and falling back to term_or_phrase substring matches.
 */
function buildParagraphSegments(
  paragraph: string,
  paragraphGlobalOffset: number,
  annotations: AuthorAnnotation[]
): TextSegment[] {
  if (!annotations.length || !paragraph) {
    return [{ text: paragraph, startIndex: paragraphGlobalOffset, endIndex: paragraphGlobalOffset + paragraph.length }];
  }

  interface SpanMatch {
    localStart: number;
    localEnd: number;
    annotation: AuthorAnnotation;
  }

  const matches: SpanMatch[] = [];
  const pEnd = paragraphGlobalOffset + paragraph.length;

  // 1. Indexed annotations falling within this paragraph
  for (const ann of annotations) {
    if (
      ann.start_index !== null &&
      ann.end_index !== null &&
      ann.start_index >= paragraphGlobalOffset &&
      ann.end_index <= pEnd
    ) {
      matches.push({
        localStart: ann.start_index - paragraphGlobalOffset,
        localEnd: ann.end_index - paragraphGlobalOffset,
        annotation: ann,
      });
    }
  }

  // 2. Term-based matching for annotations without explicit indices (or cross-occurrences)
  const lowerParagraph = paragraph.toLowerCase();
  const sortedByLen = [...annotations].sort(
    (a, b) => b.term_or_phrase.length - a.term_or_phrase.length
  );

  for (const ann of sortedByLen) {
    const term = ann.term_or_phrase.trim();
    if (!term) continue;
    const lowerTerm = term.toLowerCase();
    let searchFrom = 0;

    while (searchFrom < lowerParagraph.length) {
      const idx = lowerParagraph.indexOf(lowerTerm, searchFrom);
      if (idx === -1) break;
      const localEnd = idx + term.length;

      // For Latin words, ensure whole-word boundary so "in" does not match inside "window"
      const isLatinWord = /^[a-z0-9\u00c0-\u024f\s'-]+$/i.test(term);
      let boundaryOk = true;
      if (isLatinWord) {
        const before = idx > 0 ? paragraph[idx - 1] : '';
        const after = localEnd < paragraph.length ? paragraph[localEnd] : '';
        const wordChar = /[a-z0-9\u00c0-\u024f]/i;
        if ((before && wordChar.test(before)) || (after && wordChar.test(after))) {
          boundaryOk = false;
        }
      }

      if (boundaryOk) {
        const overlaps = matches.some(
          (m) => !(localEnd <= m.localStart || idx >= m.localEnd)
        );
        if (!overlaps) {
          matches.push({ localStart: idx, localEnd, annotation: ann });
        }
      }
      searchFrom = idx + Math.max(1, term.length);
    }
  }

  matches.sort((a, b) => a.localStart - b.localStart);

  // Build non-overlapping segments
  const segments: TextSegment[] = [];
  let cursor = 0;

  for (const m of matches) {
    if (m.localStart < cursor) continue;
    if (m.localStart > cursor) {
      segments.push({
        text: paragraph.slice(cursor, m.localStart),
        startIndex: paragraphGlobalOffset + cursor,
        endIndex: paragraphGlobalOffset + m.localStart,
      });
    }
    segments.push({
      text: paragraph.slice(m.localStart, m.localEnd),
      startIndex: paragraphGlobalOffset + m.localStart,
      endIndex: paragraphGlobalOffset + m.localEnd,
      annotation: m.annotation,
    });
    cursor = m.localEnd;
  }

  if (cursor < paragraph.length) {
    segments.push({
      text: paragraph.slice(cursor),
      startIndex: paragraphGlobalOffset + cursor,
      endIndex: paragraphGlobalOffset + paragraph.length,
    });
  }

  return segments;
}

export function ReadingView({
  textId,
  onBack,
  onStartExam,
  theme,
  onToggleTheme,
}: ReadingViewProps) {
  const { user, profile } = useAuth();
  const [textItem, setTextItem] = useState<TextItem | null>(null);
  const [annotations, setAnnotations] = useState<AuthorAnnotation[]>([]);
  const [exam, setExam] = useState<Exam | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Typography preferences
  const [fontSizeIdx, setFontSizeIdx] = useState(1);
  const [useSerifBody, setUseSerifBody] = useState(true);

  // Audio player state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);

  // Contextual Popover / Bottom Sheet state
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const articleRef = useRef<HTMLDivElement | null>(null);
  const lookupSeqRef = useRef(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setPopover(null);

    Promise.all([
      supabase
        .from('texts')
        .select(
          `
          *,
          author:profiles!texts_author_id_fkey(id, username, full_name, avatar_url)
        `
        )
        .eq('id', textId)
        .single(),
      supabase
        .from('author_annotations')
        .select('*')
        .eq('text_id', textId)
        .order('start_index', { ascending: true, nullsFirst: false }),
      supabase
        .from('exams')
        .select('id, text_id, title, created_at')
        .eq('text_id', textId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]).then(([textRes, annRes, examRes]) => {
      if (!active) return;
      if (textRes.error || !textRes.data) {
        setError(textRes.error?.message || 'Texto não encontrado.');
        setLoading(false);
        return;
      }

      const rawText = textRes.data as unknown as TextItem;
      setTextItem({
        ...rawText,
        author: Array.isArray(rawText.author) ? rawText.author[0] ?? null : rawText.author ?? null,
      });
      setAnnotations((annRes.data || []) as AuthorAnnotation[]);
      setExam((examRes.data as Exam | null) || null);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [textId]);

  // Close popover on Escape or outside click
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPopover(null);
    };
    const handlePointerDown = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        articleRef.current &&
        !articleRef.current.contains(e.target as Node)
      ) {
        setPopover(null);
      }
    };
    window.addEventListener('keydown', handleKey);
    document.addEventListener('mousedown', handlePointerDown);
    return () => {
      window.removeEventListener('keydown', handleKey);
      document.removeEventListener('mousedown', handlePointerDown);
    };
  }, []);

  // Split paragraphs preserving exact global offsets
  const paragraphs = useMemo(() => {
    if (!textItem?.content) return [];
    const lines = textItem.content.split(/\n+/);
    const result: Array<{ index: number; text: string; offset: number; segments: TextSegment[] }> = [];
    let searchCursor = 0;

    lines.forEach((line, index) => {
      const foundOffset = textItem.content.indexOf(line, searchCursor);
      const offset = foundOffset >= 0 ? foundOffset : searchCursor;
      searchCursor = offset + line.length;
      if (line.trim()) {
        result.push({
          index,
          text: line,
          offset,
          segments: buildParagraphSegments(line, offset, annotations),
        });
      }
    });
    return result;
  }, [textItem?.content, annotations]);

  // Determine active synced paragraph if audio_timestamps exist
  const activeParagraphIndex = useMemo(() => {
    const ts = textItem?.audio_timestamps;
    if (!Array.isArray(ts) || !ts.length || !isPlaying) return -1;
    const active = ts.find(
      (entry) =>
        currentTime >= entry.startSeconds &&
        (entry.endSeconds === undefined || currentTime <= entry.endSeconds)
    );
    return active ? active.paragraphIndex : -1;
  }, [textItem?.audio_timestamps, currentTime, isPlaying]);

  // Core hybrid lookup trigger (Step A Author -> Step B DeepL)
  const triggerLookup = useCallback(
    async (
      selectedText: string,
      rect: { top: number; left: number; bottom: number; width: number },
      startIndex?: number | null,
      endIndex?: number | null
    ) => {
      if (!textItem) return;
      const cleaned = selectedText.trim();
      if (!cleaned) return;

      const seq = ++lookupSeqRef.current;

      setPopover({
        selectedText: cleaned,
        rect,
        loading: true,
        error: null,
        result: null,
        saved: false,
        saving: false,
      });

      try {
        const result = await resolveTermMeaning({
          selectedText: cleaned,
          fullText: textItem.content,
          annotations,
          targetNativeLanguage: profile?.native_language || 'PT-BR',
          sourceLanguage: textItem.language,
          selectionStartIndex: startIndex,
          selectionEndIndex: endIndex,
        });

        if (lookupSeqRef.current !== seq) return;
        setPopover((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                result,
                error: null,
              }
            : null
        );
      } catch (err) {
        if (lookupSeqRef.current !== seq) return;
        setPopover((prev) =>
          prev
            ? {
                ...prev,
                loading: false,
                error: err instanceof Error ? err.message : 'Erro ao consultar significado.',
              }
            : null
        );
      }
    },
    [textItem, annotations, profile?.native_language]
  );

  // Clicking an explicitly highlighted author annotation
  const handleAnnotationClick = (
    e: React.MouseEvent<HTMLButtonElement>,
    segment: TextSegment
  ) => {
    e.stopPropagation();
    const domRect = e.currentTarget.getBoundingClientRect();
    triggerLookup(
      segment.text,
      {
        top: domRect.top,
        left: domRect.left,
        bottom: domRect.bottom,
        width: domRect.width,
      },
      segment.startIndex,
      segment.endIndex
    );
  };

  // Mouse/Touch selection anywhere in the article body via window.getSelection()
  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;

    const selectedStr = selection.toString().trim();
    if (!selectedStr || selectedStr.length > 1200) return;

    // Ensure selection lives inside the article container
    if (
      articleRef.current &&
      selection.anchorNode &&
      !articleRef.current.contains(selection.anchorNode)
    ) {
      return;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    triggerLookup(selectedStr, {
      top: rect.top,
      left: rect.left,
      bottom: rect.bottom,
      width: rect.width,
    });
  };

  // Clicking any single non-annotated word (for tap-to-translate ergonomics on desktop & mobile)
  const handleWordClick = (
    e: React.MouseEvent<HTMLSpanElement>,
    word: string,
    wordGlobalStart: number
  ) => {
    // If user just finished dragging a multi-word selection, let handleTextSelection handle it
    const activeSel = window.getSelection()?.toString().trim();
    if (activeSel && activeSel.length > word.length) return;

    const trimmed = word.trim();
    if (!trimmed || /^[\s.,!?;:()[\]{}"'“”‘’。、！？：；—–-]+$/.test(trimmed)) return;

    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    triggerLookup(
      trimmed,
      { top: rect.top, left: rect.left, bottom: rect.bottom, width: rect.width },
      wordGlobalStart,
      wordGlobalStart + word.length
    );
  };

  const handleSaveVocabulary = async () => {
    if (!user || !popover?.result || popover.saved || popover.saving) return;

    setPopover((prev) => (prev ? { ...prev, saving: true, error: null } : null));

    const { error: insertErr } = await supabase.from('saved_vocabulary').insert({
      user_id: user.id,
      text_id: textItem?.id ?? null,
      original_text: popover.result.originalText,
      translated_text: popover.result.translatedText,
      context_sentence: popover.result.contextSentence || null,
      source: popover.result.source,
    });

    if (insertErr) {
      setPopover((prev) =>
        prev ? { ...prev, saving: false, error: `Erro ao salvar: ${insertErr.message}` } : null
      );
      return;
    }

    setPopover((prev) => (prev ? { ...prev, saving: false, saved: true } : null));
  };

  // Audio player controls
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(() => {});
    }
  };

  const seekBy = (delta: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(duration || 0, audio.currentTime + delta));
  };

  const cycleRate = () => {
    const rates = [0.75, 1, 1.25, 1.5];
    const next = rates[(rates.indexOf(playbackRate) + 1) % rates.length];
    setPlaybackRate(next);
    if (audioRef.current) {
      audioRef.current.playbackRate = next;
    }
  };

  const handleDeleteOwnText = async () => {
    if (!textItem || !user || textItem.author_id !== user.id || deleting) return;
    setDeleting(true);
    const { error: delErr } = await supabase.from('texts').delete().eq('id', textItem.id);
    if (delErr) {
      setError(delErr.message);
      setDeleting(false);
      return;
    }
    onBack();
  };

  // Compute clamped desktop popover position
  const desktopPopoverStyle = useMemo<React.CSSProperties>(() => {
    if (!popover) return {};
    const popW = 360;
    const popH = 260;
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;

    let left = popover.rect.left + popover.rect.width / 2 - popW / 2;
    left = Math.max(16, Math.min(vw - popW - 16, left));

    let top = popover.rect.bottom + 12;
    if (top + popH > vh - 20) {
      top = Math.max(72, popover.rect.top - popH - 12);
    }

    return { top, left, width: popW };
  }, [popover]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
        <p className="text-sm">Preparando estúdio de leitura...</p>
      </div>
    );
  }

  if (error || !textItem) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para biblioteca</span>
        </button>
        <div className="p-6 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold text-sm">Não foi possível abrir o texto</p>
            <p className="text-sm mt-1">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const audioSafe = isSafeMediaUrl(textItem.audio_url);
  const coverSafe = isSafeMediaUrl(textItem.cover_image_url);
  const isOwner = Boolean(user && textItem.author_id === user.id);

  return (
    <div className="pb-28 md:pb-16">
      {/* Reader Sub-Toolbar */}
      <div className="sticky top-16 z-20 bg-[#F8FAFC]/95 dark:bg-[#0B0F17]/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-950 dark:hover:text-white transition-colors min-h-[36px] whitespace-nowrap"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Biblioteca</span>
          </button>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Font Size Segmented Control */}
            <div
              role="group"
              aria-label="Tamanho da fonte"
              className="flex items-center gap-0.5 p-0.5 rounded-lg bg-slate-200/70 dark:bg-[#131926] border border-slate-200 dark:border-slate-800"
            >
              {FONT_SIZES.map((fs, i) => (
                <button
                  key={fs.id}
                  type="button"
                  onClick={() => setFontSizeIdx(i)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors ${
                    fontSizeIdx === i
                      ? 'bg-white dark:bg-[#1E293B] text-slate-950 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                  }`}
                >
                  {fs.label}
                </button>
              ))}
            </div>

            {/* Serif / Sans Toggle */}
            <button
              type="button"
              onClick={() => setUseSerifBody((v) => !v)}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-colors whitespace-nowrap"
            >
              {useSerifBody ? 'Fonte Serif' : 'Fonte Sans'}
            </button>

            {/* Theme Toggle */}
            <button
              type="button"
              onClick={onToggleTheme}
              aria-label="Alternar modo claro ou escuro"
              className="p-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {exam && (
              <button
                type="button"
                onClick={() => onStartExam(exam.id, textItem.id)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Fazer Exame</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Two-Column Reading Studio */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-8 grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
        {/* Primary Reading Column */}
        <article className="lg:col-span-8">
          {/* Header Metadata */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-semibold text-orange-700 dark:text-orange-400">
              {getLanguageLabel(textItem.language)}
            </span>
            <span aria-hidden="true">·</span>
            <span>{textItem.difficulty_level}</span>
            <span aria-hidden="true">·</span>
            <span>
              Por {textItem.author?.full_name || textItem.author?.username || 'Autor WenLang'}
            </span>
            {annotations.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-emerald-700 dark:text-emerald-400 font-medium tabular-nums">
                  {annotations.length} nota(s) do autor
                </span>
              </>
            )}
          </div>

          <h1 className="mt-3 font-display text-3xl sm:text-4xl font-semibold text-slate-950 dark:text-slate-50 leading-tight">
            {textItem.title}
          </h1>

          {/* Cover Banner */}
          {coverSafe && textItem.cover_image_url && (
            <div className="mt-6 aspect-[16/9] w-full rounded-2xl overflow-hidden bg-slate-200 dark:bg-slate-800 border border-slate-200 dark:border-slate-800">
              <img
                src={textItem.cover_image_url}
                alt={textItem.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Integrated HTML5 Audio Player (Supabase Storage) */}
          {audioSafe && textItem.audio_url && (
            <div className="mt-6 p-4 rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800">
              <audio
                ref={audioRef}
                src={textItem.audio_url}
                preload="metadata"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
              />

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={togglePlay}
                  aria-label={isPlaying ? 'Pausar áudio' : 'Reproduzir áudio'}
                  className="w-10 h-10 rounded-lg bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center shrink-0 transition-colors"
                >
                  {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>

                <button
                  type="button"
                  onClick={() => seekBy(-10)}
                  aria-label="Voltar 10 segundos"
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400 tabular-nums mb-1">
                    <span className="inline-flex items-center gap-1.5 font-sans font-medium text-slate-700 dark:text-slate-200">
                      <Volume2 className="w-3.5 h-3.5 text-orange-600 dark:text-orange-400" />
                      Narração do texto
                    </span>
                    <span>
                      {formatTime(currentTime)} / {formatTime(duration)}
                    </span>
                  </div>
                  <input
                    type="range"
                    aria-label="Progresso do áudio"
                    min={0}
                    max={duration || 100}
                    step={0.1}
                    value={currentTime}
                    onChange={(e) => {
                      const nextTime = Number(e.target.value);
                      if (audioRef.current) audioRef.current.currentTime = nextTime;
                      setCurrentTime(nextTime);
                    }}
                    className="w-full accent-orange-600 cursor-pointer h-1.5"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => seekBy(10)}
                  aria-label="Avançar 10 segundos"
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  <RotateCw className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={cycleRate}
                  aria-label="Alterar velocidade de reprodução"
                  className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-mono font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 tabular-nums shrink-0"
                >
                  {playbackRate}x
                </button>
              </div>
            </div>
          )}

          {/* Subtle Interactive Reading Hint */}
          <div className="mt-6 py-2.5 px-3.5 rounded-lg bg-slate-100/80 dark:bg-[#131926] border border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span>
              Clique em termos com{' '}
              <span className="underline decoration-dotted decoration-2 underline-offset-4 decoration-emerald-600 dark:decoration-emerald-400 font-medium text-slate-900 dark:text-white">
                sublinhado pontilhado
              </span>{' '}
              para notas do autor, ou selecione qualquer palavra/frase para traduzir com DeepL.
            </span>
          </div>

          {/* Interactive Reading Canvas */}
          <div
            ref={articleRef}
            onMouseUp={handleTextSelection}
            onTouchEnd={handleTextSelection}
            className={`mt-8 space-y-6 text-slate-900 dark:text-slate-100 ${
              FONT_SIZES[fontSizeIdx].className
            } ${useSerifBody ? 'font-display tracking-[0.005em]' : 'font-sans'}`}
          >
            {paragraphs.map((p) => {
              const isSynced = activeParagraphIndex === p.index;
              return (
                <p
                  key={p.index}
                  className={`rounded-lg transition-colors ${
                    isSynced
                      ? 'bg-orange-50/70 dark:bg-orange-950/25 px-3 py-2 -mx-3'
                      : ''
                  }`}
                >
                  {p.segments.map((seg, sIdx) => {
                    if (seg.annotation) {
                      return (
                        <button
                          key={`${p.index}-${sIdx}`}
                          type="button"
                          onClick={(e) => handleAnnotationClick(e, seg)}
                          className="inline font-inherit text-inherit underline decoration-dotted decoration-2 underline-offset-4 decoration-emerald-600 dark:decoration-emerald-400 hover:bg-emerald-500/15 dark:hover:bg-emerald-400/15 rounded-xs px-0.5 -mx-0.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                        >
                          {seg.text}
                        </button>
                      );
                    }

                    // Tokenize plain segments into clickable words/spaces while preserving smooth selection
                    const tokens = seg.text.split(/(\s+)/);
                    let runningOffset = seg.startIndex;
                    return (
                      <React.Fragment key={`${p.index}-${sIdx}`}>
                        {tokens.map((token, tIdx) => {
                          const tokenStart = runningOffset;
                          runningOffset += token.length;
                          if (!token || /^\s+$/.test(token)) {
                            return <React.Fragment key={tIdx}>{token}</React.Fragment>;
                          }
                          return (
                            <span
                              key={tIdx}
                              onClick={(e) => handleWordClick(e, token, tokenStart)}
                              className="hover:bg-orange-500/10 dark:hover:bg-orange-400/15 rounded-xs cursor-pointer transition-colors"
                            >
                              {token}
                            </span>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                </p>
              );
            })}
          </div>

          {/* Exam Callout Footer */}
          {exam && (
            <section className="mt-12 p-6 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-orange-700 dark:text-orange-400">
                  Exame de Compreensão
                </p>
                <h2 className="mt-1 font-display text-xl font-semibold text-slate-900 dark:text-slate-50">
                  {exam.title}
                </h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Teste seu entendimento do texto, veja explicações detalhadas e ganhe pontos de XP.
                </p>
              </div>
              <button
                type="button"
                onClick={() => onStartExam(exam.id, textItem.id)}
                className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2 min-h-[44px] whitespace-nowrap shrink-0"
              >
                <ClipboardCheck className="w-4 h-4" />
                <span>Iniciar exame</span>
              </button>
            </section>
          )}

          {isOwner && (
            <div className="mt-8 pt-6 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Você é o autor desta publicação.
              </span>
              <button
                type="button"
                onClick={handleDeleteOwnText}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400 hover:underline disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{deleting ? 'Excluindo...' : 'Excluir texto'}</span>
              </button>
            </div>
          )}
        </article>

        {/* Right Companion Column: Author Notes Glossary */}
        <aside className="lg:col-span-4 lg:sticky lg:top-32 space-y-6">
          <div className="p-5 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span>Notas do Autor</span>
              </h2>
              <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                {annotations.length}
              </span>
            </div>

            {annotations.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                Este texto não possui notas prévias do autor. Selecione qualquer palavra ou frase
                no texto para traduzir automaticamente via DeepL para{' '}
                <strong className="font-semibold text-slate-700 dark:text-slate-200">
                  {getLanguageLabel(profile?.native_language || 'PT-BR')}
                </strong>
                .
              </p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800/80 max-h-[60vh] overflow-y-auto pr-1">
                {annotations.map((ann) => (
                  <li key={ann.id} className="py-3 first:pt-1 last:pb-0">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">
                        {ann.term_or_phrase}
                      </span>
                      {ann.pronunciation && (
                        <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400 shrink-0">
                          {ann.pronunciation}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {ann.explanation}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>

      {/* Contextual Popover (Desktop) / Bottom Sheet (Mobile) */}
      {popover && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-label="Significado do trecho selecionado"
          style={
            typeof window !== 'undefined' && window.innerWidth >= 640
              ? desktopPopoverStyle
              : undefined
          }
          className="fixed z-50 inset-x-0 bottom-0 sm:inset-auto sm:bottom-auto bg-white dark:bg-[#131926] border-t sm:border border-slate-200 dark:border-slate-700 rounded-t-2xl sm:rounded-xl shadow-2xl p-5"
        >
          {/* Header Row */}
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              {popover.result ? (
                <div className="flex items-center gap-1.5 text-xs font-semibold mb-1">
                  {popover.result.source === 'author' ? (
                    <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
                      <BookMarked className="w-3.5 h-3.5" />
                      <span>Nota do Autor</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-sky-700 dark:text-sky-400">
                      <Languages className="w-3.5 h-3.5" />
                      <span>
                        Tradução DeepL · {profile?.native_language || 'PT-BR'}
                      </span>
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                  Consultando significado...
                </div>
              )}

              <h3 className="text-base font-semibold text-slate-950 dark:text-white break-words">
                {popover.result?.originalText || popover.selectedText}
              </h3>

              {popover.result?.pronunciation && (
                <p className="mt-0.5 text-xs font-mono text-emerald-700 dark:text-emerald-400">
                  {popover.result.pronunciation}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setPopover(null)}
              aria-label="Fechar janela de tradução"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Body */}
          <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            {popover.loading ? (
              <div className="py-4 flex items-center gap-2.5 text-sm text-slate-600 dark:text-slate-300">
                <Loader2 className="w-4 h-4 animate-spin text-orange-600 shrink-0" />
                <span>Traduzindo para {getLanguageLabel(profile?.native_language || 'PT-BR')}...</span>
              </div>
            ) : popover.error ? (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{popover.error}</span>
              </div>
            ) : popover.result ? (
              <>
                <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed">
                  {popover.result.translatedText}
                </p>

                {popover.result.contextSentence &&
                  popover.result.contextSentence !== popover.result.originalText && (
                    <p className="mt-2.5 text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2">
                      “{popover.result.contextSentence}”
                    </p>
                  )}

                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={handleSaveVocabulary}
                    disabled={popover.saved || popover.saving}
                    className={`w-full py-2.5 px-4 rounded-lg text-xs font-semibold transition-colors inline-flex items-center justify-center gap-2 min-h-[40px] ${
                      popover.saved
                        ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                        : 'bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-60'
                    }`}
                  >
                    {popover.saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : popover.saved ? (
                      <BookmarkCheck className="w-4 h-4" />
                    ) : (
                      <BookmarkPlus className="w-4 h-4" />
                    )}
                    <span>
                      {popover.saved
                        ? 'Salvo no Vocabulário'
                        : popover.saving
                        ? 'Salvando...'
                        : 'Salvar no Vocabulário'}
                    </span>
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
