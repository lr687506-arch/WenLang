import type { AuthorAnnotation } from '../types/database';
import { supabase } from './supabaseClient';
import { normalizeToDeepLTarget } from '../constants/languages';

export interface LookupResult {
  source: 'author' | 'deepl';
  originalText: string;
  translatedText: string;
  pronunciation?: string | null;
  contextSentence?: string;
  detectedSourceLanguage?: string | null;
  annotationId?: string;
}

/**
 * Strips leading/trailing punctuation across Latin and CJK scripts
 * so matching selected phrases against author_annotations is resilient.
 */
export function normalizeLookupTerm(term: string): string {
  return term
    .trim()
    .replace(/^[\s"'“”‘’「」『』【】《》〈〉()[\]{},.;:!?。、！？：；·—–-]+|[\s"'“”‘’「」『』【】《》〈〉()[\]{},.;:!?。、！？：；·—–-]+$/g, '')
    .toLowerCase();
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
export function extractContextSentence(fullText: string, selectedText: string, approxOffset?: number): string {
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
 * Hybrid Lookup Engine:
 * Step A -> Checks local author_annotations first (0 DeepL API calls).
 * Step B -> Falls back to server-side /api/translate proxy using user's native_language.
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
      pronunciation: localMatch.pronunciation,
      contextSentence,
      annotationId: localMatch.id,
    };
  }

  // Step B: DeepL Fallback via authenticated backend proxy
  const { data: sessionData } = await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  const targetLang = normalizeToDeepLTarget(targetNativeLanguage);

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

  return {
    source: 'deepl',
    originalText: cleanedSelection,
    translatedText: payload.translatedText,
    contextSentence,
    detectedSourceLanguage: payload.detectedSourceLanguage,
  };
}
