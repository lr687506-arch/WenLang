export interface LanguageOption {
  /** DeepL target_lang compatible code (e.g. PT-BR, EN-US, ES, ID, JA, ZH) */
  deeplTargetCode: string;
  /** Text/source language code stored in texts.language & target_languages (e.g. ZH, JA, EN, ID, ES, PT) */
  sourceCode: string;
  /** Label in Portuguese */
  label: string;
  /** Native script name */
  nativeName: string;
  /** Recommended proficiency framework */
  levelSystem: string;
  /** Suggested levels for publishing/filtering */
  suggestedLevels: string[];
}

export const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const HSK_LEVELS = ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'] as const;
export const NLPT_LEVELS = ['N5', 'N4', 'N3', 'N2', 'N1'] as const;
export const TOPIK_LEVELS = [
  'TOPIK 1',
  'TOPIK 2',
  'TOPIK 3',
  'TOPIK 4',
  'TOPIK 5',
  'TOPIK 6',
] as const;

export interface LevelColorMeta {
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  dot: string;
  barActive: string;
  barInactive: string;
  badge: string;
  textAccent: string;
  underline: string;
}

const LEVEL_TIER_STYLES: Record<1 | 2 | 3 | 4 | 5 | 6, LevelColorMeta> = {
  1: {
    tier: 1,
    dot: 'bg-emerald-500 dark:bg-emerald-400',
    barActive:
      'bg-emerald-600 text-white border-emerald-600 shadow-xs dark:bg-emerald-500 dark:text-slate-950 dark:border-emerald-500',
    barInactive:
      'bg-emerald-50/70 text-emerald-800 border-emerald-200 hover:bg-emerald-100/80 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800/70 dark:hover:bg-emerald-950/60',
    badge:
      'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/80',
    textAccent: 'text-emerald-700 dark:text-emerald-400',
    underline:
      'decoration-emerald-600 dark:decoration-emerald-400 hover:bg-emerald-500/15 dark:hover:bg-emerald-400/15 focus-visible:ring-emerald-600',
  },
  2: {
    tier: 2,
    dot: 'bg-teal-500 dark:bg-teal-400',
    barActive:
      'bg-teal-600 text-white border-teal-600 shadow-xs dark:bg-teal-500 dark:text-slate-950 dark:border-teal-500',
    barInactive:
      'bg-teal-50/70 text-teal-800 border-teal-200 hover:bg-teal-100/80 dark:bg-teal-950/30 dark:text-teal-300 dark:border-teal-800/70 dark:hover:bg-teal-950/60',
    badge:
      'bg-teal-50 text-teal-800 border-teal-200 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800/80',
    textAccent: 'text-teal-700 dark:text-teal-400',
    underline:
      'decoration-teal-600 dark:decoration-teal-400 hover:bg-teal-500/15 dark:hover:bg-teal-400/15 focus-visible:ring-teal-600',
  },
  3: {
    tier: 3,
    dot: 'bg-sky-500 dark:bg-sky-400',
    barActive:
      'bg-sky-600 text-white border-sky-600 shadow-xs dark:bg-sky-500 dark:text-slate-950 dark:border-sky-500',
    barInactive:
      'bg-sky-50/70 text-sky-800 border-sky-200 hover:bg-sky-100/80 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-800/70 dark:hover:bg-sky-950/60',
    badge:
      'bg-sky-50 text-sky-800 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800/80',
    textAccent: 'text-sky-700 dark:text-sky-400',
    underline:
      'decoration-sky-600 dark:decoration-sky-400 hover:bg-sky-500/15 dark:hover:bg-sky-400/15 focus-visible:ring-sky-600',
  },
  4: {
    tier: 4,
    dot: 'bg-amber-500 dark:bg-amber-400',
    barActive:
      'bg-amber-600 text-white border-amber-600 shadow-xs dark:bg-amber-500 dark:text-slate-950 dark:border-amber-500',
    barInactive:
      'bg-amber-50/70 text-amber-800 border-amber-200 hover:bg-amber-100/80 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800/70 dark:hover:bg-amber-950/60',
    badge:
      'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/80',
    textAccent: 'text-amber-700 dark:text-amber-400',
    underline:
      'decoration-amber-600 dark:decoration-amber-400 hover:bg-amber-500/15 dark:hover:bg-amber-400/15 focus-visible:ring-amber-600',
  },
  5: {
    tier: 5,
    dot: 'bg-violet-500 dark:bg-violet-400',
    barActive:
      'bg-violet-600 text-white border-violet-600 shadow-xs dark:bg-violet-500 dark:text-slate-950 dark:border-violet-500',
    barInactive:
      'bg-violet-50/70 text-violet-800 border-violet-200 hover:bg-violet-100/80 dark:bg-violet-950/30 dark:text-violet-300 dark:border-violet-800/70 dark:hover:bg-violet-950/60',
    badge:
      'bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/80',
    textAccent: 'text-violet-700 dark:text-violet-400',
    underline:
      'decoration-violet-600 dark:decoration-violet-400 hover:bg-violet-500/15 dark:hover:bg-violet-400/15 focus-visible:ring-violet-600',
  },
  6: {
    tier: 6,
    dot: 'bg-rose-500 dark:bg-rose-400',
    barActive:
      'bg-rose-600 text-white border-rose-600 shadow-xs dark:bg-rose-500 dark:text-slate-950 dark:border-rose-500',
    barInactive:
      'bg-rose-50/70 text-rose-800 border-rose-200 hover:bg-rose-100/80 dark:bg-rose-950/30 dark:text-rose-300 dark:border-rose-800/70 dark:hover:bg-rose-950/60',
    badge:
      'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800/80',
    textAccent: 'text-rose-700 dark:text-rose-400',
    underline:
      'decoration-rose-600 dark:decoration-rose-400 hover:bg-rose-500/15 dark:hover:bg-rose-400/15 focus-visible:ring-rose-600',
  },
};

