import React, { useState, useEffect } from 'react';
import { Database, Copy, Check, RefreshCw, ChevronDown, ChevronUp, LogOut } from 'lucide-react';

interface SchemaSetupBannerProps {
  reason: 'env_missing' | 'tables_missing';
  onRetry?: () => Promise<unknown> | void;
  onSignOut?: () => void;
}

export function SchemaSetupBanner({ reason, onRetry, onSignOut }: SchemaSetupBannerProps) {
  const [sqlText, setSqlText] = useState<string>('');
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [retryFeedback, setRetryFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (reason === 'tables_missing') {
      fetch('/api/schema')
        .then((res) => (res.ok ? res.text() : ''))
        .then((text) => setSqlText(text))
        .catch(() => {});
    }
  }, [reason]);

  const handleCopy = async () => {
    if (!sqlText) return;
    await navigator.clipboard.writeText(sqlText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRetry = async () => {
    if (!onRetry || retrying) return;
    setRetrying(true);
    setRetryFeedback(null);
    try {
      await onRetry();
      setRetryFeedback(
        'Verificação concluída. Se as tabelas ainda não foram detectadas, confirme se o script foi executado no projeto Supabase conectado.'
      );
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto my-8 p-6 sm:p-8 rounded-2xl bg-white dark:bg-[#131926] border border-amber-300 dark:border-amber-700/60">
      <div className="flex items-start gap-4">
        <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 shrink-0">
          <Database className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-50">
            {reason === 'env_missing'
              ? 'Variáveis do Supabase não detectadas'
              : 'Execute o script schema.sql no Supabase (uma única vez)'}
          </h2>
          <p className="mt-1.5 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
            {reason === 'env_missing'
              ? 'Configure VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e DEEPL_API_KEY nos Secrets do ambiente para conectar o WenLang Web ao seu projeto Supabase multiplataforma.'
              : 'A conexão com o Supabase foi estabelecida, mas as tabelas globais do WenLang (profiles, texts, author_annotations, exams, saved_vocabulary e user_reading_progress) ainda não existem neste banco. Execute o script schema.sql idempotente no SQL Editor do painel do Supabase.'}
          </p>

          {reason === 'tables_missing' && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCopy}
                disabled={!sqlText}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors disabled:opacity-50 whitespace-nowrap"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'SQL copiado' : 'Copiar schema.sql'}
              </button>

              <button
                type="button"
                onClick={() => setExpanded((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                {expanded ? 'Ocultar SQL' : 'Visualizar schema.sql'}
              </button>

              {onRetry && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={retrying}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:text-orange-600 dark:hover:text-orange-400 transition-colors whitespace-nowrap disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${retrying ? 'animate-spin' : ''}`} />
                  <span>{retrying ? 'Verificando...' : 'Verificar novamente'}</span>
                </button>
              )}

              {onSignOut && (
                <button
                  type="button"
                  onClick={onSignOut}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors whitespace-nowrap ml-auto"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair</span>
                </button>
              )}
            </div>
          )}

          {retryFeedback && (
            <p className="mt-3 text-xs text-amber-800 dark:text-amber-300">{retryFeedback}</p>
          )}

          {expanded && sqlText && (
            <pre className="mt-4 p-4 rounded-lg bg-slate-950 text-slate-200 text-xs font-mono overflow-x-auto max-h-80 leading-relaxed">
              {sqlText}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
