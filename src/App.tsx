import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { useTheme } from './hooks/useTheme';
import { Navbar } from './components/Navbar';
import { AuthView } from './components/AuthView';
import { OnboardingView } from './components/OnboardingView';
import { SchemaSetupBanner } from './components/SchemaSetupBanner';
import { FeedPage } from './pages/FeedPage';
import { ReadingView } from './pages/ReadingView';
import { PublishPage } from './pages/PublishPage';
import { ExamPage } from './pages/ExamPage';
import { SavedVocabularyPage } from './pages/SavedVocabularyPage';
import { ProfilePage } from './pages/ProfilePage';
import type { AppRoute } from './types/database';
import { Loader2, AlertCircle, RefreshCw, LogOut } from 'lucide-react';

/**
 * OnboardingGuard + Main App Router:
 * 1) Unauthenticated -> AuthView (Login, SignUp, Email Confirmation instructions)
 * 2) Authenticated + missing global tables -> SchemaSetupBanner
 * 3) Authenticated + transient profile fetch error -> clean retry card
 * 4) Authenticated + onboarding_completed === false -> Mandatory OnboardingView
 * 5) Authenticated + onboarding_completed === true -> Full WenLang Web workspace
 */
function WenLangShell() {
  const { user, profile, loading, schemaMissing, profileError, refreshProfile, signOut } =
    useAuth();
  const { theme, toggleTheme } = useTheme();

  const [route, setRoute] = useState<AppRoute>('feed');
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [activeExam, setActiveExam] = useState<{ examId: string; textId: string } | null>(null);
  const [publishPresetLang, setPublishPresetLang] = useState<string | undefined>(undefined);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] flex flex-col items-center justify-center gap-3 text-slate-500 dark:text-slate-400">
        <Loader2 className="w-6 h-6 animate-spin text-orange-600" />
        <p className="text-sm font-medium">Carregando WenLang...</p>
      </div>
    );
  }

  // Gate 1: Authentication required
  if (!user) {
    return <AuthView theme={theme} onToggleTheme={toggleTheme} />;
  }

  // Gate 2: Global Supabase tables not provisioned yet
  if (schemaMissing) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] px-4 py-10">
        <SchemaSetupBanner
          reason="tables_missing"
          onRetry={() => refreshProfile()}
          onSignOut={() => signOut()}
        />
      </div>
    );
  }

  // Gate 3: Non-schema profile error (never falsely blame schema.sql)
  if (!profile) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white dark:bg-[#131926] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8">
          <div className="flex items-start gap-3 text-red-700 dark:text-red-400">
            <AlertCircle className="w-5 h-5 mt-0.5 shrink-0" />
            <div>
              <h1 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
                Não foi possível carregar seu perfil
              </h1>
              <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {profileError ||
                  'Verifique sua conexão ou as políticas RLS da tabela profiles no Supabase.'}
              </p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-3">
            <button
              type="button"
              onClick={() => refreshProfile()}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors min-h-[40px]"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Tentar novamente</span>
            </button>
            <button
              type="button"
              onClick={() => signOut()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Gate 4: OnboardingGuard — mandatory native_language & target_languages setup
  if (!profile.onboarding_completed) {
    return <OnboardingView />;
  }

  const handleNavigate = (nextRoute: AppRoute) => {
    if (nextRoute !== 'publish') {
      setPublishPresetLang(undefined);
    }
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenText = (textId: string) => {
    setActiveTextId(textId);
    setRoute('reader');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNavigatePublish = (langCode?: string) => {
    setPublishPresetLang(langCode);
    setRoute('publish');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStartExam = (examId: string, textId: string) => {
    setActiveExam({ examId, textId });
    setRoute('exam');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 flex flex-col">
      <Navbar
        currentRoute={route}
        onNavigate={handleNavigate}
        isAuthenticated={Boolean(user)}
      />

      <main className="flex-1">
        {route === 'feed' && (
          <FeedPage
            onOpenText={handleOpenText}
            onNavigatePublish={handleNavigatePublish}
            onManageLanguages={() => handleNavigate('profile')}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}

        {route === 'reader' && activeTextId && (
          <ReadingView
            textId={activeTextId}
            onBack={() => handleNavigate('feed')}
            onStartExam={handleStartExam}
            theme={theme}
            onToggleTheme={toggleTheme}
          />
        )}

        {route === 'publish' && (
          <PublishPage
            initialLanguage={publishPresetLang}
            onPublished={(newTextId) => handleOpenText(newTextId)}
            onCancel={() => handleNavigate('feed')}
          />
        )}

        {route === 'exam' && activeExam && (
          <ExamPage
            examId={activeExam.examId}
            textId={activeExam.textId}
            onBackToReader={(tid) => handleOpenText(tid)}
            onBackToFeed={() => handleNavigate('feed')}
          />
        )}

        {route === 'saved' && (
          <SavedVocabularyPage
            onOpenText={handleOpenText}
            onExplore={() => handleNavigate('feed')}
          />
        )}

        {route === 'profile' && (
          <ProfilePage
            theme={theme}
            onToggleTheme={toggleTheme}
            onOpenText={handleOpenText}
          />
        )}
      </main>
    </div>
  );
}

export function App() {
  return (
    <AuthProvider>
      <WenLangShell />
    </AuthProvider>
  );
}

export default App;
