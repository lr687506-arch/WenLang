import React, { useEffect, useState } from 'react';
import { supabase } from '../services/supabaseClient';
import { useAuth } from '../context/AuthContext';
import { NATIVE_LANGUAGE_OPTIONS, getLanguageLabel } from '../constants/languages';
import type { TextItem, UserExamAttempt } from '../types/database';
import type { ThemeMode } from '../hooks/useTheme';
import {
  LogOut,
  Check,
  Loader2,
  Sun,
  Moon,
  AlertCircle,
  Award,
  BookOpen,
  ExternalLink,
} from 'lucide-react';

interface ProfilePageProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
  onOpenText: (textId: string) => void;
}

export function ProfilePage({ theme, onToggleTheme, onOpenText }: ProfilePageProps) {
  const { user, profile, updateProfile, signOut } = useAuth();

  const [username, setUsername] = useState(profile?.username || '');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [nativeLanguage, setNativeLanguage] = useState(profile?.native_language || 'PT-BR');
  const [targetLanguages, setTargetLanguages] = useState<string[]>(profile?.target_languages || []);

  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [myTexts, setMyTexts] = useState<TextItem[]>([]);
  const [attempts, setAttempts] = useState<UserExamAttempt[]>([]);
  const [vocabCount, setVocabCount] = useState(0);

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username);
    setFullName(profile.full_name || '');
    setNativeLanguage(profile.native_language || 'PT-BR');
    setTargetLanguages(profile.target_languages || []);
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase
        .from('texts')
        .select('id, title, language, difficulty_level, is_public, created_at')
        .eq('author_id', user.id)
        .order('created_at', { ascending: false }),
      supabase
        .from('user_exam_attempts')
        .select(
          `
          id,
          exam_id,
          score,
          total_questions,
          completed_at,
          exam:exams(id, title, text_id)
        `
        )
        .eq('user_id', user.id)
        .order('completed_at', { ascending: false })
        .limit(10),
      supabase
        .from('saved_vocabulary')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id),
    ]).then(([textsRes, attemptsRes, vocabRes]) => {
      if (textsRes.data) setMyTexts(textsRes.data as unknown as TextItem[]);
      if (attemptsRes.data) {
        const norm = (attemptsRes.data as unknown as UserExamAttempt[]).map((a) => ({
          ...a,
          exam: Array.isArray(a.exam) ? a.exam[0] ?? null : a.exam ?? null,
        }));
        setAttempts(norm);
      }
      if (typeof vocabRes.count === 'number') setVocabCount(vocabRes.count);
    });
  }, [user]);

  const toggleTarget = (sourceCode: string) => {
    setTargetLanguages((prev) =>
      prev.includes(sourceCode) ? prev.filter((c) => c !== sourceCode) : [...prev, sourceCode]
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSavedNotice(false);

    const cleanedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanedUsername.length < 3) {
      setError('O nome de usuário deve ter pelo menos 3 caracteres.');
      return;
    }

    setSaving(true);
    const { error: err } = await updateProfile({
      username: cleanedUsername,
      full_name: fullName.trim() || null,
      native_language: nativeLanguage,
      target_languages: targetLanguages,
    });
    setSaving(false);

    if (err) {
      setError(err);
      return;
    }

    setSavedNotice(true);
    setTimeout(() => setSavedNotice(false), 3000);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 pb-28 md:pb-16 space-y-8">
      {/* Profile Summary Header */}
      <section className="pb-6 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            Conta WenLang · {user?.email}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold text-slate-950 dark:text-slate-50">
            {profile?.full_name || profile?.username || 'Seu Perfil'}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-lg hover:border-slate-300 dark:hover:border-slate-700 transition-colors min-h-[40px]"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
          </button>

          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-red-700 dark:text-red-400 border border-red-200 dark:border-red-900/70 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors min-h-[40px]"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair da conta</span>
          </button>
        </div>
      </section>

      {/* Clean KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">Pontuação total</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-orange-600 dark:text-orange-400 tabular-nums">
            {profile?.xp_points ?? 0} XP
          </div>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">Idioma nativo (DeepL)</div>
          <div className="mt-1.5 text-base font-semibold text-slate-900 dark:text-slate-100 truncate">
            {getLanguageLabel(profile?.native_language || 'PT-BR').split(' ')[0]}{' '}
            <span className="font-mono text-xs text-slate-500">
              {profile?.native_language || 'PT-BR'}
            </span>
          </div>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">Vocabulário salvo</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-slate-950 dark:text-white tabular-nums">
            {vocabCount}
          </div>
        </div>
        <div className="p-5 rounded-xl bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800">
          <div className="text-xs text-slate-500 dark:text-slate-400">Exames concluídos</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-slate-950 dark:text-white tabular-nums">
            {attempts.length}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Settings Form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6"
        >
          <h2 className="font-display text-xl font-semibold text-slate-900 dark:text-slate-50">
            Preferências de idioma e conta
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="prof-username"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Nome de usuário
              </label>
              <input
                id="prof-username"
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
              />
            </div>

            <div>
              <label
                htmlFor="prof-fullname"
                className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Nome completo
              </label>
              <input
                id="prof-fullname"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="prof-native"
              className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
            >
              Idioma Nativo (destino automático das traduções DeepL)
            </label>
            <select
              id="prof-native"
              value={nativeLanguage}
              onChange={(e) => setNativeLanguage(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
            >
              {NATIVE_LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.deeplTargetCode} value={lang.deeplTargetCode}>
                  {lang.label} — {lang.deeplTargetCode}
                </option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
              Idiomas de estudo
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {NATIVE_LANGUAGE_OPTIONS.map((lang) => {
                const active = targetLanguages.includes(lang.sourceCode);
                return (
                  <button
                    key={lang.sourceCode}
                    type="button"
                    onClick={() => toggleTarget(lang.sourceCode)}
                    className={`px-3 py-2 rounded-lg border text-xs font-medium text-left flex items-center justify-between gap-2 transition-colors min-h-[40px] ${
                      active
                        ? 'border-orange-600 bg-orange-50 dark:bg-orange-950/40 text-orange-900 dark:text-orange-200 font-semibold'
                        : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                    }`}
                  >
                    <span className="truncate">{lang.label.split(' ')[0]}</span>
                    {active && <Check className="w-3.5 h-3.5 text-orange-600 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {savedNotice && (
            <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>Preferências salvas e sincronizadas com o Supabase.</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 min-h-[44px] disabled:opacity-60"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>Salvar alterações</span>
            </button>
          </div>
        </form>

        {/* Right Column: Recent Exam History & Own Published Texts */}
        <div className="lg:col-span-5 space-y-6">
          {/* Exam Attempts */}
          <section className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <Award className="w-4 h-4 text-orange-600 dark:text-orange-400" />
              <span>Histórico recente de exames</span>
            </h2>
            {attempts.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Conclua exames após ler um texto para registrar seu histórico e ganhar XP.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                {attempts.map((att) => (
                  <li key={att.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {att.exam?.title || 'Exame de compreensão'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(att.completed_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                    <span className="font-mono text-xs font-semibold text-emerald-700 dark:text-emerald-400 tabular-nums shrink-0">
                      {att.score}/{att.total_questions}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* My Published Texts */}
          <section className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2 pb-3 border-b border-slate-100 dark:border-slate-800">
              <BookOpen className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <span>Suas publicações ({myTexts.length})</span>
            </h2>
            {myTexts.length === 0 ? (
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Você ainda não publicou nenhum texto.
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
                {myTexts.map((t) => (
                  <li key={t.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {t.title}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        {t.language} · {t.difficulty_level} · {t.is_public ? 'Público' : 'Privado'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenText(t.id)}
                      aria-label={`Abrir ${t.title}`}
                      className="p-1.5 text-slate-400 hover:text-orange-600 dark:hover:text-orange-400 shrink-0"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
