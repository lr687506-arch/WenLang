-- ============================================================================
-- WenLang Global Multiplatform Database Schema (Web + Android — LingQ Model)
-- 100% Idempotent: safe to re-run anytime in the Supabase SQL Editor.
--
-- Architecture:
--   1. Shared Global Content (visible to all authenticated community members):
--      texts, author_annotations, exams, exam_questions,
--      Storage buckets: wenlang-audios, wenlang-covers
--   2. Individual Per-User Data (strictly isolated by auth.uid()):
--      profiles, saved_vocabulary, user_exam_attempts, user_reading_progress
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- LANGUAGE CATALOG (canonical codes shared by UI, profiles and DeepL)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.languages (
  code text PRIMARY KEY,
  source_code text NOT NULL,
  deepl_target_code text NOT NULL UNIQUE,
  name text NOT NULL,
  native_name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  sort_order smallint NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.languages (code,source_code,deepl_target_code,name,native_name,sort_order) VALUES
('PT-BR','PT','PT-BR','Portuguese (Brazil)','Português',1),
('EN-US','EN','EN-US','English (United States)','English',2),
('ES','ES','ES','Spanish','Español',3),
('JA','JA','JA','Japanese','日本語',4),
('ZH','ZH','ZH','Chinese','中文',5),
('ID','ID','ID','Indonesian','Bahasa Indonesia',6),
('FR','FR','FR','French','Français',7),
('DE','DE','DE','German','Deutsch',8),
('KO','KO','KO','Korean','한국어',9),
('IT','IT','IT','Italian','Italiano',10)
ON CONFLICT (code) DO UPDATE SET
  source_code=EXCLUDED.source_code, deepl_target_code=EXCLUDED.deepl_target_code,
  name=EXCLUDED.name, native_name=EXCLUDED.native_name,
  is_active=EXCLUDED.is_active, sort_order=EXCLUDED.sort_order;

-- ============================================================================
-- 1. PROFILES (Perfil individual: idioma nativo, idiomas de estudo, XP)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  native_language text NOT NULL DEFAULT 'PT-BR',
  interface_language text NOT NULL DEFAULT 'PT-BR' REFERENCES public.languages(code),
  target_languages text[] NOT NULL DEFAULT '{}'::text[],
  onboarding_completed boolean NOT NULL DEFAULT false,
  xp_points integer NOT NULL DEFAULT 0 CHECK (xp_points >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Idempotent column guards for pre-existing tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS native_language text NOT NULL DEFAULT 'PT-BR';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS interface_language text NOT NULL DEFAULT 'PT-BR' REFERENCES public.languages(code);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS target_languages text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS xp_points integer NOT NULL DEFAULT 0;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Automatically provision a profile whenever a new auth.users account is created
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_username text;
  candidate_username text;
BEGIN
  base_username := coalesce(
    nullif(trim(NEW.raw_user_meta_data ->> 'username'), ''),
    split_part(coalesce(NEW.email, 'user'), '@', 1)
  );
  base_username := regexp_replace(lower(base_username), '[^a-z0-9_]+', '', 'g');
  IF length(base_username) < 3 THEN
    base_username := 'reader';
  END IF;
  candidate_username := left(base_username, 20) || '_' || left(replace(NEW.id::text, '-', ''), 6);

  INSERT INTO public.profiles (
    id,
    username,
    full_name,
    avatar_url,
    native_language,
    target_languages,
    onboarding_completed,
    xp_points
  )
  VALUES (
    NEW.id,
    candidate_username,
    nullif(trim(NEW.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(NEW.raw_user_meta_data ->> 'avatar_url'), ''),
    coalesce(nullif(trim(NEW.raw_user_meta_data ->> 'native_language'), ''), 'PT-BR'),
    '{}'::text[],
    false,
    0
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill profiles for any existing auth.users who signed up before this trigger was created
INSERT INTO public.profiles (id, username, full_name, native_language, target_languages, onboarding_completed, xp_points)
SELECT
  u.id,
  left(
    greatest(
      coalesce(nullif(regexp_replace(lower(split_part(coalesce(u.email, 'reader'), '@', 1)), '[^a-z0-9_]+', '', 'g'), ''), 'reader'),
      'reader'
    ),
    20
  ) || '_' || left(replace(u.id::text, '-', ''), 6),
  nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
  'PT-BR',
  '{}'::text[],
  false,
  0
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = u.id)
ON CONFLICT (id) DO NOTHING;

-- Safe public author display lookup (exposes ONLY non-private author attribution fields,
-- keeping private profile fields like native_language, target_languages, xp_points strictly isolated)
CREATE OR REPLACE FUNCTION public.get_author_summaries(p_author_ids uuid[])
RETURNS TABLE (
  id uuid,
  username text,
  full_name text,
  avatar_url text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.username, p.full_name, p.avatar_url
  FROM public.profiles p
  WHERE p.id = ANY(p_author_ids);
$$;

GRANT EXECUTE ON FUNCTION public.get_author_summaries(uuid[]) TO authenticated;

-- ============================================================================
-- 2. TEXTS (Conteúdo Global Compartilhado)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  translated_title text,
  translated_content text,
  translation_language text,
  language text NOT NULL,
  difficulty_level text NOT NULL DEFAULT 'Iniciante',
  cover_image_url text,
  audio_url text,
  audio_timestamps jsonb,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.texts ADD COLUMN IF NOT EXISTS translated_title text;
ALTER TABLE public.texts ADD COLUMN IF NOT EXISTS translated_content text;
ALTER TABLE public.texts ADD COLUMN IF NOT EXISTS translation_language text;

CREATE INDEX IF NOT EXISTS idx_texts_author_id ON public.texts(author_id);
CREATE INDEX IF NOT EXISTS idx_texts_language_public ON public.texts(language, is_public);
CREATE INDEX IF NOT EXISTS idx_texts_difficulty ON public.texts(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_texts_created_at ON public.texts(created_at DESC);

-- ============================================================================
-- 3. AUTHOR_ANNOTATIONS (Explicações Prévias do Autor — Global Compartilhado)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.author_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id uuid NOT NULL REFERENCES public.texts(id) ON DELETE CASCADE,
  term_or_phrase text NOT NULL,
  start_index integer,
  end_index integer,
  difficulty_level text,
  explanation text NOT NULL,
  pronunciation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_annotation_indices CHECK (
    (start_index IS NULL AND end_index IS NULL)
    OR (start_index IS NOT NULL AND end_index IS NOT NULL AND start_index >= 0 AND end_index > start_index)
  )
);

ALTER TABLE public.author_annotations ADD COLUMN IF NOT EXISTS difficulty_level text;

CREATE INDEX IF NOT EXISTS idx_author_annotations_text_id ON public.author_annotations(text_id);
CREATE INDEX IF NOT EXISTS idx_author_annotations_term ON public.author_annotations(text_id, lower(term_or_phrase));

-- ============================================================================
-- 4. EXAMS & EXAM_QUESTIONS (Quizzes Globais Compartilhados)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.exams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id uuid NOT NULL REFERENCES public.texts(id) ON DELETE CASCADE,
  title text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exams_text_id ON public.exams(text_id);

CREATE TABLE IF NOT EXISTS public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_text text NOT NULL,
  options jsonb NOT NULL,
  correct_option_index integer NOT NULL CHECK (correct_option_index >= 0),
  explanation text
);

CREATE INDEX IF NOT EXISTS idx_exam_questions_exam_id ON public.exam_questions(exam_id);

-- ============================================================================
-- 5. USER_EXAM_ATTEMPTS (Histórico Individual de Exames)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0),
  total_questions integer NOT NULL CHECK (total_questions > 0),
  completed_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_score_lte_total CHECK (score <= total_questions)
);

CREATE INDEX IF NOT EXISTS idx_user_exam_attempts_user_id ON public.user_exam_attempts(user_id, completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_exam_attempts_exam_id ON public.user_exam_attempts(exam_id);

-- Atomic RPC: records exam attempt and increments profile XP points
CREATE OR REPLACE FUNCTION public.submit_exam_attempt(
  p_exam_id uuid,
  p_score integer,
  p_total_questions integer
)
RETURNS TABLE (
  attempt_id uuid,
  xp_awarded integer,
  new_xp_total integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_attempt_id uuid;
  v_xp_gain integer;
  v_total_xp integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_total_questions <= 0 OR p_score < 0 OR p_score > p_total_questions THEN
    RAISE EXCEPTION 'Invalid exam score payload';
  END IF;

  INSERT INTO public.user_exam_attempts (user_id, exam_id, score, total_questions)
  VALUES (v_user_id, p_exam_id, p_score, p_total_questions)
  RETURNING id INTO v_attempt_id;

  v_xp_gain := 10 + (p_score * 15);

  UPDATE public.profiles
  SET xp_points = xp_points + v_xp_gain
  WHERE id = v_user_id
  RETURNING xp_points INTO v_total_xp;

  RETURN QUERY SELECT v_attempt_id, v_xp_gain, coalesce(v_total_xp, v_xp_gain);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_exam_attempt(uuid, integer, integer) TO authenticated;

-- ============================================================================
-- 6. SAVED_VOCABULARY (Vocabulário Individual Salvo pelo Aluno)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.saved_vocabulary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text_id uuid REFERENCES public.texts(id) ON DELETE SET NULL,
  original_text text NOT NULL,
  translated_text text NOT NULL,
  context_sentence text,
  source text NOT NULL DEFAULT 'deepl' CHECK (source IN ('author', 'deepl')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_saved_vocabulary_user_id ON public.saved_vocabulary(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_vocabulary_text_id ON public.saved_vocabulary(text_id);

-- ============================================================================
-- 7. USER_READING_PROGRESS (Progresso Individual de Leitura nos Textos Globais)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.user_reading_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  text_id uuid NOT NULL REFERENCES public.texts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'reading' CHECK (status IN ('reading', 'completed')),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_reading_progress_user_text UNIQUE (user_id, text_id)
);

CREATE INDEX IF NOT EXISTS idx_user_reading_progress_user_id ON public.user_reading_progress(user_id, last_read_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_reading_progress_text_id ON public.user_reading_progress(text_id);

-- ============================================================================
-- 7B. TRANSLATION_CACHE (Cache Global de Traduções DeepL — Evita Chamadas Repetidas)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.translation_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_language text NOT NULL,
  target_language text NOT NULL,
  normalized_text text NOT NULL,
  context_key text NOT NULL DEFAULT '',
  original_text text NOT NULL,
  translated_text text NOT NULL,
  detected_source_language text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.translation_cache ADD COLUMN IF NOT EXISTS context_key text NOT NULL DEFAULT '';
ALTER TABLE public.translation_cache DROP CONSTRAINT IF EXISTS uq_translation_cache_lookup;
ALTER TABLE public.translation_cache ADD CONSTRAINT uq_translation_cache_lookup
  UNIQUE (source_language, target_language, normalized_text, context_key);
CREATE INDEX IF NOT EXISTS idx_translation_cache_lookup
  ON public.translation_cache(source_language, target_language, normalized_text, context_key);

-- ============================================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.translation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.languages ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- INDIVIDUAL DATA POLICIES (Strictly isolated by auth.uid())
-- ----------------------------------------------------------------------------
-- LANGUAGE CATALOG: authenticated read-only access.
DROP POLICY IF EXISTS "Authenticated users can read active languages" ON public.languages;
CREATE POLICY "Authenticated users can read active languages"
  ON public.languages FOR SELECT TO authenticated USING (is_active = true);


-- PROFILES: ALL strictly restricted to owner (auth.uid() = id)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users manage own profile strictly" ON public.profiles;
CREATE POLICY "Users manage own profile strictly"
  ON public.profiles FOR ALL
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- SAVED_VOCABULARY: ALL strictly restricted to owner (auth.uid() = user_id)
DROP POLICY IF EXISTS "Users can view own vocabulary" ON public.saved_vocabulary;
DROP POLICY IF EXISTS "Users can save own vocabulary" ON public.saved_vocabulary;
DROP POLICY IF EXISTS "Users can update own vocabulary" ON public.saved_vocabulary;
DROP POLICY IF EXISTS "Users can delete own vocabulary" ON public.saved_vocabulary;
DROP POLICY IF EXISTS "Users manage own vocabulary strictly" ON public.saved_vocabulary;
CREATE POLICY "Users manage own vocabulary strictly"
  ON public.saved_vocabulary FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- USER_EXAM_ATTEMPTS: ALL strictly restricted to owner (auth.uid() = user_id)
DROP POLICY IF EXISTS "Users can view own exam attempts" ON public.user_exam_attempts;
DROP POLICY IF EXISTS "Users can record own exam attempts" ON public.user_exam_attempts;
DROP POLICY IF EXISTS "Users manage own exam attempts strictly" ON public.user_exam_attempts;
CREATE POLICY "Users manage own exam attempts strictly"
  ON public.user_exam_attempts FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- USER_READING_PROGRESS: ALL strictly restricted to owner (auth.uid() = user_id)
DROP POLICY IF EXISTS "Users manage own reading progress strictly" ON public.user_reading_progress;
CREATE POLICY "Users manage own reading progress strictly"
  ON public.user_reading_progress FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- TRANSLATION_CACHE: Shared read/insert for authenticated users (no UPDATE/DELETE to prevent tampering)
DROP POLICY IF EXISTS "Authenticated users can read translation cache" ON public.translation_cache;
CREATE POLICY "Authenticated users can read translation cache"
  ON public.translation_cache FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can insert translation cache" ON public.translation_cache;
CREATE POLICY "Authenticated users can insert translation cache"
  ON public.translation_cache FOR INSERT
  TO authenticated
  WITH CHECK (
    length(trim(normalized_text)) > 0
    AND length(trim(translated_text)) > 0
    AND length(normalized_text) <= 500
    AND length(context_key) <= 600
    AND length(original_text) <= 1500
    AND length(translated_text) <= 10000
  );

-- ----------------------------------------------------------------------------
-- GLOBAL SHARED CONTENT POLICIES (SELECT for all authenticated; write for author)
-- ----------------------------------------------------------------------------

-- TEXTS
DROP POLICY IF EXISTS "Public texts or own texts are viewable" ON public.texts;
DROP POLICY IF EXISTS "Authenticated users can read public texts or own texts" ON public.texts;
CREATE POLICY "Authenticated users can read public texts or own texts"
  ON public.texts FOR SELECT
  TO authenticated
  USING (is_public = true OR auth.uid() = author_id);

DROP POLICY IF EXISTS "Authenticated users can publish texts" ON public.texts;
CREATE POLICY "Authenticated users can publish texts"
  ON public.texts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can update own texts" ON public.texts;
CREATE POLICY "Authors can update own texts"
  ON public.texts FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "Authors can delete own texts" ON public.texts;
CREATE POLICY "Authors can delete own texts"
  ON public.texts FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- AUTHOR_ANNOTATIONS
DROP POLICY IF EXISTS "Annotations viewable for accessible texts" ON public.author_annotations;
CREATE POLICY "Annotations viewable for accessible texts"
  ON public.author_annotations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.texts t
      WHERE t.id = author_annotations.text_id
        AND (t.is_public = true OR t.author_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authors can insert annotations on own texts" ON public.author_annotations;
CREATE POLICY "Authors can insert annotations on own texts"
  ON public.author_annotations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.texts t
      WHERE t.id = author_annotations.text_id
        AND t.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authors can update annotations on own texts" ON public.author_annotations;
CREATE POLICY "Authors can update annotations on own texts"
  ON public.author_annotations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.texts t
      WHERE t.id = author_annotations.text_id
        AND t.author_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.texts t
      WHERE t.id = author_annotations.text_id
        AND t.author_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authors can delete annotations on own texts" ON public.author_annotations;
CREATE POLICY "Authors can delete annotations on own texts"
  ON public.author_annotations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.texts t
      WHERE t.id = author_annotations.text_id
        AND t.author_id = auth.uid()
    )
  );

-- EXAMS
DROP POLICY IF EXISTS "Exams viewable for accessible texts" ON public.exams;
CREATE POLICY "Exams viewable for accessible texts"
  ON public.exams FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.texts t
      WHERE t.id = exams.text_id
        AND (t.is_public = true OR t.author_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authors can manage exams on own texts" ON public.exams;
CREATE POLICY "Authors can manage exams on own texts"
  ON public.exams FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.texts t
      WHERE t.id = exams.text_id
        AND t.author_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.texts t
      WHERE t.id = exams.text_id
        AND t.author_id = auth.uid()
    )
  );

-- EXAM_QUESTIONS
DROP POLICY IF EXISTS "Exam questions viewable for accessible exams" ON public.exam_questions;
CREATE POLICY "Exam questions viewable for accessible exams"
  ON public.exam_questions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exams e
      JOIN public.texts t ON t.id = e.text_id
      WHERE e.id = exam_questions.exam_id
        AND (t.is_public = true OR t.author_id = auth.uid())
    )
  );

DROP POLICY IF EXISTS "Authors can manage questions on own exams" ON public.exam_questions;
CREATE POLICY "Authors can manage questions on own exams"
  ON public.exam_questions FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.exams e
      JOIN public.texts t ON t.id = e.text_id
      WHERE e.id = exam_questions.exam_id
        AND t.author_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.exams e
      JOIN public.texts t ON t.id = e.text_id
      WHERE e.id = exam_questions.exam_id
        AND t.author_id = auth.uid()
    )
  );

