import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase, isSafeMediaUrl, isSchemaMissingError } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { TextItem, AuthorSummary, ReadingStatus } from '../types/database';
import {
  NATIVE_LANGUAGE_OPTIONS,
  COMMON_DIFFICULTY_LEVELS,
  getLanguageLabel,
  getLanguageNativeName,
  normalizeLanguageCode,
  normalizeTargetLanguages,
} from '../constants/languages';
import { SchemaSetupBanner } from '../components/SchemaSetupBanner';
import type { ThemeMode } from '../hooks/useTheme';
import {
  Search,
  Headphones,
  ClipboardCheck,
  BookOpen,
  PenLine,
  Sun,
  Moon,
  Loader2,
  AlertCircle,
  SlidersHorizontal,
  Settings2,
  CheckCircle2,
} from 'lucide-react';

interface FeedPageProps {
  onOpenText: (textId: string) => void;
  onNavigatePublish: (languageCode?: string) => void;
  onManageLanguages: () => void;
  theme: ThemeMode;
  onToggleTheme: () => void;
}

function formatShortDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '';
  }
}

function estimateReadingMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  const cjkChars = (content.match(/[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]/g) || []).length;
  const effectiveUnits = Math.max(words, Math.round(cjkChars / 2));
  return Math.max(1, Math.ceil(effectiveUnits / 160));
}

