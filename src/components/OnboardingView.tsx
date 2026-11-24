import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { NATIVE_LANGUAGE_OPTIONS } from '../constants/languages';
import { Check, AlertCircle, Loader2, LogOut, Globe2 } from 'lucide-react';

export function OnboardingView() {
  const { profile, updateProfile, signOut } = useAuth();

  const [username, setUsername] = useState(profile?.username || '');
  const [fullName, setFullName] = useState(profile?.full_name || '');
  const [nativeLanguage, setNativeLanguage] = useState(profile?.native_language || 'PT-BR');
  const [targetLanguages, setTargetLanguages] = useState<string[]>(
    profile?.target_languages?.length ? profile.target_languages : ['JA']
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleTargetLanguage = (sourceCode: string) => {
    setTargetLanguages((prev) =>
      prev.includes(sourceCode) ? prev.filter((c) => c !== sourceCode) : [...prev, sourceCode]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanedUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (cleanedUsername.length < 3) {
      setError('Escolha um nome de usuário com pelo menos 3 caracteres (letras, números ou _).');
      return;
    }
    if (!nativeLanguage) {
      setError('Selecione seu idioma nativo (obrigatório para traduções DeepL).');
      return;
    }
    if (targetLanguages.length === 0) {
      setError('Selecione pelo menos um idioma que você deseja estudar.');
      return;
    }

    setSaving(true);
    const { error: updateErr } = await updateProfile({
      username: cleanedUsername,
      full_name: fullName.trim() || null,
      native_language: nativeLanguage,
      target_languages: targetLanguages,
      onboarding_completed: true,
    });

    if (updateErr) {
      setError(updateErr);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] py-10 px-4 sm:px-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <span className="font-display text-2xl font-bold text-slate-900 dark:text-slate-50">
            WenLang
          </span>
          <button
            type="button"
            onClick={() => signOut()}
            className="inline-flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sair</span>
          </button>
        </div>

        <div className="bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-10">
          <div className="flex items-center gap-3 text-orange-600 dark:text-orange-400 text-xs font-semibold mb-2">
            <Globe2 className="w-4 h-4" />
            <span>Configuração inicial obrigatória</span>
          </div>
          <h1 className="font-display text-3xl font-semibold text-slate-900 dark:text-slate-50">
            Configure seu idioma nativo e seus estudos
          </h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-w-2xl">
            Seu idioma nativo define automaticamente o destino das traduções DeepL durante a leitura
            e mantém seu perfil sincronizado entre Web e Android.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-8">
            {/* Identity */}
            <section className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="onb-username"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Nome de usuário *
                </label>
                <input
                  id="onb-username"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ex: lucas_leituras"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
                />
              </div>
              <div>
                <label
                  htmlFor="onb-fullname"
                  className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Nome de exibição (opcional)
                </label>
                <input
                  id="onb-fullname"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="ex: Lucas Oliveira"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
                />
              </div>
            </section>

            {/* Native Language (DeepL target_lang) */}
            <section className="pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  1. Qual é o seu idioma nativo? *
                </h2>
                <span className="text-xs font-mono text-slate-500 dark:text-slate-400">
                  Código DeepL: {nativeLanguage}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {NATIVE_LANGUAGE_OPTIONS.map((lang) => {
                  const selected = nativeLanguage === lang.deeplTargetCode;
                  return (
                    <button
                      key={lang.deeplTargetCode}
                      type="button"
                      onClick={() => setNativeLanguage(lang.deeplTargetCode)}
                      className={`text-left p-3.5 rounded-xl border transition-colors flex items-center justify-between gap-2 min-h-[56px] ${
                        selected
                          ? 'border-orange-600 bg-orange-50/70 dark:bg-orange-950/30 text-slate-950 dark:text-white'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">{lang.label}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                          {lang.nativeName} · {lang.deeplTargetCode}
                        </div>
                      </div>
                      {selected && (
                        <span className="w-5 h-5 rounded-full bg-orange-600 text-white flex items-center justify-center shrink-0">
                          <Check className="w-3.5 h-3.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Target Study Languages */}
            <section className="pt-6 border-t border-slate-200 dark:border-slate-800">
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  2. Quais idiomas você está estudando? *
                </h2>
                <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                  {targetLanguages.length} selecionado(s)
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                {NATIVE_LANGUAGE_OPTIONS.map((lang) => {
                  const selected = targetLanguages.includes(lang.sourceCode);
                  return (
                    <button
                      key={lang.sourceCode}
                      type="button"
                      onClick={() => toggleTargetLanguage(lang.sourceCode)}
                      className={`px-3 py-2.5 rounded-xl border text-left transition-colors min-h-[52px] ${
                        selected
                          ? 'border-orange-600 bg-orange-600 text-white'
                          : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B0F17] text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="text-xs font-semibold truncate">{lang.nativeName}</div>
                      <div
                        className={`text-[11px] truncate ${
                          selected ? 'text-orange-100' : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        {lang.sourceCode} · {lang.levelSystem}
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-start gap-2"
              >
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                type="submit"
                disabled={saving}
                className="px-6 py-2.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors inline-flex items-center gap-2 min-h-[44px] disabled:opacity-60"
              >
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Concluir configuração e abrir biblioteca</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
