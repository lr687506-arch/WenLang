import type { AuthorAnnotation } from '../types/database';

export const FULL_TRANSLATION_SENTINEL = '__WENLANG_FULL_TRANSLATION__';
export const ANNOTATION_LEVELS_SENTINEL = '__WENLANG_ANNOTATION_LEVELS__';

export interface FullTranslationMeta {
  title: string;
  content: string;
  language: string | null;
}

export function isInternalAnnotationTerm(term: string | null | undefined): boolean {
  const t = (term || '').trim();
  return t === FULL_TRANSLATION_SENTINEL || t === ANNOTATION_LEVELS_SENTINEL;
}

export function buildAnnotationLevelKey(
  term: string,
  startIndex: number | null | undefined,
  endIndex: number | null | undefined
): string {
  const cleanTerm = term.trim().toLowerCase();
  if (typeof startIndex === 'number' && typeof endIndex === 'number') {
    return `${startIndex}:${endIndex}:${cleanTerm}`;
  }
  return cleanTerm;
}

export function encodeFullTranslationMeta(meta: FullTranslationMeta): string {
  return JSON.stringify({
    title: meta.title || '',
    content: meta.content || '',
    language: meta.language || null,
  });
}

export function encodeAnnotationLevelsMap(
  annotations: Array<{
    term_or_phrase: string;
    start_index: number | null;
    end_index: number | null;
    difficulty_level?: string | null;
  }>
): string {
  const map: Record<string, string> = {};
  for (const ann of annotations) {
    const lvl = (ann.difficulty_level || '').trim();
    if (!lvl) continue;
    map[buildAnnotationLevelKey(ann.term_or_phrase, ann.start_index, ann.end_index)] = lvl;
    const termKey = ann.term_or_phrase.trim().toLowerCase();
    if (termKey && !map[termKey]) {
      map[termKey] = lvl;
    }
  }
  return JSON.stringify(map);
}

export function splitAnnotationsAndMetadata(rawAnnotations: AuthorAnnotation[]): {
  visibleAnnotations: AuthorAnnotation[];
  fallbackTranslation: FullTranslationMeta | null;
} {
  let fallbackTranslation: FullTranslationMeta | null = null;
  let levelsMap: Record<string, string> = {};
  const visibleRaw: AuthorAnnotation[] = [];

  for (const ann of rawAnnotations) {
    const term = (ann.term_or_phrase || '').trim();
    if (term === FULL_TRANSLATION_SENTINEL) {
      try {
        const parsed = JSON.parse(ann.explanation) as Partial<FullTranslationMeta>;
        fallbackTranslation = {
          title: typeof parsed.title === 'string' ? parsed.title.trim() : '',
          content: typeof parsed.content === 'string' ? parsed.content.trim() : '',
          language:
            typeof parsed.language === 'string' && parsed.language.trim()
              ? parsed.language.trim()
              : ann.pronunciation || null,
        };
      } catch {
        if (ann.explanation?.trim()) {
          fallbackTranslation = {
            title: '',
            content: ann.explanation.trim(),
            language: ann.pronunciation || null,
          };
        }
      }
      continue;
    }

    if (term === ANNOTATION_LEVELS_SENTINEL) {
      try {
        const parsed = JSON.parse(ann.explanation) as Record<string, unknown>;
        if (parsed && typeof parsed === 'object') {
          const nextMap: Record<string, string> = {};
          for (const [k, v] of Object.entries(parsed)) {
            if (typeof v === 'string' && v.trim()) {
              nextMap[k] = v.trim();
            }
          }
          levelsMap = { ...levelsMap, ...nextMap };
        }
      } catch {
        // Ignore malformed legacy metadata
      }
      continue;
    }

    visibleRaw.push(ann);
  }

  const visibleAnnotations = visibleRaw.map((ann) => {
    if (ann.difficulty_level?.trim()) return ann;
    const exactKey = buildAnnotationLevelKey(
      ann.term_or_phrase,
      ann.start_index,
      ann.end_index
    );
    const termKey = ann.term_or_phrase.trim().toLowerCase();
    const resolvedLevel = levelsMap[exactKey] || levelsMap[termKey] || null;
    if (!resolvedLevel) return ann;
    return {
      ...ann,
      difficulty_level: resolvedLevel,
    };
  });

  return {
    visibleAnnotations,
    fallbackTranslation,
  };
}
