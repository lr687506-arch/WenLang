import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import type { SavedVocabulary } from '../types/database';
import {
  BookMarked,
  Languages,
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Shuffle,
  Trash2,
  Loader2,
  ExternalLink,
  Search,
} from 'lucide-react';

interface SavedVocabularyPageProps {
  onOpenText: (textId: string) => void;
  onExplore: () => void;
}

export function SavedVocabularyPage({ onOpenText, onExplore }: SavedVocabularyPageProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<SavedVocabulary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'flashcards' | 'list'>('flashcards');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'author' | 'deepl'>('all');
  const [search, setSearch] = useState('');

  // Flashcard deck state
  const [cardIndex, setCardIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const fetchVocabulary = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    const { data, error: fetchErr } = await supabase
      .from('saved_vocabulary')
      .select(
        `
        *,
        text:texts(id, title, language)
      `
      )
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (fetchErr) {
      setError(fetchErr.message);
      setLoading(false);
      return;
    }

    const normalized = ((data || []) as unknown as SavedVocabulary[]).map((row) => ({
      ...row,
      text: Array.isArray(row.text) ? row.text[0] ?? null : row.text ?? null,
    }));

    setItems(normalized);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchVocabulary();
  }, [fetchVocabulary]);

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((item) => {
      if (sourceFilter !== 'all' && item.source !== sourceFilter) return false;
      if (q) {
        const hay = `${item.original_text} ${item.translated_text} ${
          item.context_sentence || ''
        }`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [items, sourceFilter, search]);

  useEffect(() => {
    if (cardIndex >= filteredItems.length) {
      setCardIndex(0);
      setFlipped(false);
    }
  }, [filteredItems.length, cardIndex]);

  const handleDelete = async (id: string) => {
    const { error: delErr } = await supabase.from('saved_vocabulary').delete().eq('id', id);
    if (!delErr) {
      setItems((prev) => prev.filter((item) => item.id !== id));
      setFlipped(false);
    }
  };

  const handleShuffle = () => {
    if (filteredItems.length < 2) return;
    setItems((prev) => {
      const copy = [...prev];
      for (let i = copy.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    });
    setCardIndex(0);
    setFlipped(false);
  };

  const currentCard = filteredItems[cardIndex];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-28 md:pb-16">
      <div className="pb-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
            Caderno de Vocabulário · {items.length} termo(s) salvo(s)
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-slate-950 dark:text-slate-50">
            Revisão em flashcards e lista
          </h1>
        </div>

        {/* Mode Segmented Switch */}
        <div
          role="tablist"
          className="inline-flex items-center gap-1 p-1 rounded-lg bg-slate-100 dark:bg-[#131926] border border-slate-200 dark:border-slate-800 self-start sm:self-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'flashcards'}
            onClick={() => setMode('flashcards')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              mode === 'flashcards'
                ? 'bg-white dark:bg-[#1E293B] text-slate-950 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Flashcards
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'list'}
            onClick={() => setMode('list')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
              mode === 'list'
                ? 'bg-white dark:bg-[#1E293B] text-slate-950 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
            }`}
          >
            Lista completa
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="py-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filtrar palavras ou traduções..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
          />
        </div>

        <div className="flex items-center gap-1.5">
          {(['all', 'author', 'deepl'] as const).map((src) => (
            <button
              key={src}
              type="button"
              onClick={() => {
                setSourceFilter(src);
                setCardIndex(0);
                setFlipped(false);
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap min-h-[36px] ${
                sourceFilter === src
                  ? 'bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950 font-semibold'
                  : 'bg-slate-100 dark:bg-[#131926] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              {src === 'all' ? 'Todas as fontes' : src === 'author' ? 'Nota do Autor' : 'DeepL'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
          <p className="text-sm">Carregando seu vocabulário...</p>
        </div>
      ) : error ? (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm">
          {error}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="my-6 p-10 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 text-center max-w-xl mx-auto">
          <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-50">
            {items.length === 0
              ? 'Nenhuma palavra salva ainda'
              : 'Nenhum termo encontrado neste filtro'}
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {items.length === 0
              ? 'Abra um texto na biblioteca, clique em uma anotação do autor ou selecione qualquer frase para traduzir e clique em "Salvar no Vocabulário".'
              : 'Limpe a busca ou altere o filtro de fonte para ver seus cartões.'}
          </p>
          {items.length === 0 && (
            <button
              type="button"
              onClick={onExplore}
              className="mt-6 px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors min-h-[44px]"
            >
              Explorar textos
            </button>
          )}
        </div>
      ) : mode === 'flashcards' && currentCard ? (
        <div className="max-w-2xl mx-auto mt-4">
          {/* Interactive Flashcard */}
          <button
            type="button"
            onClick={() => setFlipped((f) => !f)}
            className="w-full text-left min-h-[300px] p-8 sm:p-10 rounded-2xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 hover:border-orange-500/70 transition-colors flex flex-col justify-between focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
          >
            <div className="flex items-center justify-between gap-2 text-xs">
              <span
                className={`inline-flex items-center gap-1.5 font-semibold ${
                  currentCard.source === 'author'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-sky-700 dark:text-sky-400'
                }`}
              >
                {currentCard.source === 'author' ? (
                  <>
                    <BookMarked className="w-3.5 h-3.5" />
                    <span>Nota do Autor</span>
                  </>
                ) : (
                  <>
                    <Languages className="w-3.5 h-3.5" />
                    <span>Tradução DeepL</span>
                  </>
                )}
              </span>
              <span className="font-mono text-slate-400 tabular-nums">
                {cardIndex + 1} / {filteredItems.length}
              </span>
            </div>

            <div className="my-8 text-center">
              {!flipped ? (
                <>
                  <div className="font-display text-3xl sm:text-4xl font-semibold text-slate-950 dark:text-white break-words">
                    {currentCard.original_text}
                  </div>
                  <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    Clique no cartão para revelar o significado
                  </p>
                </>
              ) : (
                <>
                  <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                    {currentCard.original_text}
                  </div>
                  <div className="text-xl sm:text-2xl font-semibold text-slate-950 dark:text-slate-50 leading-relaxed">
                    {currentCard.translated_text}
                  </div>
                  {currentCard.context_sentence && (
                    <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 italic leading-relaxed">
                      “{currentCard.context_sentence}”
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="truncate">
                {currentCard.text?.title ? `Origem: ${currentCard.text.title}` : 'Vocabulário salvo'}
              </span>
              <span className="inline-flex items-center gap-1 font-medium text-orange-600 dark:text-orange-400 shrink-0">
                <RotateCw className="w-3.5 h-3.5" />
                <span>{flipped ? 'Ver frente' : 'Virar cartão'}</span>
              </span>
            </div>
          </button>

          {/* Deck Controls */}
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setCardIndex((i) => (i === 0 ? filteredItems.length - 1 : i - 1));
                  setFlipped(false);
                }}
                className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-700 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-700 min-h-[40px]"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Anterior</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setCardIndex((i) => (i + 1) % filteredItems.length);
                  setFlipped(false);
                }}
                className="inline-flex items-center gap-1 px-4 py-2 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 text-white min-h-[40px]"
              >
                <span>Próximo</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleShuffle}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white min-h-[40px]"
              >
                <Shuffle className="w-3.5 h-3.5" />
                <span>Embaralhar</span>
              </button>

              {currentCard.text_id && (
                <button
                  type="button"
                  onClick={() => onOpenText(currentCard.text_id!)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131926] text-slate-600 dark:text-slate-300 hover:text-orange-600 dark:hover:text-orange-400 min-h-[40px]"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir texto</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleDelete(currentCard.id)}
                aria-label="Remover termo salvo"
                className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors min-h-[40px]"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Full List Mode */
        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl divide-y divide-slate-100 dark:divide-slate-800">
          {filteredItems.map((item) => (
            <div key={item.id} className="p-5 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span
                    className={`font-semibold ${
                      item.source === 'author'
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-sky-700 dark:text-sky-400'
                    }`}
                  >
                    {item.source === 'author' ? 'Nota do Autor' : 'Tradução DeepL'}
                  </span>
                  {item.text?.title && (
                    <>
                      <span className="text-slate-400" aria-hidden="true">
                        ·
                      </span>
                      <button
                        type="button"
                        onClick={() => item.text_id && onOpenText(item.text_id)}
                        className="text-slate-500 dark:text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 truncate max-w-xs"
                      >
                        {item.text.title}
                      </button>
                    </>
                  )}
                </div>

                <div className="mt-1.5 flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3">
                  <h3 className="text-base font-semibold text-slate-950 dark:text-white">
                    {item.original_text}
                  </h3>
                  <span className="hidden sm:inline text-slate-300 dark:text-slate-700">—</span>
                  <p className="text-sm text-slate-700 dark:text-slate-200">
                    {item.translated_text}
                  </p>
                </div>

                {item.context_sentence && (
                  <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400 italic line-clamp-2">
                    “{item.context_sentence}”
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={() => handleDelete(item.id)}
                aria-label={`Remover ${item.original_text}`}
                className="p-2 text-slate-400 hover:text-red-600 transition-colors shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
