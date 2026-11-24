import React from 'react';
import type { AppRoute } from '../types/database';
import { BookOpen, PenLine, BookmarkCheck, User } from 'lucide-react';

interface NavbarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  isAuthenticated: boolean;
}

const NAV_ITEMS: Array<{ route: AppRoute; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { route: 'feed', label: 'Explorar', icon: BookOpen },
  { route: 'publish', label: 'Publicar', icon: PenLine },
  { route: 'saved', label: 'Vocabulário', icon: BookmarkCheck },
  { route: 'profile', label: 'Perfil', icon: User },
];

export function Navbar({ currentRoute, onNavigate, isAuthenticated }: NavbarProps) {
  const activeNavRoute: AppRoute =
    currentRoute === 'reader' || currentRoute === 'exam' ? 'feed' : currentRoute;

  return (
    <>
      {/* Desktop & Mobile Top Header — Strict 3-Zone Contract */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md">
        <div className="max-w-6xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <button
            type="button"
            onClick={() => onNavigate('feed')}
            className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50 hover:text-orange-600 dark:hover:text-orange-400 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 rounded"
          >
            WenLang
          </button>

          {/* Zone 2: 4 Clean Single-Line Text Navigation Links */}
          <nav
            aria-label="Navegação principal"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeNavRoute === item.route;
              return (
                <button
                  key={item.route}
                  type="button"
                  onClick={() => onNavigate(item.route)}
                  className={`py-1.5 border-b-2 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 ${
                    isActive
                      ? 'border-orange-600 dark:border-orange-500 text-slate-950 dark:text-white font-semibold'
                      : 'border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-950 dark:hover:text-slate-100 hover:border-slate-300 dark:hover:border-slate-700'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => onNavigate(isAuthenticated ? 'publish' : 'profile')}
              className="px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 dark:bg-orange-600 dark:hover:bg-orange-500 rounded-lg transition-colors whitespace-nowrap shrink-0 min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-600 dark:focus-visible:ring-offset-[#0B0F17]"
            >
              Novo Texto
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Compact Bottom Navigation (<= 56px, well within 15% mobile sticky cap) */}
      <nav
        aria-label="Navegação móvel"
        className="md:hidden fixed bottom-0 inset-x-0 z-30 h-14 border-t border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#0B0F17]/95 backdrop-blur-md grid grid-cols-4"
      >
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = activeNavRoute === item.route;
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => onNavigate(item.route)}
              className={`flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors whitespace-nowrap ${
                isActive
                  ? 'text-orange-600 dark:text-orange-400 font-semibold'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </>
  );
}
