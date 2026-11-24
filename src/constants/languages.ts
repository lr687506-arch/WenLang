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

export const NATIVE_LANGUAGE_OPTIONS: LanguageOption[] = [
  {
    deeplTargetCode: 'PT-BR',
    sourceCode: 'PT',
    label: 'Português (Brasil)',
    nativeName: 'Português',
    levelSystem: 'CEFR',
    suggestedLevels: ['Iniciante', 'Intermediário', 'Avançado', 'A1', 'A2', 'B1', 'B2', 'C1'],
  },
  {
    deeplTargetCode: 'EN-US',
    sourceCode: 'EN',
    label: 'Inglês (EUA)',
    nativeName: 'English',
    levelSystem: 'CEFR',
    suggestedLevels: ['Iniciante', 'Intermediário', 'Avançado', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'],
  },
  {
    deeplTargetCode: 'ES',
    sourceCode: 'ES',
    label: 'Espanhol',
    nativeName: 'Español',
    levelSystem: 'DELE / CEFR',
    suggestedLevels: ['Iniciante', 'Intermediário', 'Avançado', 'A1', 'A2', 'B1', 'B2', 'C1'],
  },
  {
    deeplTargetCode: 'JA',
    sourceCode: 'JA',
    label: 'Japonês',
    nativeName: '日本語',
    levelSystem: 'JLPT',
    suggestedLevels: ['Iniciante', 'Intermediário', 'Avançado', 'N5', 'N4', 'N3', 'N2', 'N1'],
  },
  {
    deeplTargetCode: 'ZH',
    sourceCode: 'ZH',
    label: 'Chinês (Mandarim)',
    nativeName: '中文',
    levelSystem: 'HSK',
    suggestedLevels: ['Iniciante', 'Intermediário', 'Avançado', 'HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6'],
  },
  {
    deeplTargetCode: 'ID',
    sourceCode: 'ID',
    label: 'Indonésio',
    nativeName: 'Bahasa Indonesia',
    levelSystem: 'UKBI',
    suggestedLevels: ['Iniciante', 'Intermediário', 'Avançado'],
  },
  {
    deeplTargetCode: 'FR',
    sourceCode: 'FR',
    label: 'Francês',
    nativeName: 'Français',
    levelSystem: 'DELF / CEFR',
    suggestedLevels: ['Iniciante', 'Intermediário', 'Avançado', 'A1', 'A2', 'B1', 'B2', 'C1'],
  },
  {
    deeplTargetCode: 'DE',
    sourceCode: 'DE',
    label: 'Alemão',
    nativeName: 'Deutsch',
    levelSystem: 'Goethe / CEFR',
    suggestedLevels: ['Iniciante', 'Intermediário', 'Avançado', 'A1', 'A2', 'B1', 'B2', 'C1'],
  },
  {
    deeplTargetCode: 'KO',
    sourceCode: 'KO',
    label: 'Coreano',
    nativeName: '한국어',
    levelSystem: 'TOPIK',
    suggestedLevels: ['Iniciante', 'Intermediário', 'Avançado', 'TOPIK I', 'TOPIK II'],
  },
  {
    deeplTargetCode: 'IT',
    sourceCode: 'IT',
    label: 'Italiano',
    nativeName: 'Italiano',
    levelSystem: 'CEFR',
    suggestedLevels: ['Iniciante', 'Intermediário', 'Avançado', 'A1', 'A2', 'B1', 'B2', 'C1'],
  },
];

export const COMMON_DIFFICULTY_LEVELS = [
  'Iniciante',
  'Intermediário',
  'Avançado',
  'HSK 1',
  'HSK 2',
  'HSK 3',
  'HSK 4',
  'N5',
  'N4',
  'N3',
  'N2',
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
];

export const CURATED_EDITORIAL_COVERS = [
  {
    id: 'kyoto',
    label: 'Mesa em Quioto',
    url: '/src/assets/images/cover_kyoto_library_1795550593936.jpg',
  },
  {
    id: 'shanghai',
    label: 'Estúdio de Caligrafia',
    url: '/src/assets/images/cover_shanghai_study_1795550582896.jpg',
  },
  {
    id: 'editorial',
    label: 'Leitura e Áudio',
    url: '/src/assets/images/cover_editorial_books_1795550586355.jpg',
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