-- ============================================================================
-- 9. SUPABASE STORAGE BUCKETS & POLICIES (Idempotent ON CONFLICT DO NOTHING)
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wenlang-audios',
  'wenlang-audios',
  true,
  26214400, -- 25 MB
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wenlang-covers',
  'wenlang-covers',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access for shared audio and cover buckets
DROP POLICY IF EXISTS "Public read access for wenlang-audios" ON storage.objects;
CREATE POLICY "Public read access for wenlang-audios"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wenlang-audios');

DROP POLICY IF EXISTS "Public read access for wenlang-covers" ON storage.objects;
CREATE POLICY "Public read access for wenlang-covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wenlang-covers');

-- Authenticated upload/update/delete restricted to own author folder: <auth.uid()>/filename
DROP POLICY IF EXISTS "Authenticated users upload own audios" ON storage.objects;
CREATE POLICY "Authenticated users upload own audios"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'wenlang-audios'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated users update own audios" ON storage.objects;
CREATE POLICY "Authenticated users update own audios"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'wenlang-audios'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated users delete own audios" ON storage.objects;
CREATE POLICY "Authenticated users delete own audios"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'wenlang-audios'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated users upload own covers" ON storage.objects;
CREATE POLICY "Authenticated users upload own covers"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'wenlang-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated users update own covers" ON storage.objects;
CREATE POLICY "Authenticated users update own covers"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'wenlang-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Authenticated users delete own covers" ON storage.objects;
CREATE POLICY "Authenticated users delete own covers"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'wenlang-covers'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Refresh PostgREST schema cache immediately
NOTIFY pgrst, 'reload schema';
