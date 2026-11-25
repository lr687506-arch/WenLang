import type { IncomingMessage, ServerResponse } from 'node:http';
import { createClient } from '@supabase/supabase-js';

interface VercelRequest extends IncomingMessage {
  body?: unknown;
}

interface VercelResponse extends ServerResponse {
  status: (code: number) => VercelResponse;
  json: (data: unknown) => void;
}

const ALLOWED_TARGET_LANGS = new Set([
  'AR', 'BG', 'CS', 'DA', 'DE', 'EL', 'EN-GB', 'EN-US', 'ES', 'ET',
  'FI', 'FR', 'HU', 'ID', 'IT', 'JA', 'KO', 'LT', 'LV', 'NB',
  'NL', 'PL', 'PT-BR', 'PT-PT', 'RO', 'RU', 'SK', 'SL', 'SV',
  'TR', 'UK', 'ZH', 'ZH-HANS', 'ZH-HANT',
]);

const ALLOWED_SOURCE_LANGS = new Set([
  'AR', 'BG', 'CS', 'DA', 'DE', 'EL', 'EN', 'ES', 'ET', 'FI',
  'FR', 'HU', 'ID', 'IT', 'JA', 'KO', 'LT', 'LV', 'NB', 'NL',
  'PL', 'PT', 'RO', 'RU', 'SK', 'SL', 'SV', 'TR', 'UK', 'ZH',
]);