export function FeedPage({
  onOpenText,
  onNavigatePublish,
  onManageLanguages,
  theme,
  onToggleTheme,
}: FeedPageProps) {
  const { user, profile, signOut } = useAuth();

  // Canonical study languages from the user's profile (strictly isolated to what they study)
  const studyLanguages = useMemo(
    () => normalizeTargetLanguages(profile?.target_languages),
    [profile?.target_languages]
  );

  // Active study language defaults automatically to the first configured language
  const [activeLang, setActiveLang] = useState<string>(() => studyLanguages[0] || '');

  // Keep activeLang synced whenever profile.target_languages updates
  useEffect(() => {
    if (studyLanguages.length === 0) {
      setActiveLang('');
    } else if (!activeLang || !studyLanguages.includes(activeLang)) {
      setActiveLang(studyLanguages[0]);
    }
  }, [studyLanguages, activeLang]);

  const [texts, setTexts] = useState<TextItem[]>([]);
  const [authorMap, setAuthorMap] = useState<Record<string, AuthorSummary>>({});
  const [progressMap, setProgressMap] = useState<Record<string, ReadingStatus>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);

  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [onlyAudio, setOnlyAudio] = useState(false);
  const [onlyExam, setOnlyExam] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchTexts = useCallback(async () => {
    if (!activeLang) {
      setTexts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setSchemaMissing(false);

    // Query global shared `texts` table filtered strictly by the active study language
    const canonicalLang = normalizeLanguageCode(activeLang);
    const { data, error: fetchErr } = await supabase
      .from('texts')
      .select(
        `
        id,
        author_id,
        title,
        content,
        language,
        difficulty_level,
        cover_image_url,
        audio_url,
        audio_timestamps,
        is_public,
        created_at,
        exams(id, title),
        author_annotations(id)
      `
      )
      .eq('language', canonicalLang)
      .order('created_at', { ascending: false });

    if (fetchErr) {
      if (isSchemaMissingError(fetchErr)) {
        setSchemaMissing(true);
      } else {
        setError(fetchErr.message);
      }
      setLoading(false);
      return;
    }

    const normalized = ((data || []) as unknown as TextItem[]).map((item) => ({
      ...item,
      language: normalizeLanguageCode(item.language),
      exams: Array.isArray(item.exams) ? item.exams : [],
      author_annotations: Array.isArray(item.author_annotations) ? item.author_annotations : [],
    }));

    setTexts(normalized);

    // Fetch public author display names safely + user's personal reading progress in parallel
    const uniqueAuthorIds = Array.from(new Set(normalized.map((t) => t.author_id).filter(Boolean)));
    const textIds = normalized.map((t) => t.id);

    const [authorsRes, progressRes] = await Promise.all([
      uniqueAuthorIds.length > 0
        ? supabase.rpc('get_author_summaries', { p_author_ids: uniqueAuthorIds })
        : Promise.resolve({ data: null, error: null }),
      user && textIds.length > 0
        ? supabase
            .from('user_reading_progress')
            .select('text_id, status')
            .eq('user_id', user.id)
            .in('text_id', textIds)
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (!authorsRes.error && Array.isArray(authorsRes.data)) {
      const nextMap: Record<string, AuthorSummary> = {};
      for (const row of authorsRes.data as AuthorSummary[]) {
        nextMap[row.id] = row;
      }
      setAuthorMap(nextMap);
    }

    if (!progressRes.error && Array.isArray(progressRes.data)) {
      const nextProgress: Record<string, ReadingStatus> = {};
      for (const row of progressRes.data as Array<{ text_id: string; status: ReadingStatus }>) {
        nextProgress[row.text_id] = row.status;
      }
      setProgressMap(nextProgress);
    }

    setLoading(false);
  }, [activeLang, user]);

  useEffect(() => {
    fetchTexts();
  }, [fetchTexts]);

  // Reset secondary difficulty filter when switching study language
  useEffect(() => {
    setSelectedLevel('ALL');
  }, [activeLang]);

  const activeLangMeta = useMemo(
    () => NATIVE_LANGUAGE_OPTIONS.find((l) => l.sourceCode === activeLang),
    [activeLang]
  );

  // Available difficulty levels aligned to the active study language + DB items
  const levelOptions = useMemo(() => {
    const set = new Set<string>(
      activeLangMeta?.suggestedLevels || ['Iniciante', 'Intermediário', 'Avançado']
    );
    texts.forEach((t) => {
      if (t.difficulty_level) set.add(t.difficulty_level);
    });
    if (set.size === 0) {
      COMMON_DIFFICULTY_LEVELS.slice(0, 6).forEach((l) => set.add(l));
    }
    return Array.from(set);
  }, [texts, activeLangMeta]);

  const filteredTexts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return texts.filter((item) => {
      if (
        selectedLevel !== 'ALL' &&
        item.difficulty_level.toLowerCase() !== selectedLevel.toLowerCase()
      ) {
        return false;
      }
      if (onlyAudio && !item.audio_url) {
        return false;
      }
      if (onlyExam && (!item.exams || item.exams.length === 0)) {
        return false;
      }
      if (q) {
        const author = authorMap[item.author_id];
        const hay = `${item.title} ${item.content} ${author?.username || ''} ${
          author?.full_name || ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [texts, selectedLevel, onlyAudio, onlyExam, searchQuery, authorMap]);

  if (schemaMissing) {
    return (
      <div className="px-4 py-8">
        <SchemaSetupBanner
          reason="tables_missing"
          onRetry={fetchTexts}
          onSignOut={() => signOut()}
        />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 pb-24 md:pb-14">
      {/* Editorial Header Row */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 pb-8 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-2xl">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Biblioteca de {activeLang ? getLanguageLabel(activeLang) : 'Leitura'} · Tradução para{' '}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {getLanguageLabel(profile?.native_language || 'PT-BR')}
            </span>{' '}
            <span className="font-mono text-[11px]">({profile?.native_language || 'PT-BR'})</span>
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            {activeLang
              ? `Textos em ${getLanguageLabel(activeLang).split(' ')[0]} para sua prática`
              : 'Escolha um idioma de estudo para começar'}
          </h1>
          <p className="mt-2.5 text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
            Conteúdo compartilhado pela comunidade com áudio, notas prévias do autor e tradução
            instantânea via DeepL no seu idioma nativo.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="text-right pr-3 border-r border-slate-200 dark:border-slate-800">
            <div className="text-xs text-slate-500 dark:text-slate-400">Seus pontos</div>
            <div className="font-mono text-lg font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
              {profile?.xp_points ?? 0} XP
            </div>
          </div>

          <button
            type="button"
            onClick={onToggleTheme}
            aria-label="Alternar modo claro e escuro"
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-lg hover:border-slate-300 dark:hover:border-slate-700 transition-colors min-h-[40px] whitespace-nowrap"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === 'dark' ? 'Claro' : 'Escuro'}</span>
          </button>
        </div>
      </section>

      {/* Study Language Quick Switcher (strictly user's target_languages + Manage button) */}
      <section className="pt-6 pb-2 flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Seus idiomas de estudo"
          className="flex items-center gap-1.5 overflow-x-auto pb-1"
        >
          {studyLanguages.map((code) => {
            const active = activeLang === code;
            const meta = NATIVE_LANGUAGE_OPTIONS.find((l) => l.sourceCode === code);
            return (
              <button
                key={code}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveLang(code)}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[40px] ${
                  active
                    ? 'bg-orange-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-[#131926] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                {meta ? `${meta.label.split(' ')[0]} · ${meta.nativeName}` : code}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onManageLanguages}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] rounded-lg transition-colors min-h-[40px] whitespace-nowrap shrink-0"
        >
          <Settings2 className="w-3.5 h-3.5" />
          <span>Gerenciar idiomas</span>
        </button>
      </section>

      {/* Secondary Search & Filter Toolbar */}
      {studyLanguages.length > 0 && (
        <section className="py-4 space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={`Buscar em ${getLanguageLabel(activeLang).split(' ')[0]}...`}
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-orange-600"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-slate-400 shrink-0" />
                <label htmlFor="feed-level-select" className="sr-only">
                  Filtrar por nível
                </label>
                <select
                  id="feed-level-select"
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="px-3 py-2 text-xs font-medium rounded-lg bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:border-orange-600 min-h-[40px]"
                >
                  <option value="ALL">Todos os níveis</option>
                  {levelOptions.map((lvl) => (
                    <option key={lvl} value={lvl}>
                      {lvl}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={() => setOnlyAudio((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors min-h-[40px] whitespace-nowrap ${
                  onlyAudio
                    ? 'bg-orange-600 border-orange-600 text-white'
                    : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <Headphones className="w-3.5 h-3.5" />
                <span>Com áudio</span>
              </button>

              <button
                type="button"
                onClick={() => setOnlyExam((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border transition-colors min-h-[40px] whitespace-nowrap ${
                  onlyExam
                    ? 'bg-orange-600 border-orange-600 text-white'
                    : 'bg-white dark:bg-[#131926] border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Com exame</span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Main Content Area */}
      {studyLanguages.length === 0 ? (
        <div className="my-8 p-8 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 max-w-xl">
          <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-50">
            Nenhum idioma de estudo selecionado
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            Adicione um ou mais idiomas no seu perfil para filtrar automaticamente os textos da
            biblioteca global do WenLang.
          </p>
          <button
            type="button"
            onClick={onManageLanguages}
            className="mt-5 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors min-h-[44px]"
          >
            Gerenciar idiomas no perfil
          </button>
        </div>
      ) : loading ? (
        <div className="py-20 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
          <p className="text-sm">
            Carregando textos em {getLanguageLabel(activeLang).split(' ')[0]}...
          </p>
        </div>
      ) : error ? (
        <div className="p-5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold">Erro ao carregar textos</p>
            <p className="text-sm mt-1">{error}</p>
            <button
              type="button"
              onClick={fetchTexts}
              className="mt-3 text-xs font-semibold underline underline-offset-2"
            >
              Tentar novamente
            </button>
          </div>
        </div>
      ) : filteredTexts.length === 0 ? (
        <div className="my-6 bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden grid grid-cols-1 md:grid-cols-12 items-stretch">
          <div className="md:col-span-5 relative min-h-[200px] bg-slate-200 dark:bg-slate-800">
            <img
              src="/src/assets/images/cover_editorial_books_1795550586355.jpg"
              alt="Livros multilíngues e fones de ouvido"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover"
            />
          </div>
          <div className="md:col-span-7 p-8 flex flex-col justify-center">
            <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-50">
              {texts.length === 0
                ? `Ainda não há textos em ${getLanguageLabel(activeLang).split(' ')[0]}`
                : 'Nenhum texto corresponde a estes filtros'}
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              {texts.length === 0
                ? `Seja o primeiro a publicar um texto em ${getLanguageLabel(activeLang)} com áudio, notas do autor e exame de compreensão para toda a comunidade.`
                : 'Tente limpar os filtros de nível, áudio, exame ou pesquisa para visualizar os textos disponíveis neste idioma.'}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              {texts.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedLevel('ALL');
                    setOnlyAudio(false);
                    setOnlyExam(false);
                    setSearchQuery('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[40px]"
                >
                  Limpar filtros
                </button>
              )}
              <button
                type="button"
                onClick={() => onNavigatePublish(activeLang)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors min-h-[40px]"
              >
                <PenLine className="w-4 h-4" />
                <span>Publicar em {getLanguageLabel(activeLang).split(' ')[0]}</span>
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTexts.map((item) => {
            const hasAudio = Boolean(item.audio_url);
            const hasExam = Boolean(item.exams && item.exams.length > 0);
            const notesCount = item.author_annotations?.length || 0;
            const readMins = estimateReadingMinutes(item.content);
            const authorSummary = authorMap[item.author_id];
            const authorLabel =
              authorSummary?.full_name ||
              authorSummary?.username ||
              (user && item.author_id === user.id
                ? profile?.full_name || profile?.username
                : null) ||
              'Autor da comunidade';
            const readingStatus = progressMap[item.id];
            const coverValid = isSafeMediaUrl(item.cover_image_url);

            return (
              <article
                key={item.id}
                onClick={() => onOpenText(item.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onOpenText(item.id);
                  }
                }}
                className="group cursor-pointer bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 hover:border-orange-500/70 dark:hover:border-orange-500/60 rounded-2xl overflow-hidden transition-colors flex flex-col focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
              >
                {/* Cover Media with Mandatory Fallback */}
                <div className="relative aspect-[16/9] w-full bg-slate-100 dark:bg-[#1A2233] overflow-hidden">
                  {coverValid && item.cover_image_url ? (
                    <img
                      src={item.cover_image_url}
                      alt={item.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="w-full h-full p-6 flex flex-col justify-between bg-gradient-to-br from-slate-100 via-slate-50 to-orange-50/40 dark:from-[#161E2E] dark:via-[#131926] dark:to-slate-900">
                      <span className="font-mono text-xs text-slate-500 dark:text-slate-400">
                        {item.language} · {item.difficulty_level}
                      </span>
                      <span className="font-display text-2xl font-medium text-slate-400/70 dark:text-slate-600 truncate">
                        {getLanguageNativeName(item.language)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Editorial Body — Zero-Pill Metadata Discipline */}
                <div className="p-5 flex-1 flex flex-col">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-orange-700 dark:text-orange-400">
                      {getLanguageLabel(item.language).split(' ')[0]}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{item.difficulty_level}</span>
                    <span aria-hidden="true">·</span>
                    <span className="tabular-nums">{readMins} min</span>
                    {readingStatus === 'completed' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Concluído</span>
                        </span>
                      </>
                    )}
                    {readingStatus === 'reading' && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-medium text-sky-700 dark:text-sky-400">Lendo</span>
                      </>
                    )}
                    {!item.is_public && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>Privado</span>
                      </>
                    )}
                  </div>

                  <h2 className="mt-2 font-display text-xl font-semibold text-slate-950 dark:text-slate-50 group-hover:text-orange-600 dark:group-hover:text-orange-400 transition-colors line-clamp-2 leading-snug">
                    {item.title}
                  </h2>

                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 line-clamp-3 leading-relaxed flex-1">
                    {item.content}
                  </p>

                  <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
                    <span className="truncate">
                      {authorLabel} · {formatShortDate(item.created_at)}
                    </span>

                    <div className="flex items-center gap-3 shrink-0 font-medium text-slate-600 dark:text-slate-300">
                      {notesCount > 0 && (
                        <span
                          title={`${notesCount} notas do autor`}
                          className="inline-flex items-center gap-1 tabular-nums text-emerald-700 dark:text-emerald-400"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>{notesCount}</span>
                        </span>
                      )}
                      {hasAudio && (
                        <span
                          title="Áudio disponível"
                          className="inline-flex items-center gap-1 text-slate-700 dark:text-slate-200"
                        >
                          <Headphones className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Áudio</span>
                        </span>
                      )}
                      {hasExam && (
                        <span
                          title="Exame de compreensão disponível"
                          className="inline-flex items-center gap-1 text-orange-700 dark:text-orange-400"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span className="hidden sm:inline">Exame</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
