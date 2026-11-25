import type { AuthorAnnotation } from '../types/database';
import { supabase, isSchemaMissingError } from './supabaseClient';
import { normalizeLanguageCode, normalizeToDeepLTarget } from '../constants/languages';

export interface LookupResult {
  source: 'author' | 'deepl';
  originalText: string;
  translatedText: string;
  difficultyLevel?: string | null;
  pronunciation?: string | null;
  contextSentence?: string;
  detectedSourceLanguage?: string | null;
  annotationId?: string;
  cached?: boolean;
}

interface CachedTranslationEntry {
  translatedText: string;
  detectedSourceLanguage?: string | null;
  lastUsedAt: number;
}

const LOCAL_CACHE_STORAGE_KEY = 'wenlang_deepl_cache_v2';
const MAX_LOCAL_CACHE_ENTRIES = 1000;
const MAX_REMOTE_CACHE_TEXT_LEN = 500;

const memoryCache = new Map<string, CachedTranslationEntry>();
const inFlightRequests = new Map<string, Promise<CachedTranslationEntry>>();
let localCacheHydrated = false;
let remoteCacheAvailable = true;

function hydrateLocalCacheOnce(): void {
  if (localCacheHydrated) return;
  localCacheHydrated = true;
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    const raw = window.localStorage.getItem(LOCAL_CACHE_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, CachedTranslationEntry>;
    if (!parsed || typeof parsed !== 'object') return;
    for (const [key, entry] of Object.entries(parsed)) {
      if (
        entry &&
        typeof entry.translatedText === 'string' &&
        entry.translatedText.trim().length > 0
      ) {
        memoryCache.set(key, {
          translatedText: entry.translatedText,
          detectedSourceLanguage: entry.detectedSourceLanguage ?? null,
          lastUsedAt: typeof entry.lastUsedAt === 'number' ? entry.lastUsedAt : Date.now(),
        });
      }
    }
  } catch {
    // Ignore corrupted storage or private browsing quota errors
  }
}

