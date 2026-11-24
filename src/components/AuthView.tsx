import React, { useState } from 'react';
import { supabase, isSupabaseConfigured } from '../services/supabaseClient';
import { SchemaSetupBanner } from './SchemaSetupBanner';
import {
  MailCheck,
  AlertCircle,
  Loader2,
  Sun,
  Moon,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import type { ThemeMode } from '../hooks/useTheme';

interface AuthViewProps {
  theme: ThemeMode;
  onToggleTheme: () => void;
}

export function AuthView({ theme, onToggleTheme }: AuthViewProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [awaitingConfirmationEmail, setAwaitingConfirmationEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError('Informe seu e-mail e senha para continuar.');
      return;
    }

    if (mode === 'signup' && password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: trimmedEmail,
          password,
        });
        if (signInError) {
          if (signInError.message.toLowerCase().includes('email not confirmed')) {
            setAwaitingConfirmationEmail(trimmedEmail);
            return;
          }
          throw signInError;
        }
      } else {
        const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: trimmedEmail,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: fullName.trim() || undefined,
              username: cleanUsername || undefined,
            },
          },
        });

        if (signUpError) throw signUpError;

        // If Supabase requires email confirmation, session is null until link is clicked
        if (!data.session) {
          setAwaitingConfirmationEmail(trimmedEmail);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha na autenticação.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleResendConfirmation = async () => {
    if (!awaitingConfirmationEmail) return;
    setResending(true);
    setError(null);
    setInfoMessage(null);
    try {
      const { error: resendErr } = await supabase.auth.resend({
        type: 'signup',
        email: awaitingConfirmationEmail,
        options: { emailRedirectTo: window.location.origin },
      });
      if (resendErr) throw resendErr;
      setInfoMessage('Um novo link de confirmação foi enviado para a sua caixa de entrada.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível reenviar o e-mail.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] flex flex-col">
      {/* Minimal top strip */}
      <div className="max-w-6xl w-full mx-auto px-6 py-5 flex items-center justify-between">
        <span className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
          WenLang
        </span>
        <button
          type="button"
          onClick={onToggleTheme}
          aria-label="Alternar tema claro ou escuro"
          className="inline-flex items-center gap-2 px-3 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg hover:bg-white dark:hover:bg-[#131926] transition-colors"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          <span>{theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}</span>
        </button>
      </div>

      {!isSupabaseConfigured ? (
        <div className="flex-1 px-4">
          <SchemaSetupBanner reason="env_missing" />
        </div>
      ) : awaitingConfirmationEmail ? (
        <main className="flex-1 flex items-center justify-center px-4 py-12">
          <div className="w-full max-w-md bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl p-8">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 flex items-center justify-center mb-6">
              <MailCheck className="w-6 h-6" />
            </div>

            <h1 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-50">
              Confirme seu endereço de e-mail
            </h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Enviamos um link de confirmação para{' '}
              <strong className="font-semibold text-slate-900 dark:text-white">
                {awaitingConfirmationEmail}
              </strong>
              . Abra sua caixa de entrada (e verifique o spam) para ativar sua conta WenLang.
            </p>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Assim que confirmar o e-mail e realizar o primeiro login, você escolherá seu idioma
              nativo para traduções automáticas e seus idiomas de estudo.
            </p>

            {error && (
              <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {infoMessage && (
              <div className="mt-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-900 text-emerald-800 dark:text-emerald-300 text-sm">
                {infoMessage}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-3">
              <button
                type="button"
                onClick={() => {
                  setAwaitingConfirmationEmail(null);
                  setMode('login');
                  setError(null);
                  setInfoMessage(null);
                }}
                className="w-full py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors min-h-[44px]"
              >
                Já confirmei, fazer login
              </button>
              <button
                type="button"
                onClick={handleResendConfirmation}
                disabled={resending}
                className="w-full py-2.5 px-4 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium transition-colors flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-50"
              >
                {resending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                <span>Reenviar e-mail de confirmação</span>
              </button>
            </div>
          </div>
        </main>
      ) : (
        <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          {/* Editorial Left Column */}
          <div className="lg:col-span-7 flex flex-col justify-between rounded-2xl overflow-hidden bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800">
            <div className="relative h-56 sm:h-72 lg:h-80 w-full overflow-hidden bg-slate-200 dark:bg-slate-800">
              <img
                src="/src/assets/images/cover_kyoto_library_1795550593936.jpg"
                alt="Mesa de leitura literária iluminada em Quioto"
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent" />
              <div className="absolute bottom-6 left-6 right-6 text-white">
                <p className="text-xs font-medium tracking-wide text-orange-200">
                  Web · Android · Sincronização Supabase
                </p>
                <h1 className="mt-1.5 font-display text-2xl sm:text-3xl font-semibold leading-tight">
                  Leitura imersiva com notas do autor e tradução contextual
                </h1>
              </div>
            </div>

            <div className="p-6 sm:p-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Prioridade do Autor
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Termos explicados pelo autor aparecem na hora com pronúncia e contexto cultural.
                </p>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Fallback DeepL
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Selecione qualquer outra palavra ou frase e traduza automaticamente para o seu idioma nativo.
                </p>
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Áudio e Exames
                </h2>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  Ouça narrações reais, salve flashcards e acumule pontos de XP em exames de compreensão.
                </p>
              </div>
            </div>
          </div>

          {/* Auth Form Column */}
          <div className="lg:col-span-5 flex flex-col justify-center bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8">
            <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'login'
                    ? 'bg-white dark:bg-[#1A2233] text-slate-950 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  mode === 'signup'
                    ? 'bg-white dark:bg-[#1A2233] text-slate-950 dark:text-white shadow-xs'
                    : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200'
                }`}
              >
                Criar conta
              </button>
            </div>

            <h2 className="font-display text-2xl font-semibold text-slate-900 dark:text-slate-50">
              {mode === 'login' ? 'Acesse sua biblioteca' : 'Comece a estudar hoje'}
            </h2>
            <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-400">
              {mode === 'login'
                ? 'Use a mesma conta do app WenLang Android.'
                : 'Crie sua conta e confirme seu e-mail para sincronizar seu progresso.'}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === 'signup' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="auth-fullname"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Nome completo
                    </label>
                    <input
                      id="auth-fullname"
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex: Marina Costa"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="auth-username"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Usuário
                    </label>
                    <input
                      id="auth-username"
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="marina_polyglot"
                      className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
                    />
                  </div>
                </div>
              )}

              <div>
                <label
                  htmlFor="auth-email"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  E-mail
                </label>
                <input
                  id="auth-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="voce@exemplo.com"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
                />
              </div>

              <div>
                <label
                  htmlFor="auth-password"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Senha
                </label>
                <input
                  id="auth-password"
                  type="password"
                  required
                  minLength={6}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo de 6 caracteres"
                  className="w-full px-3.5 py-2.5 rounded-lg bg-slate-50 dark:bg-[#0B0F17] border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-orange-600"
                />
              </div>

              {error && (
                <div
                  role="alert"
                  className="p-3 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-start gap-2"
                >
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 py-2.5 px-4 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>{mode === 'login' ? 'Entrar no WenLang' : 'Criar conta gratuita'}</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>
          </div>
        </main>
      )}
    </div>
  );
}
