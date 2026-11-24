import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

// Strict allowlists matching official DeepL API v2 language codes
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

// Simple in-memory rate limit per user (60 translation requests / minute)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }
  entry.count += 1;
  return true;
}

function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  const cleaned = (rawUrl || '').trim().replace(/^["']|["']$/g, '');
  if (!cleaned) return '';
  try {
    const parsed = new URL(cleaned);
    if (
      (parsed.hostname === 'supabase.com' || parsed.hostname === 'app.supabase.com') &&
      /\/project\/([a-z0-9]+)/i.test(parsed.pathname)
    ) {
      const match = parsed.pathname.match(/\/project\/([a-z0-9]+)/i);
      if (match?.[1]) return `https://${match[1]}.supabase.co`;
    }
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

function getSupabaseServerVerifier() {
  const url = normalizeSupabaseUrl(process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL);
  const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '')
    .trim()
    .replace(/^["']|["']$/g, '');
  if (!url || !anonKey) {
    return null;
  }
  return createClient(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function resolveDeepLEndpoint(apiKey: string): string {
  // DeepL Free API keys always end with ':fx'
  return apiKey.trim().endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';
}

function normalizeSourceLang(code?: string): string | undefined {
  if (!code || typeof code !== 'string') return undefined;
  const upper = code.trim().toUpperCase().split('-')[0];
  if (upper === 'JP') return 'JA';
  if (upper === 'CN') return 'ZH';
  return ALLOWED_SOURCE_LANGS.has(upper) ? upper : undefined;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  // Health check
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      deeplConfigured: Boolean(process.env.DEEPL_API_KEY?.trim()),
      supabaseConfigured: Boolean(
        (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL) &&
        (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY)
      ),
    });
  });

  // Expose schema.sql cleanly so users can inspect/copy it in the setup drawer
  app.get('/api/schema', async (_req: Request, res: Response) => {
    try {
      const schemaPath = path.resolve(__dirname, 'schema.sql');
      const sql = await fs.readFile(schemaPath, 'utf-8');
      res.type('text/plain; charset=utf-8').send(sql);
    } catch {
      res.status(404).json({ error: 'Arquivo schema.sql não encontrado.' });
    }
  });

  // Secure DeepL Translation Proxy
  app.post('/api/translate', async (req: Request, res: Response) => {
    try {
      const apiKey = process.env.DEEPL_API_KEY?.trim();
      if (!apiKey) {
        res.status(503).json({
          error: 'Chave DEEPL_API_KEY não configurada nas variáveis de ambiente do servidor.',
        });
        return;
      }

      // Authenticate caller using Supabase JWT access token (fail closed)
      const authHeader = req.headers.authorization;
      const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : '';
      const supabaseVerifier = getSupabaseServerVerifier();

      if (!supabaseVerifier) {
        res.status(503).json({
          error: 'Configuração do Supabase ausente no servidor para validar a autenticação.',
        });
        return;
      }

      if (!token) {
        res.status(401).json({ error: 'Autenticação necessária para traduzir com DeepL.' });
        return;
      }

      const { data: userData, error: authErr } = await supabaseVerifier.auth.getUser(token);
      if (authErr || !userData?.user) {
        res.status(401).json({ error: 'Sessão inválida ou expirada. Faça login novamente.' });
        return;
      }

      const rateKey = userData.user.id;

      if (!checkRateLimit(rateKey)) {
        res.status(429).json({
          error: 'Limite de traduções por minuto atingido. Aguarde alguns segundos.',
        });
        return;
      }

      const body = req.body as Record<string, unknown>;
      const rawText = typeof body?.text === 'string' ? body.text.trim() : '';
      const rawContext = typeof body?.context === 'string' ? body.context.trim() : '';
      const rawTarget = typeof body?.target_lang === 'string' ? body.target_lang.trim().toUpperCase() : '';
      const rawSource = typeof body?.source_lang === 'string' ? body.source_lang : undefined;

      if (!rawText) {
        res.status(400).json({ error: 'Texto para tradução é obrigatório.' });
        return;
      }
      if (rawText.length > 1500) {
        res.status(400).json({ error: 'Trecho selecionado excede o limite de 1500 caracteres.' });
        return;
      }

      // Normalize legacy short codes to DeepL target codes
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

      const endpoint = resolveDeepLEndpoint(apiKey);
      const upstream = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(deepLPayload),
      });

      if (!upstream.ok) {
        const errStatus = upstream.status;
        if (errStatus === 403) {
          res.status(502).json({ error: 'Chave DeepL recusada pelo serviço. Verifique DEEPL_API_KEY.' });
          return;
        }
        if (errStatus === 456) {
          res.status(429).json({ error: 'Cota mensal da API DeepL excedida.' });
          return;
        }
        res.status(502).json({ error: `Erro ao consultar o serviço DeepL (HTTP ${errStatus}).` });
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

      res.json({
        translatedText: first.text,
        detectedSourceLanguage: first.detected_source_language || sourceLang || null,
        targetLang,
      });
    } catch (err) {
      console.error('DeepL proxy error:', err instanceof Error ? err.message : 'Unknown error');
      res.status(500).json({ error: 'Falha interna ao processar tradução.' });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`WenLang server listening on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start WenLang server:', err);
  process.exit(1);
});
