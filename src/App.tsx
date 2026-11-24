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
import { Loader2 } from 'lucide-react';

/**
 * OnboardingGuard + Main App Router:
 * 1) Unauthenticated -> AuthView (Login, SignUp, Email Confirmation instructions)
 * 2) Authenticated + missing DB schema -> SchemaSetupBanner with schema.sql copy
 * 3) Authenticated + onboarding_completed === false -> Mandatory OnboardingView
 * 4) Authenticated + onboarded -> Full WenLang Web workspace
 */
function WenLangShell() {
  const { user, profile, loading, schemaMissing, refreshProfile } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [route, setRoute] = useState<AppRoute>('feed');
  const [activeTextId, setActiveTextId] = useState<string | null>(null);
  const [activeExam, setActiveExam] = useState<{ examId: string; textId: string } | null>(null);

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

  // Gate 2: Supabase schema not provisioned yet
  if (schemaMissing) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0F17] px-4 py-10">
        <SchemaSetupBanner reason="tables_missing" onRetry={() => refreshProfile()} />
      </div>
    );
  }

  // Gate 3: OnboardingGuard — mandatory native_language & target_languages setup
  if (profile && !profile.onboarding_completed) {
    return <OnboardingView />;
  }

  const handleNavigate = (nextRoute: AppRoute) => {
    setRoute(nextRoute);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenText = (textId: string) => {
    setActiveTextId(textId);
    setRoute('reader');
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
            onNavigatePublish={() => handleNavigate('publish')}
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
