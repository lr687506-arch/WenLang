export interface AudioTimestamp {
  paragraphIndex: number;
  startSeconds: number;
  endSeconds?: number;
  label?: string;
  /** Word-level alignment metadata; absent on legacy paragraph timestamps. */
  wordIndex?: number;
  startIndex?: number;
  endIndex?: number;
  word?: string;
}

export interface Profile {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  native_language: string;
  interface_language: string;
  target_languages: string[];
  onboarding_completed: boolean;
  xp_points: number;
  created_at: string;
}

export interface TextItem {
  id: string;
  author_id: string;
  title: string;
  content: string;
  translated_title?: string | null;
  translated_content?: string | null;
  translation_language?: string | null;
  language: string;
  difficulty_level: string;
  cover_image_url: string | null;
  audio_url: string | null;
  audio_timestamps: AudioTimestamp[] | null;
  is_public: boolean;
  created_at: string;
  // Relational joins
  author?: Pick<Profile, 'id' | 'username' | 'full_name' | 'avatar_url'> | null;
  exams?: Array<{ id: string; title: string }>;
  author_annotations?: Array<{ id: string; term_or_phrase?: string }>;
}

export interface AuthorAnnotation {
  id: string;
  text_id: string;
  term_or_phrase: string;
  start_index: number | null;
  end_index: number | null;
  difficulty_level?: string | null;
  explanation: string;
  pronunciation: string | null;
  created_at: string;
}

export interface Exam {
  id: string;
  text_id: string;
  title: string;
  created_at: string;
  questions?: ExamQuestion[];
}

export interface ExamQuestion {
  id: string;
  exam_id: string;
  question_text: string;
  options: string[];
  correct_option_index: number;
  explanation: string | null;
}

export interface UserExamAttempt {
  id: string;
  user_id: string;
  exam_id: string;
  score: number;
  total_questions: number;
  completed_at: string;
  exam?: {
    id: string;
    title: string;
    text_id: string;
    texts?: {
      id: string;
      title: string;
      language: string;
    } | null;
  } | null;
}

export interface AuthorSummary {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
}

export type ReadingStatus = 'reading' | 'completed';

export interface UserReadingProgress {
  id: string;
  user_id: string;
  text_id: string;
  status: ReadingStatus;
  last_read_at: string;
}

export interface SavedVocabulary {
  id: string;
  user_id: string;
  text_id: string | null;
  original_text: string;
  translated_text: string;
  context_sentence: string | null;
  source: 'author' | 'deepl';
  created_at: string;
  text?: {
    id: string;
    title: string;
    language: string;
  } | null;
}

export type AppRoute = 'feed' | 'reader' | 'publish' | 'exam' | 'saved' | 'profile';