function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  const cleaned = (rawUrl || '').trim().replace(/^["']|["']$/g, '');
  if (!cleaned) return '';
  try {
    const parsed = new URL(cleaned);
    if (/\.(supabase\.co|supabase\.in|supabase\.net)$/i.test(parsed.hostname)) {
      return parsed.origin;
    }
    const strippedPath = parsed.pathname
      .replace(/\/(rest|auth|storage|realtime|functions|graphql)\/v1\/?.*$/i, '')
      .replace(/\/+$/, '');
    return `${parsed.origin}${strippedPath}`;
  } catch {
    return cleaned.replace(/\/+$/, '');
  }
}

interface CachedServerTranslation {
  translatedText: string;
  detectedSourceLanguage: string | null;
  targetLang: string;
}

const serverlessTranslationCache = new Map<string, CachedServerTranslation>();
const MAX_SERVERLESS_CACHE = 1000;

function normalizeCacheTerm(text: string): string {
  return text
    .trim()
    .replace(
      /^[\s"'“”‘’「」『』【】《》〈〉()[\]{},.;:!?。、！？：；·—–-]+|[\s"'“”‘’「」『』【】《》〈〉()[\]{},.;:!?。、！？：；·—–-]+$/g,
      ''
    )
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

function getCachedTranslation(key: string): CachedServerTranslation | null {
  const hit = serverlessTranslationCache.get(key);
  if (!hit) return null;
  serverlessTranslationCache.delete(key);
  serverlessTranslationCache.set(key, hit);
  return hit;
}

function setCachedTranslation(key: string, entry: CachedServerTranslation): void {
  if (serverlessTranslationCache.has(key)) {
    serverlessTranslationCache.delete(key);
  } else if (serverlessTranslationCache.size >= MAX_SERVERLESS_CACHE) {
    const oldestKey = serverlessTranslationCache.keys().next().value;
    if (oldestKey) serverlessTranslationCache.delete(oldestKey);
  }
  serverlessTranslationCache.set(key, entry);
}

function normalizeSourceLang(code?: string): string | undefined {
  if (!code || typeof code !== 'string') return undefined;
  const upper = code.trim().toUpperCase().split('-')[0];
  if (upper === 'JP') return 'JA';
  if (upper === 'CN') return 'ZH';
  return ALLOWED_SOURCE_LANGS.has(upper) ? upper : undefined;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const apiKey = process.env.DEEPL_API_KEY?.trim();

    const supabaseUrl = normalizeSupabaseUrl(
      process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
    );
    const supabaseAnonKey = (
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      ''
    )
      .trim()
      .replace(/^["']|["']$/g, '');

    if (!supabaseUrl || !supabaseAnonKey) {
      res.status(503).json({
        error: 'Configuração do Supabase ausente no servidor para validar a autenticação.',
      });
      return;
    }

    const authHeader = req.headers.authorization;
    const token =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7).trim()
        : '';

    if (!token) {
      res.status(401).json({ error: 'Autenticação necessária para traduzir com DeepL.' });
      return;
    }

    const verifier = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: userData, error: authErr } = await verifier.auth.getUser(token);
    if (authErr || !userData?.user) {
      res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
      return;
    }

    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    // The service-role credential is read only on the server and is never sent to clients.
    // Cache writes are server-owned to prevent authenticated users from poisoning shared results.
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
    const cacheWriter = serviceRoleKey
      ? createClient(supabaseUrl, serviceRoleKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        })
      : null;

    const body = (typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}) as Record<
      string,
      unknown
    >;
    const rawText = typeof body.text === 'string' ? body.text.trim() : '';
    const rawContext = typeof body.context === 'string' ? body.context.trim() : '';
    const rawTarget = typeof body.target_lang === 'string' ? body.target_lang.trim().toUpperCase() : '';
    const rawSource = typeof body.source_lang === 'string' ? body.source_lang : undefined;

    if (!rawText) {
      res.status(400).json({ error: 'Texto para tradução é obrigatório.' });
      return;
    }
    if (rawText.length > 1500) {
      res.status(400).json({ error: 'Trecho selecionado excede o limite de 1500 caracteres.' });
      return;
    }

    let targetLang = rawTarget;
    if (targetLang === 'PT') targetLang = 'PT-BR';
    if (targetLang === 'EN') targetLang = 'EN-US';

    if (!ALLOWED_TARGET_LANGS.has(targetLang)) {
      res.status(400).json({
        error: `Idioma de destino não suportado pelo DeepL: ${rawTarget || '(vazio)'}`,
      });
      return;
    }

    const sourceLang = normalizeSourceLang(rawSource);
    const normalizedTerm = normalizeCacheTerm(rawText) || rawText.toLowerCase();
    const contextKey = normalizeCacheTerm(rawContext).slice(0, 600);
    const cacheKey = `${sourceLang || 'AUTO'}::${targetLang}::${normalizedTerm}::${contextKey}`;

    const cached = getCachedTranslation(cacheKey);
    if (cached) {
      res.status(200).json({
        ...cached,
        cached: true,
      });
      return;
    }

    const { data: sharedCached, error: sharedCacheError } = await userSupabase
      .from('translation_cache')
      .select('translated_text, detected_source_language')
      .eq('source_language', sourceLang || 'AUTO')
      .eq('target_language', targetLang)
      .eq('normalized_text', normalizedTerm)
      .eq('context_key', contextKey)
      .maybeSingle();

    if (!sharedCacheError && sharedCached?.translated_text) {
      const sharedEntry: CachedServerTranslation = {
        translatedText: sharedCached.translated_text,
        detectedSourceLanguage: sharedCached.detected_source_language || sourceLang || null,
        targetLang,
      };
      setCachedTranslation(cacheKey, sharedEntry);
      res.status(200).json({ ...sharedEntry, cached: true, cacheSource: 'supabase' });
      return;
    }

    if (!apiKey) {
      res.status(503).json({
        error: 'Chave DEEPL_API_KEY não configurada nas variáveis de ambiente do servidor.',
      });
      return;
    }

    const deepLPayload: Record<string, unknown> = {
      text: [rawText],
      target_lang: targetLang,
    };

    if (sourceLang && sourceLang !== targetLang.split('-')[0]) {
      deepLPayload.source_lang = sourceLang;
    }
    if (rawContext && rawContext.length <= 3000) {
      deepLPayload.context = rawContext;
    }

    const endpoint = apiKey.endsWith(':fx')
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    const upstream = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(deepLPayload),
    });

    if (!upstream.ok) {
      if (upstream.status === 403) {
        res.status(502).json({ error: 'Chave DeepL recusada pelo serviço. Verifique DEEPL_API_KEY.' });
        return;
      }
      if (upstream.status === 456) {
        res.status(429).json({ error: 'Cota mensal da API DeepL excedida.' });
        return;
      }
      res.status(502).json({ error: `Erro ao consultar o serviço DeepL (HTTP ${upstream.status}).` });
      return;
    }

    const data = (await upstream.json()) as {
      translations?: Array<{ detected_source_language?: string; text?: string }>;
    };
    const first = data?.translations?.[0];

    if (!first?.text) {
      res.status(502).json({ error: 'Resposta vazia retornada pelo DeepL.' });
      return;
    }

    const resultEntry: CachedServerTranslation = {
      translatedText: first.text,
      detectedSourceLanguage: first.detected_source_language || sourceLang || null,
      targetLang,
    };
    setCachedTranslation(cacheKey, resultEntry);

    // Persist the translation across serverless instances and user devices.
    // Cache write failures must never turn a successful DeepL response into a failed request.
    if (cacheWriter) {
      try {
        await cacheWriter.from('translation_cache').upsert(
          {
            source_language: sourceLang || 'AUTO',
            target_language: targetLang,
            normalized_text: normalizedTerm,
            context_key: contextKey,
            original_text: rawText.slice(0, 1500),
            translated_text: first.text,
            detected_source_language: first.detected_source_language || sourceLang || null,
          },
          {
            onConflict: 'source_language,target_language,normalized_text,context_key',
            ignoreDuplicates: true,
          }
        );
      } catch {
        // Keep the successful translation response even if persistence is temporarily unavailable.
      }
    }

    res.status(200).json(resultEntry);
  } catch (err) {
    console.error('Vercel DeepL proxy error:', err instanceof Error ? err.message : 'Unknown');
    res.status(500).json({ error: 'Falha interna ao processar tradução.' });
  }
}
