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

export function getLanguageLabel(code: string): string {
  const normalized = code.trim().toUpperCase();
  const exact = NATIVE_LANGUAGE_OPTIONS.find(
    (l) => l.deeplTargetCode === normalized || l.sourceCode === normalized
  );
  if (exact) return exact.label;
  const base = normalized.split('-')[0];
  const byBase = NATIVE_LANGUAGE_OPTIONS.find((l) => l.sourceCode === base);
  return byBase ? byBase.label : code;
}

export function getLanguageNativeName(code: string): string {
  const normalized = code.trim().toUpperCase();
  const exact = NATIVE_LANGUAGE_OPTIONS.find(
    (l) => l.deeplTargetCode === normalized || l.sourceCode === normalized
  );
  if (exact) return exact.nativeName;
  const base = normalized.split('-')[0];
  const byBase = NATIVE_LANGUAGE_OPTIONS.find((l) => l.sourceCode === base);
  return byBase ? byBase.nativeName : code;
}

export function normalizeToDeepLTarget(code: string): string {
  const upper = (code || 'PT-BR').trim().toUpperCase();
  if (upper === 'PT') return 'PT-BR';
  if (upper === 'EN') return 'EN-US';
  return upper;
}
