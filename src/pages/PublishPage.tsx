import React, { useState, useRef } from 'react';
import {
  supabase,
  uploadAudioFile,
  uploadCoverFile,
  isSafeMediaUrl,
} from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import {
  NATIVE_LANGUAGE_OPTIONS,
  CURATED_EDITORIAL_COVERS,
  normalizeLanguageCode,
} from '../constants/languages';
import {
  Upload,
  Plus,
  Trash2,
  BookMarked,
  ClipboardCheck,
  Headphones,
  Image as ImageIcon,
  Loader2,
  AlertCircle,
  Check,
  Sparkles,
} from 'lucide-react';

interface PublishPageProps {
  initialLanguage?: string;
  onPublished: (textId: string) => void;
  onCancel: () => void;
}

interface DraftAnnotation {
  id: string;
  term_or_phrase: string;
  start_index: number | null;
  end_index: number | null;
  explanation: string;
  pronunciation: string;
}

interface DraftQuestion {
  id: string;
  question_text: string;
  options: [string, string, string, string];
  correct_option_index: number;
  explanation: string;
}

export function PublishPage({ initialLanguage, onPublished, onCancel }: PublishPageProps) {
  const { user, profile } = useAuth();
  const contentRef = useRef<HTMLTextAreaElement | null>(null);

  // Core text fields aligned to canonical 2-letter codes ('ES', 'EN', 'ZH', 'JA', 'ID', 'PT', ...)
  const defaultLang = normalizeLanguageCode(
    initialLanguage || profile?.target_languages?.[0] || 'ES'
  );
  const [title, setTitle] = useState('');
  const [language, setLanguage] = useState(defaultLang);
  const [difficultyLevel, setDifficultyLevel] = useState('Iniciante');
  const [content, setContent] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  // Cover media
  const [coverUrl, setCoverUrl] = useState<string>(CURATED_EDITORIAL_COVERS[0].url);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  // Audio media
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  // Draft author annotations
  const [annotations, setAnnotations] = useState<DraftAnnotation[]>([]);
  const [termDraft, setTermDraft] = useState('');
  const [startIdxDraft, setStartIdxDraft] = useState<number | null>(null);
  const [endIdxDraft, setEndIdxDraft] = useState<number | null>(null);
  const [pronunciationDraft, setPronunciationDraft] = useState('');
  const [explanationDraft, setExplanationDraft] = useState('');

  // Draft comprehension exam
  const [includeExam, setIncludeExam] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [questions, setQuestions] = useState<DraftQuestion[]>([
    {
      id: crypto.randomUUID(),
      question_text: '',
      options: ['', '', '', ''],
      correct_option_index: 0,
      explanation: '',
    },
  ]);

  const [submitting, setSubmitting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentLangMeta = NATIVE_LANGUAGE_OPTIONS.find((l) => l.sourceCode === language);
  const levelPresets = currentLangMeta?.suggestedLevels || [
    'Iniciante',
    'Intermediário',
    'Avançado',
  ];

  const handleCaptureSelection = () => {
    const el = contentRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    if (start === end) {
      setError('Selecione primeiro uma palavra ou expressão dentro do campo de texto.');
      return;
    }
    const snippet = content.slice(start, end).trim();
    if (!snippet) return;
    // Adjust indices if leading/trailing spaces were included
    const leadTrim = content.slice(start, end).indexOf(snippet);
    const exactStart = start + leadTrim;
    const exactEnd = exactStart + snippet.length;
    setTermDraft(snippet);
    setStartIdxDraft(exactStart);
    setEndIdxDraft(exactEnd);
    setError(null);
  };

  const handleAddAnnotation = () => {
    const trimmedTerm = termDraft.trim();
    const trimmedExplanation = explanationDraft.trim();
    if (!trimmedTerm || !trimmedExplanation) {
      setError('Informe o termo/frase e a explicação do autor para adicionar a anotação.');
      return;
    }

    // If user typed manually, attempt to locate first occurrence index automatically
    let resolvedStart = startIdxDraft;
    let resolvedEnd = endIdxDraft;
    if (resolvedStart === null && content) {
      const idx = content.indexOf(trimmedTerm);
      if (idx !== -1) {
        resolvedStart = idx;
        resolvedEnd = idx + trimmedTerm.length;
      }
    }

    setAnnotations((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        term_or_phrase: trimmedTerm,
        start_index: resolvedStart,
        end_index: resolvedEnd,
        explanation: trimmedExplanation,
        pronunciation: pronunciationDraft.trim(),
      },
    ]);

    setTermDraft('');
    setStartIdxDraft(null);
    setEndIdxDraft(null);
    setPronunciationDraft('');
    setExplanationDraft('');
    setError(null);
  };

  const handleAudioChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioFile(file);
    setAudioPreviewUrl(URL.createObjectURL(file));
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setCoverUrl('');
  };

  const handleAddQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        question_text: '',
        options: ['', '', '', ''],
        correct_option_index: 0,
        explanation: '',
      },
    ]);
  };

  const updateQuestion = (id: string, updater: (q: DraftQuestion) => DraftQuestion) => {
    setQuestions((prev) => prev.map((q) => (q.id === id ? updater(q) : q)));
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!user) {
      setError('Você precisa estar autenticado para publicar.');
      return;
    }
    if (!title.trim() || !content.trim()) {
      setError('Preencha o título e o conteúdo do texto.');
      return;
    }

    // Validate exam questions if enabled
    const validQuestions = includeExam
      ? questions
          .map((q) => ({
            ...q,
            question_text: q.question_text.trim(),
            cleanedOptions: q.options.map((o) => o.trim()).filter(Boolean),
          }))
          .filter((q) => q.question_text.length > 0)
      : [];

    if (includeExam) {
      if (validQuestions.length === 0) {
        setError('Adicione pelo menos uma questão preenchida ou desative a seção de exame.');
        return;
      }
      for (const q of validQuestions) {
        if (q.cleanedOptions.length < 2) {
          setError('Cada questão do exame precisa de pelo menos 2 alternativas preenchidas.');
          return;
        }
        if (!q.options[q.correct_option_index]?.trim()) {
          setError('A alternativa marcada como correta precisa estar preenchida.');
          return;
        }
      }
    }

    setSubmitting(true);
    try {
      let finalAudioUrl: string | null = null;
      if (audioFile) {
        setStatusMessage('Enviando arquivo de áudio para o Supabase Storage...');
        finalAudioUrl = await uploadAudioFile(audioFile, user.id);
      }

      let finalCoverUrl: string | null = null;
      if (coverFile) {
        setStatusMessage('Enviando imagem de capa...');
        finalCoverUrl = await uploadCoverFile(coverFile, user.id);
      } else if (coverUrl.trim() && isSafeMediaUrl(coverUrl.trim())) {
        finalCoverUrl = coverUrl.trim();
      }

      setStatusMessage('Salvando texto no banco de dados...');
      const { data: createdText, error: textErr } = await supabase
        .from('texts')
        .insert({
          author_id: user.id,
          title: title.trim(),
          content: content.trim(),
          language: normalizeLanguageCode(language),
          difficulty_level: difficultyLevel.trim() || 'Iniciante',
          cover_image_url: finalCoverUrl,
          audio_url: finalAudioUrl,
          is_public: isPublic,
        })
        .select('id')
        .single();

      if (textErr || !createdText) {
        throw new Error(textErr?.message || 'Falha ao salvar texto.');
      }

      const newTextId = createdText.id as string;

      if (annotations.length > 0) {
        setStatusMessage('Gravando notas prévias do autor...');
        const { error: annErr } = await supabase.from('author_annotations').insert(
          annotations.map((a) => ({
            text_id: newTextId,
            term_or_phrase: a.term_or_phrase,
            start_index: a.start_index,
            end_index: a.end_index,
            explanation: a.explanation,
            pronunciation: a.pronunciation || null,
          }))
        );
        if (annErr) throw new Error(`Texto salvo, mas houve erro nas anotações: ${annErr.message}`);
      }

      if (includeExam && validQuestions.length > 0) {
        setStatusMessage('Criando exame de compreensão...');
        const { data: createdExam, error: examErr } = await supabase
          .from('exams')
          .insert({
            text_id: newTextId,
            title: examTitle.trim() || `Exame: ${title.trim()}`,
          })
          .select('id')
          .single();

        if (examErr || !createdExam) {
          throw new Error(`Texto salvo, mas houve erro ao criar exame: ${examErr?.message}`);
        }

        const questionsPayload = validQuestions.map((q) => {
          // Remap correct_option_index after filtering empty options
          const correctText = q.options[q.correct_option_index].trim();
          const newIndex = Math.max(0, q.cleanedOptions.indexOf(correctText));
          return {
            exam_id: createdExam.id,
            question_text: q.question_text,
            options: q.cleanedOptions,
            correct_option_index: newIndex,
            explanation: q.explanation.trim() || null,
          };
        });

        const { error: qErr } = await supabase.from('exam_questions').insert(questionsPayload);
        if (qErr) {
          throw new Error(`Exame criado, mas houve erro ao salvar questões: ${qErr.message}`);
        }
      }

      onPublished(newTextId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro inesperado ao publicar.');
    } finally {
      setSubmitting(false);
      setStatusMessage(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 pb-28 md:pb-16">
      <div className="pb-6 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Estúdio de Autoria · Sincronizado com Web e Android
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-slate-950 dark:text-slate-50">
            Publicar novo texto de leitura
          </h1>
        </div>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
        >
          Cancelar
        </button>
      </div>

      <form onSubmit={handlePublish} className="mt-8 space-y-10">
        {/* SECTION 1: TEXT METADATA & CONTENT */}
        <section className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50">
            01. Texto, idioma e mídia
          </h2>

          <div>
            <label
              htmlFor="pub-title"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Título do texto *
            </label>
            <input
              id="pub-title"
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Uma manhã de outono em Quioto"
              className="w-full px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-base font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="pub-language"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Idioma do texto *
              </label>
              <select
                id="pub-language"
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
              >
                {NATIVE_LANGUAGE_OPTIONS.map((lang) => (
                  <option key={lang.sourceCode} value={lang.sourceCode}>
                    {lang.label} ({lang.sourceCode})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="pub-level"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Nível de dificuldade *
              </label>
              <input
                id="pub-level"
                type="text"
                list="level-presets"
                value={difficultyLevel}
                onChange={(e) => setDifficultyLevel(e.target.value)}
                placeholder="Ex: N4, HSK 3, Iniciante"
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
              />
              <datalist id="level-presets">
                {levelPresets.map((lvl) => (
                  <option key={lvl} value={lvl} />
                ))}
              </datalist>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Visibilidade
              </span>
              <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-[#0B0F17] rounded-lg border border-slate-200 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsPublic(true)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    isPublic
                      ? 'bg-white dark:bg-[#1E293B] text-slate-950 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Público
                </button>
                <button
                  type="button"
                  onClick={() => setIsPublic(false)}
                  className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    !isPublic
                      ? 'bg-white dark:bg-[#1E293B] text-slate-950 dark:text-white shadow-xs'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Privado
                </button>
              </div>
            </div>
          </div>

          {/* Text Content */}
          <div>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
              <label
                htmlFor="pub-content"
                className="text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                Conteúdo completo para leitura *
              </label>
              <button
                type="button"
                onClick={handleCaptureSelection}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Capturar trecho selecionado para Nota do Autor</span>
              </button>
            </div>
            <textarea
              ref={contentRef}
              id="pub-content"
              required
              rows={9}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Cole ou escreva o texto completo aqui. Separe os parágrafos com uma linha em branco..."
              className="w-full p-4 rounded-xl bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm sm:text-base text-slate-900 dark:text-slate-100 leading-relaxed focus:outline-none focus:border-orange-600"
            />
          </div>

          {/* Audio Upload -> Supabase Storage wenlang-audios */}
          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <Headphones className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>Áudio da narração (bucket wenlang-audios)</span>
              </label>
              <label className="flex flex-col items-center justify-center p-5 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50/60 dark:bg-[#0B0F17] hover:border-orange-500 cursor-pointer transition-colors text-center">
                <Upload className="w-5 h-5 text-slate-400 mb-1.5" />
                <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                  {audioFile ? audioFile.name : 'Escolher arquivo .mp3, .wav, .ogg ou .m4a'}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Máximo 25 MB
                </span>
                <input
                  type="file"
                  accept=".mp3,.wav,.ogg,.m4a,audio/*"
                  onChange={handleAudioChange}
                  className="hidden"
                />
              </label>

              {audioPreviewUrl && (
                <div className="mt-3 flex items-center gap-2">
                  <audio controls src={audioPreviewUrl} className="w-full h-9" />
                  <button
                    type="button"
                    onClick={() => {
                      URL.revokeObjectURL(audioPreviewUrl);
                      setAudioFile(null);
                      setAudioPreviewUrl(null);
                    }}
                    aria-label="Remover áudio selecionado"
                    className="p-2 text-slate-400 hover:text-red-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Cover Image Selection or Upload */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                <span>Capa editorial (opcional)</span>
              </label>

              <div className="grid grid-cols-3 gap-2 mb-3">
                {CURATED_EDITORIAL_COVERS.map((preset) => {
                  const selected = !coverFile && coverUrl === preset.url;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setCoverFile(null);
                        if (coverPreview) URL.revokeObjectURL(coverPreview);
                        setCoverPreview(null);
                        setCoverUrl(preset.url);
                      }}
                      className={`relative aspect-[16/10] rounded-lg overflow-hidden border-2 transition-colors ${
                        selected
                          ? 'border-orange-600'
                          : 'border-transparent hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <img
                        src={preset.url}
                        alt={preset.label}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                      {selected && (
                        <span className="absolute top-1 right-1 w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center">
                          <Check className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <label className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors">
                <Upload className="w-3.5 h-3.5" />
                <span>{coverFile ? `Capa: ${coverFile.name}` : 'Enviar imagem personalizada'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/avif"
                  onChange={handleCoverFileChange}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </section>

        {/* SECTION 2: AUTHOR ANNOTATIONS */}
        <section className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                <BookMarked className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>02. Notas prévias do autor</span>
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Palavras ou expressões cadastradas aqui são destacadas no texto e exibidas com
                prioridade local sem consumir a API do DeepL.
              </p>
            </div>
            <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {annotations.length} anotação(ões)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="ann-term"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Palavra ou expressão exata no texto
              </label>
              <input
                id="ann-term"
                type="text"
                value={termDraft}
                onChange={(e) => {
                  setTermDraft(e.target.value);
                  setStartIdxDraft(null);
                  setEndIdxDraft(null);
                }}
                placeholder="Ex: 稲荷神社 ou 没关系"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="ann-pron"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
              >
                Pronúncia (Pinyin, Furigana ou IPA — opcional)
              </label>
              <input
                id="ann-pron"
                type="text"
                value={pronunciationDraft}
                onChange={(e) => setPronunciationDraft(e.target.value)}
                placeholder="Ex: いなりじんじゃ / méi guānxi"
                className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm font-mono text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="ann-exp"
              className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
            >
              Explicação gramatical, cultural ou significado
            </label>
            <textarea
              id="ann-exp"
              rows={2}
              value={explanationDraft}
              onChange={(e) => setExplanationDraft(e.target.value)}
              placeholder="Escreva a nota que o leitor verá ao clicar neste termo..."
              className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleAddAnnotation}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 rounded-lg transition-colors min-h-[38px]"
            >
              <Plus className="w-4 h-4" />
              <span>Adicionar nota</span>
            </button>
          </div>

          {annotations.length > 0 && (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800 border-t border-slate-100 dark:border-slate-800 pt-2">
              {annotations.map((ann) => (
                <li key={ann.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">
                        {ann.term_or_phrase}
                      </span>
                      {ann.pronunciation && (
                        <span className="text-xs font-mono text-emerald-700 dark:text-emerald-400">
                          {ann.pronunciation}
                        </span>
                      )}
                      {ann.start_index !== null && (
                        <span className="text-[11px] font-mono text-slate-400 tabular-nums">
                          [{ann.start_index}:{ann.end_index}]
                        </span>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600 dark:text-slate-300">
                      {ann.explanation}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAnnotations((prev) => prev.filter((item) => item.id !== ann.id))
                    }
                    aria-label={`Remover anotação ${ann.term_or_phrase}`}
                    className="p-1.5 text-slate-400 hover:text-red-600 transition-colors shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* SECTION 3: COMPREHENSION EXAM BUILDER */}
        <section className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50 flex items-center gap-2">
                <ClipboardCheck className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                <span>03. Exame de compreensão (opcional)</span>
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Crie perguntas de múltipla escolha para o leitor praticar e somar pontos de XP.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIncludeExam((v) => !v)}
              className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-colors min-h-[38px] whitespace-nowrap ${
                includeExam
                  ? 'bg-orange-600 border-orange-600 text-white'
                  : 'border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
              }`}
            >
              {includeExam ? 'Exame ativado' : 'Adicionar exame'}
            </button>
          </div>

          {includeExam && (
            <div className="space-y-6 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div>
                <label
                  htmlFor="exam-title"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1"
                >
                  Título do exame
                </label>
                <input
                  id="exam-title"
                  type="text"
                  value={examTitle}
                  onChange={(e) => setExamTitle(e.target.value)}
                  placeholder="Ex: Compreensão de leitura e vocabulário"
                  className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
                />
              </div>

              <div className="space-y-6">
                {questions.map((q, qIndex) => (
                  <div
                    key={q.id}
                    className="pt-5 border-t border-slate-100 dark:border-slate-800 first:border-t-0 first:pt-0 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                        Questão {qIndex + 1}
                      </span>
                      {questions.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setQuestions((prev) => prev.filter((item) => item.id !== q.id))
                          }
                          className="text-xs text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Remover</span>
                        </button>
                      )}
                    </div>

                    <input
                      type="text"
                      value={q.question_text}
                      onChange={(e) =>
                        updateQuestion(q.id, (prev) => ({
                          ...prev,
                          question_text: e.target.value,
                        }))
                      }
                      placeholder="Enunciado da pergunta..."
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
                    />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {q.options.map((opt, optIdx) => {
                        const isCorrect = q.correct_option_index === optIdx;
                        return (
                          <div key={optIdx} className="flex items-center gap-2">
                            <input
                              type="radio"
                              name={`correct-${q.id}`}
                              checked={isCorrect}
                              onChange={() =>
                                updateQuestion(q.id, (prev) => ({
                                  ...prev,
                                  correct_option_index: optIdx,
                                }))
                              }
                              aria-label={`Marcar alternativa ${optIdx + 1} como correta`}
                              className="accent-emerald-600 w-4 h-4 shrink-0"
                            />
                            <input
                              type="text"
                              value={opt}
                              onChange={(e) =>
                                updateQuestion(q.id, (prev) => {
                                  const nextOpts = [...prev.options] as [
                                    string,
                                    string,
                                    string,
                                    string
                                  ];
                                  nextOpts[optIdx] = e.target.value;
                                  return { ...prev, options: nextOpts };
                                })
                              }
                              placeholder={`Alternativa ${String.fromCharCode(65 + optIdx)}${
                                isCorrect ? ' (Correta)' : ''
                              }`}
                              className={`flex-1 px-3 py-2 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border text-xs text-slate-900 dark:text-slate-100 focus:outline-none ${
                                isCorrect
                                  ? 'border-emerald-500/70 dark:border-emerald-600/70'
                                  : 'border-slate-200 dark:border-slate-700 focus:border-orange-600'
                              }`}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) =>
                        updateQuestion(q.id, (prev) => ({
                          ...prev,
                          explanation: e.target.value,
                        }))
                      }
                      placeholder="Justificativa da resposta correta (opcional)"
                      className="w-full px-3.5 py-2 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:border-orange-600"
                    />
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleAddQuestion}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              >
                <Plus className="w-4 h-4" />
                <span>Adicionar outra questão</span>
              </button>
            </div>
          )}
        </section>

        {error && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-start gap-2.5"
          >
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {statusMessage || 'Todos os dados são gravados diretamente no Supabase.'}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors min-h-[44px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-2.5 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors inline-flex items-center gap-2 min-h-[44px] disabled:opacity-60"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>{submitting ? 'Publicando...' : 'Publicar texto'}</span>
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