const LEVEL_TO_TIER: Record<string, 1 | 2 | 3 | 4 | 5 | 6> = {
  A1: 1,
  A2: 2,
  B1: 3,
  B2: 4,
  C1: 5,
  C2: 6,
  'HSK 1': 1,
  'HSK 2': 2,
  'HSK 3': 3,
  'HSK 4': 4,
  'HSK 5': 5,
  'HSK 6': 6,
  HSK1: 1,
  HSK2: 2,
  HSK3: 3,
  HSK4: 4,
  HSK5: 5,
  HSK6: 6,
  N5: 1,
  N4: 2,
  N3: 3,
  N2: 4,
  N1: 5,
  'TOPIK 1': 1,
  'TOPIK 2': 2,
  'TOPIK 3': 3,
  'TOPIK 4': 4,
  'TOPIK 5': 5,
  'TOPIK 6': 6,
  TOPIK1: 1,
  TOPIK2: 2,
  TOPIK3: 3,
  TOPIK4: 4,
  TOPIK5: 5,
  TOPIK6: 6,
  'TOPIK I': 2,
  'TOPIK II': 4,
  INICIANTE: 1,
  'INTERMEDIÁRIO': 3,
  INTERMEDIARIO: 3,
  'AVANÇADO': 5,
  AVANCADO: 5,
};

export function getLevelsForLanguage(langCode: string | null | undefined): {
  system: string;
  levels: string[];
} {
  const norm = normalizeLanguageCode(langCode);
  if (norm === 'ZH') {
    return { system: 'HSK', levels: [...HSK_LEVELS] };
  }
  if (norm === 'JA') {
    return { system: 'NLPT / JLPT', levels: [...NLPT_LEVELS] };
  }
  if (norm === 'KO') {
    return { system: 'TOPIK', levels: [...TOPIK_LEVELS] };
  }
  return { system: 'CEFR', levels: [...CEFR_LEVELS] };
}

export function getLevelColorMeta(level: string | null | undefined): LevelColorMeta {
  const key = (level || '').trim().toUpperCase().replace(/\s+/g, ' ');
  const tier = LEVEL_TO_TIER[key] || 1;
  return LEVEL_TIER_STYLES[tier];
}

