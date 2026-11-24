-- ============================================================================
-- WenLang Multiplatform Database Schema (Web + Android)
-- Execute this script in the Supabase SQL Editor
-- ============================================================================

-- Extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES (Usuários e Preferências)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  full_name text,
  avatar_url text,
  native_language text NOT NULL DEFAULT 'PT-BR',
  target_languages text[] NOT NULL DEFAULT '{}'::text[],
  onboarding_completed boolean NOT NULL DEFAULT false,
  xp_points integer NOT NULL DEFAULT 0 CHECK (xp_points >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Automatically provision a profile when a user signs up (Web or Android)
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

-- ============================================================================
-- 2. TEXTS (Textos e Conteúdos de Leitura)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.texts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL,
  language text NOT NULL,
  difficulty_level text NOT NULL DEFAULT 'Iniciante',
  cover_image_url text,
  audio_url text,
  audio_timestamps jsonb,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_texts_author_id ON public.texts(author_id);
CREATE INDEX IF NOT EXISTS idx_texts_language_public ON public.texts(language, is_public);
CREATE INDEX IF NOT EXISTS idx_texts_difficulty ON public.texts(difficulty_level);
CREATE INDEX IF NOT EXISTS idx_texts_created_at ON public.texts(created_at DESC);

-- ============================================================================
-- 3. AUTHOR_ANNOTATIONS (Explicações Prévias do Autor)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.author_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id uuid NOT NULL REFERENCES public.texts(id) ON DELETE CASCADE,
  term_or_phrase text NOT NULL,
  start_index integer,
  end_index integer,
  explanation text NOT NULL,
  pronunciation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_annotation_indices CHECK (
    (start_index IS NULL AND end_index IS NULL)
    OR (start_index IS NOT NULL AND end_index IS NOT NULL AND start_index >= 0 AND end_index > start_index)
  )
);

CREATE INDEX IF NOT EXISTS idx_author_annotations_text_id ON public.author_annotations(text_id);
CREATE INDEX IF NOT EXISTS idx_author_annotations_term ON public.author_annotations(text_id, lower(term_or_phrase));

-- ============================================================================
-- 4. EXAMS, EXAM_QUESTIONS & USER_EXAM_ATTEMPTS (Quizzes de Compreensão)
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

-- Atomic helper RPC: records exam attempt and increments profile XP points
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

  -- Base 10 XP for completing + 15 XP per correct answer
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
-- 5. SAVED_VOCABULARY (Palavras/Frases Salvas pelo Usuário)
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
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.texts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.author_annotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_vocabulary ENABLE ROW LEVEL SECURITY;

-- PROFILES policies
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- TEXTS policies
DROP POLICY IF EXISTS "Public texts or own texts are viewable" ON public.texts;
CREATE POLICY "Public texts or own texts are viewable"
  ON public.texts FOR SELECT
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

-- AUTHOR_ANNOTATIONS policies
DROP POLICY IF EXISTS "Annotations viewable for accessible texts" ON public.author_annotations;
CREATE POLICY "Annotations viewable for accessible texts"
  ON public.author_annotations FOR SELECT
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

-- EXAMS policies
DROP POLICY IF EXISTS "Exams viewable for accessible texts" ON public.exams;
CREATE POLICY "Exams viewable for accessible texts"
  ON public.exams FOR SELECT
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

-- EXAM_QUESTIONS policies
DROP POLICY IF EXISTS "Exam questions viewable for accessible exams" ON public.exam_questions;
CREATE POLICY "Exam questions viewable for accessible exams"
  ON public.exam_questions FOR SELECT
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

-- USER_EXAM_ATTEMPTS policies
DROP POLICY IF EXISTS "Users can view own exam attempts" ON public.user_exam_attempts;
CREATE POLICY "Users can view own exam attempts"
  ON public.user_exam_attempts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can record own exam attempts" ON public.user_exam_attempts;
CREATE POLICY "Users can record own exam attempts"
  ON public.user_exam_attempts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- SAVED_VOCABULARY policies
DROP POLICY IF EXISTS "Users can view own vocabulary" ON public.saved_vocabulary;
CREATE POLICY "Users can view own vocabulary"
  ON public.saved_vocabulary FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can save own vocabulary" ON public.saved_vocabulary;
CREATE POLICY "Users can save own vocabulary"
  ON public.saved_vocabulary FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own vocabulary" ON public.saved_vocabulary;
CREATE POLICY "Users can update own vocabulary"
  ON public.saved_vocabulary FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own vocabulary" ON public.saved_vocabulary;
CREATE POLICY "Users can delete own vocabulary"
  ON public.saved_vocabulary FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 7. SUPABASE STORAGE BUCKETS & POLICIES
-- ============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wenlang-audios',
  'wenlang-audios',
  true,
  26214400, -- 25 MB
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/mp4', 'audio/x-m4a', 'audio/aac']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'wenlang-covers',
  'wenlang-covers',
  true,
  5242880, -- 5 MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Public read access for audio and cover buckets
DROP POLICY IF EXISTS "Public read access for wenlang-audios" ON storage.objects;
CREATE POLICY "Public read access for wenlang-audios"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wenlang-audios');

DROP POLICY IF EXISTS "Public read access for wenlang-covers" ON storage.objects;
CREATE POLICY "Public read access for wenlang-covers"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'wenlang-covers');

-- Authenticated upload restricted to own user folder: <auth.uid()>/filename
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