function persistLocalCache(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;

  try {
    // Enforce LRU cap by most recently used timestamp
    if (memoryCache.size > MAX_LOCAL_CACHE_ENTRIES) {
      const sorted = Array.from(memoryCache.entries()).sort(
        (a, b) => a[1].lastUsedAt - b[1].lastUsedAt
      );
      const excess = memoryCache.size - MAX_LOCAL_CACHE_ENTRIES;
      for (let i = 0; i < excess; i += 1) {
        memoryCache.delete(sorted[i][0]);
      }
    }

    const serialized: Record<string, CachedTranslationEntry> = {};
    for (const [key, value] of memoryCache.entries()) {
      serialized[key] = value;
    }
    window.localStorage.setItem(LOCAL_CACHE_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // Ignore quota exceeded / privacy mode errors
  }
}

function getLocalCachedTranslation(cacheKey: string): CachedTranslationEntry | null {
  hydrateLocalCacheOnce();
  const hit = memoryCache.get(cacheKey);
  if (!hit) return null;
  hit.lastUsedAt = Date.now();
  memoryCache.set(cacheKey, hit);
  return hit;
}

function setLocalCachedTranslation(
  cacheKey: string,
  translatedText: string,
  detectedSourceLanguage?: string | null
): CachedTranslationEntry {
  hydrateLocalCacheOnce();
  const entry: CachedTranslationEntry = {
    translatedText,
    detectedSourceLanguage: detectedSourceLanguage ?? null,
    lastUsedAt: Date.now(),
  };
  memoryCache.set(cacheKey, entry);
  persistLocalCache();
  return entry;
}

/**
 * Strips leading/trailing punctuation across Latin and CJK scripts
 * so matching selected phrases against author_annotations and translation cache is resilient.
 */
export function normalizeLookupTerm(term: string): string {
  return term
    .trim()
    .replace(
      /^[\s"'“”‘’「」『』【】《》〈〉()[\]{},.;:!?。、！？：；·—–-]+|[\s"'“”‘’「」『』【】《》〈〉()[\]{},.;:!?。、！？：；·—–-]+$/g,
      ''
    )
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function buildTranslationCacheKey(
  sourceLang: string,
  targetLang: string,
  normalizedText: string,
  contextKey: string
): string {
  return `${sourceLang}::${targetLang}::${normalizedText}::${contextKey}`;
}

async function lookupRemoteTranslationCache(
  sourceLang: string,
  targetLang: string,
  normalizedText: string,
  contextKey: string
): Promise<CachedTranslationEntry | null> {
  if (!remoteCacheAvailable || !normalizedText || normalizedText.length > MAX_REMOTE_CACHE_TEXT_LEN) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('translation_cache')
      .select('translated_text, detected_source_language')
      .eq('source_language', sourceLang)
      .eq('target_language', targetLang)
      .eq('normalized_text', normalizedText)
      .eq('context_key', contextKey)
      .maybeSingle();

    if (error) {
      if (isSchemaMissingError(error) || error.code === '42P01' || error.code === 'PGRST205') {
        remoteCacheAvailable = false;
      }
      return null;
    }

    if (data && typeof data.translated_text === 'string' && data.translated_text.trim()) {
      return {
        translatedText: data.translated_text,
        detectedSourceLanguage:
          typeof data.detected_source_language === 'string'
            ? data.detected_source_language
            : null,
        lastUsedAt: Date.now(),
      };
    }
  } catch {
    // Non-fatal: continue smoothly to DeepL API
  }

  return null;
}

function saveRemoteTranslationCache(params: {
  sourceLang: string;
  targetLang: string;
  normalizedText: string;
  contextKey: string;
  originalText: string;
  translatedText: string;
  detectedSourceLanguage?: string | null;
}): void {
  if (
    !remoteCacheAvailable ||
    !params.normalizedText ||
    params.normalizedText.length > MAX_REMOTE_CACHE_TEXT_LEN
  ) {
    return;
  }

  void supabase
    .from('translation_cache')
    .upsert(
      {
        source_language: params.sourceLang,
        target_language: params.targetLang,
        normalized_text: params.normalizedText,
        context_key: params.contextKey,
        original_text: params.originalText.slice(0, 1500),
        translated_text: params.translatedText,
        detected_source_language: params.detectedSourceLanguage ?? null,
      },
      {
        onConflict: 'source_language,target_language,normalized_text',
        ignoreDuplicates: true,
      }
    )
    .then(({ error }) => {
      if (error && (isSchemaMissingError(error) || error.code === '42P01' || error.code === 'PGRST205')) {
        remoteCacheAvailable = false;
      }
    });
}

/**
 * Step A: Local Author Annotation Lookup (zero DeepL API consumption)
 * Priority:
 * 1) Exact index range match (when user clicks a highlighted annotation span)
 * 2) Exact normalized string match against term_or_phrase
 * 3) Overlap match if selection sits strictly inside an indexed annotation range
 */
export function findAuthorAnnotationMatch(
  selectedText: string,
  annotations: AuthorAnnotation[],
  selectionStartIndex?: number | null,
  selectionEndIndex?: number | null
): AuthorAnnotation | null {
  if (!annotations.length) return null;

  const normalizedSelection = normalizeLookupTerm(selectedText);
  if (!normalizedSelection) return null;

  // 1. Exact index range match
  if (typeof selectionStartIndex === 'number' && typeof selectionEndIndex === 'number') {
    const exactRange = annotations.find(
      (a) =>
        a.start_index !== null &&
        a.end_index !== null &&
        a.start_index === selectionStartIndex &&
        a.end_index === selectionEndIndex
    );
    if (exactRange) return exactRange;
  }

  // 2. Exact normalized term match
  const exactTerm = annotations.find(
    (a) => normalizeLookupTerm(a.term_or_phrase) === normalizedSelection
  );
  if (exactTerm) return exactTerm;

  // 3. Index containment match (clicking a character/word inside an annotated phrase)
  if (typeof selectionStartIndex === 'number' && typeof selectionEndIndex === 'number') {
    const containing = annotations.find(
      (a) =>
        a.start_index !== null &&
        a.end_index !== null &&
        selectionStartIndex >= a.start_index &&
        selectionEndIndex <= a.end_index
    );
    if (containing) return containing;
  }

  return null;
}

/**
 * Extracts the surrounding sentence for DeepL contextual semantic accuracy.
 */
export function extractContextSentence(
  fullText: string,
  selectedText: string,
  approxOffset?: number
): string {
  const cleaned = selectedText.trim();
  if (!fullText || !cleaned) return '';

  let idx = -1;
  if (typeof approxOffset === 'number' && approxOffset >= 0) {
    const nearby = fullText.indexOf(cleaned, Math.max(0, approxOffset - 20));
    idx = nearby !== -1 ? nearby : fullText.indexOf(cleaned);
  } else {
    idx = fullText.indexOf(cleaned);
  }

  if (idx === -1) return cleaned;

  const sentenceBoundary = /[.!?。！？\n]/;
  let start = idx;
  while (start > 0 && !sentenceBoundary.test(fullText[start - 1])) {
    start -= 1;
  }

  let end = idx + cleaned.length;
  while (end < fullText.length && !sentenceBoundary.test(fullText[end])) {
    end += 1;
  }
  if (end < fullText.length && sentenceBoundary.test(fullText[end]) && fullText[end] !== '\n') {
    end += 1;
  }

  return fullText.slice(start, end).trim().slice(0, 600);
}

/**
 * Hybrid Lookup Engine with Multi-Layer Caching:
 * Step A  -> Local author_annotations (0 DeepL calls)
 * Step B1 -> Local memory + localStorage LRU cache (0ms, 0 DeepL calls)
 * Step B2 -> Shared Supabase translation_cache (0 DeepL calls across sessions/devices)
 * Step B3 -> Authenticated /api/translate DeepL proxy (with server-side LRU cache), then caches result automatically
 */
export async function resolveTermMeaning(params: {
  selectedText: string;
  fullText: string;
  annotations: AuthorAnnotation[];
  targetNativeLanguage: string;
  sourceLanguage?: string;
  selectionStartIndex?: number | null;
  selectionEndIndex?: number | null;
}): Promise<LookupResult> {
  const {
    selectedText,
    fullText,
    annotations,
    targetNativeLanguage,
    sourceLanguage,
    selectionStartIndex,
    selectionEndIndex,
  } = params;

  const cleanedSelection = selectedText.trim();
  const contextSentence = extractContextSentence(
    fullText,
    cleanedSelection,
    selectionStartIndex ?? undefined
  );

  // Step A: Local Author Annotation Priority
  const localMatch = findAuthorAnnotationMatch(
    cleanedSelection,
    annotations,
    selectionStartIndex,
    selectionEndIndex
  );

  if (localMatch) {
    return {
      source: 'author',
      originalText: localMatch.term_or_phrase,
      translatedText: localMatch.explanation,
      difficultyLevel: localMatch.difficulty_level || null,
      pronunciation: localMatch.pronunciation,
      contextSentence,
      annotationId: localMatch.id,
    };
  }

  const normalizedKeyText =
    normalizeLookupTerm(cleanedSelection) || cleanedSelection.replace(/\s+/g, ' ').toLowerCase();
  const canonicalSource = normalizeLanguageCode(sourceLanguage) || 'AUTO';
  const targetLang = normalizeToDeepLTarget(targetNativeLanguage);
  const contextKey = normalizeLookupTerm(contextSentence).slice(0, 600);
  const cacheKey = buildTranslationCacheKey(canonicalSource, targetLang, normalizedKeyText, contextKey);

  // Step B1: Instant Client Cache (Memory + localStorage LRU)
  const localCached = getLocalCachedTranslation(cacheKey);
  if (localCached) {
    return {
      source: 'deepl',
      originalText: cleanedSelection,
      translatedText: localCached.translatedText,
      contextSentence,
      detectedSourceLanguage: localCached.detectedSourceLanguage ?? canonicalSource,
      cached: true,
    };
  }

  // Deduplicate concurrent clicks on the same word/expression
  const existingFlight = inFlightRequests.get(cacheKey);
  if (existingFlight) {
    const flightRes = await existingFlight;
    return {
      source: 'deepl',
      originalText: cleanedSelection,
      translatedText: flightRes.translatedText,
      contextSentence,
      detectedSourceLanguage: flightRes.detectedSourceLanguage ?? canonicalSource,
      cached: true,
    };
  }

  const lookupPromise = (async (): Promise<CachedTranslationEntry> => {
    // Step B2: Persistent Supabase translation_cache lookup
    const remoteCached = await lookupRemoteTranslationCache(
      canonicalSource,
      targetLang,
      normalizedKeyText,
      contextKey
    );
    if (remoteCached) {
      return setLocalCachedTranslation(
        cacheKey,
        remoteCached.translatedText,
        remoteCached.detectedSourceLanguage
      );
    }

    // Step B3: DeepL Fallback via authenticated backend proxy
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;

    const response = await fetch('/api/translate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        text: cleanedSelection,
        context: contextSentence,
        source_lang: sourceLanguage,
        target_lang: targetLang,
      }),
    });

    const payload = (await response.json().catch(() => ({}))) as {
      translatedText?: string;
      detectedSourceLanguage?: string | null;
      error?: string;
    };

    if (!response.ok || !payload.translatedText) {
      throw new Error(
        payload.error || 'Não foi possível traduzir o trecho selecionado via DeepL.'
      );
    }

    const cachedEntry = setLocalCachedTranslation(
      cacheKey,
      payload.translatedText,
      payload.detectedSourceLanguage ?? canonicalSource
    );

    // Fire-and-forget persistence into Supabase shared cache
    saveRemoteTranslationCache({
      sourceLang: canonicalSource,
      targetLang,
      normalizedText: normalizedKeyText,
      contextKey,
      originalText: cleanedSelection,
      translatedText: payload.translatedText,
      detectedSourceLanguage: payload.detectedSourceLanguage ?? canonicalSource,
    });

    return cachedEntry;
  })();

  inFlightRequests.set(cacheKey, lookupPromise);

  try {
    const resolved = await lookupPromise;
    return {
      source: 'deepl',
      originalText: cleanedSelection,
      translatedText: resolved.translatedText,
      contextSentence,
      detectedSourceLanguage: resolved.detectedSourceLanguage ?? canonicalSource,
    };
  } finally {
    inFlightRequests.delete(cacheKey);
  }
}