export function formatDifficultyLevels(
  levels: string[],
  langCode?: string | null
): string {
  const unique = Array.from(new Set(levels.map((l) => l.trim()).filter(Boolean)));
  if (unique.length === 0) {
    return getLevelsForLanguage(langCode).levels[0];
  }
  const canonicalOrder = getLevelsForLanguage(langCode).levels;
  const sorted = [...unique].sort((a, b) => {
    const idxA = canonicalOrder.indexOf(a);
    const idxB = canonicalOrder.indexOf(b);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return a.localeCompare(b);
  });
  return sorted.join('-');
}

export function parseDifficultyLevels(raw: string | null | undefined): string[] {
  const trimmed = (raw || '').trim();
  if (!trimmed) return [];
  const parts = trimmed
    .split(/[-,|/]+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length <= 1) return parts;

  // Handle shorthand ranges like "HSK 1-4" -> ["HSK 1", "HSK 4"]
  const prefixMatch = parts[0].match(/^(HSK|TOPIK)\s+\d+$/i);
  if (prefixMatch) {
    const prefix = prefixMatch[1].toUpperCase();
    return parts.map((p, idx) =>
      idx > 0 && /^\d+$/.test(p) ? `${prefix} ${p}` : p
    );
  }
  return parts;
}

export const NATIVE_LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    deeplTargetCode: 'PT-BR',
    sourceCode: 'PT',
    label: 'Português (Brasil)',
    nativeName: 'Português',
    levelSystem: 'CEFR',
    suggestedLevels: [...CEFR_LEVELS],
  },
  {
    deeplTargetCode: 'EN-US',
    sourceCode: 'EN',
    label: 'Inglês (EUA)',
    nativeName: 'English',
    levelSystem: 'CEFR',
    suggestedLevels: [...CEFR_LEVELS],
  },
  {
    deeplTargetCode: 'ES',
    sourceCode: 'ES',
    label: 'Espanhol',
    nativeName: 'Español',
    levelSystem: 'CEFR',
    suggestedLevels: [...CEFR_LEVELS],
  },
  {
    deeplTargetCode: 'JA',
    sourceCode: 'JA',
    label: 'Japonês',
    nativeName: '日本語',
    levelSystem: 'NLPT / JLPT',
    suggestedLevels: [...NLPT_LEVELS],
  },
  {
    deeplTargetCode: 'ZH',
    sourceCode: 'ZH',
    label: 'Chinês (Mandarim)',
    nativeName: '中文',
    levelSystem: 'HSK',
    suggestedLevels: [...HSK_LEVELS],
  },
  {
    deeplTargetCode: 'ID',
    sourceCode: 'ID',
    label: 'Indonésio',
    nativeName: 'Bahasa Indonesia',
    levelSystem: 'CEFR',
    suggestedLevels: [...CEFR_LEVELS],
  },
  {
    deeplTargetCode: 'FR',
    sourceCode: 'FR',
    label: 'Francês',
    nativeName: 'Français',
    levelSystem: 'CEFR',
    suggestedLevels: [...CEFR_LEVELS],
  },
  {
    deeplTargetCode: 'DE',
    sourceCode: 'DE',
    label: 'Alemão',
    nativeName: 'Deutsch',
    levelSystem: 'CEFR',
    suggestedLevels: [...CEFR_LEVELS],
  },
  {
    deeplTargetCode: 'KO',
    sourceCode: 'KO',
    label: 'Coreano',
    nativeName: '한국어',
    levelSystem: 'TOPIK',
    suggestedLevels: [...TOPIK_LEVELS],
  },
  {
    deeplTargetCode: 'IT',
    sourceCode: 'IT',
    label: 'Italiano',
    nativeName: 'Italiano',
    levelSystem: 'CEFR',
    suggestedLevels: [...CEFR_LEVELS],
  },
];

export const COMMON_DIFFICULTY_LEVELS = [
  ...CEFR_LEVELS,
  ...HSK_LEVELS,
  ...NLPT_LEVELS,
  ...TOPIK_LEVELS,
];

export const CURATED_EDITORIAL_COVERS = [
  {
    id: 'kyoto',
    label: 'Mesa em Quioto',
    url: '/covers/kyoto.jpg',
  },
  {
    id: 'shanghai',
    label: 'Estúdio de Caligrafia',
    url: '/covers/shanghai.jpg',
  },
  {
    id: 'editorial',
    label: 'Leitura e Áudio',
    url: '/covers/editorial.jpg',
  },
];

const LANGUAGE_CODE_ALIASES: Record<string, string> = {
  PT: 'PT',
  'PT-BR': 'PT',
  'PT-PT': 'PT',
  PORTUGUESE: 'PT',
  PORTUGUES: 'PT',
  'PORTUGUÊS': 'PT',
  EN: 'EN',
  'EN-US': 'EN',
  'EN-GB': 'EN',
  ENGLISH: 'EN',
  INGLES: 'EN',
  'INGLÊS': 'EN',
  ES: 'ES',
  'ES-ES': 'ES',
  'ES-MX': 'ES',
  SPANISH: 'ES',
  ESPANHOL: 'ES',
  JA: 'JA',
  JP: 'JA',
  'JA-JP': 'JA',
  JAPANESE: 'JA',
  JAPONES: 'JA',
  'JAPONÊS': 'JA',
  ZH: 'ZH',
  CN: 'ZH',
  'ZH-CN': 'ZH',
  'ZH-HANS': 'ZH',
  'ZH-HANT': 'ZH',
  CHINESE: 'ZH',
  CHINES: 'ZH',
  'CHINÊS': 'ZH',
  ID: 'ID',
  'ID-ID': 'ID',
  INDONESIAN: 'ID',
  INDONESIO: 'ID',
  'INDONÉSIO': 'ID',
  FR: 'FR',
  'FR-FR': 'FR',
  FRENCH: 'FR',
  FRANCES: 'FR',
  'FRANCÊS': 'FR',
  DE: 'DE',
  'DE-DE': 'DE',
  GERMAN: 'DE',
  ALEMAO: 'DE',
  'ALEMÃO': 'DE',
  KO: 'KO',
  KR: 'KO',
  'KO-KR': 'KO',
  KOREAN: 'KO',
  COREANO: 'KO',
  IT: 'IT',
  'IT-IT': 'IT',
  ITALIAN: 'IT',
  ITALIANO: 'IT',
};

/**
 * Standardizes any study/text language input into canonical 2-letter uppercase
 * source codes ('ES', 'EN', 'ZH', 'JA', 'ID', 'PT', 'FR', 'DE', 'KO', 'IT').
 */
export function normalizeLanguageCode(code: string | null | undefined): string {
  const upper = (code || '').trim().toUpperCase();
  if (!upper) return '';
  if (LANGUAGE_CODE_ALIASES[upper]) return LANGUAGE_CODE_ALIASES[upper];
  const base = upper.split('-')[0];
  if (LANGUAGE_CODE_ALIASES[base]) return LANGUAGE_CODE_ALIASES[base];
  return base;
}

/**
 * Normalizes and deduplicates an array of target study languages.
 */
export function normalizeTargetLanguages(codes: string[] | null | undefined): string[] {
  if (!Array.isArray(codes)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of codes) {
    const norm = normalizeLanguageCode(raw);
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      out.push(norm);
    }
  }
  return out;
}

export function getLanguageLabel(code: string): string {
  const normalized = normalizeLanguageCode(code);
  const rawUpper = (code || '').trim().toUpperCase();
  const exact = NATIVE_LANGUAGE_OPTIONS.find(
    (l) => l.deeplTargetCode === rawUpper || l.sourceCode === normalized
  );
  return exact ? exact.label : code;
}

export function getLanguageNativeName(code: string): string {
  const normalized = normalizeLanguageCode(code);
  const rawUpper = (code || '').trim().toUpperCase();
  const exact = NATIVE_LANGUAGE_OPTIONS.find(
    (l) => l.deeplTargetCode === rawUpper || l.sourceCode === normalized
  );
  return exact ? exact.nativeName : code;
}

export function normalizeToDeepLTarget(code: string): string {
  const upper = (code || 'PT-BR').trim().toUpperCase();
  if (upper === 'PT') return 'PT-BR';
  if (upper === 'EN') return 'EN-US';
  if (upper === 'JP') return 'JA';
  if (upper === 'CN') return 'ZH';
  return upper;
}
