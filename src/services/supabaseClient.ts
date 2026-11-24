import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Normalizes a Supabase project URL so accidental service subpaths
 * (e.g. "/rest/v1/", "/auth/v1/", "/storage/v1/") or trailing slashes
 * are stripped down to the project base origin expected by @supabase/supabase-js.
 */
export function normalizeSupabaseUrl(rawUrl: string | undefined): string {
  const cleaned = (rawUrl || '').trim().replace(/^["']|["']$/g, '');
  if (!cleaned) return '';

  try {
    const parsed = new URL(cleaned);

    // Handle accidental Supabase dashboard URLs: https://supabase.com/dashboard/project/<ref>
    if (
      (parsed.hostname === 'supabase.com' || parsed.hostname === 'app.supabase.com') &&
      /\/project\/([a-z0-9]+)/i.test(parsed.pathname)
    ) {
      const match = parsed.pathname.match(/\/project\/([a-z0-9]+)/i);
      if (match?.[1]) {
        return `https://${match[1]}.supabase.co`;
      }
    }

    // Standard Supabase hosted domains always use the bare origin
    if (/\.(supabase\.co|supabase\.in|supabase\.net)$/i.test(parsed.hostname)) {
      return parsed.origin;
    }

    // Self-hosted / custom domains: strip accidental service suffixes and trailing slashes
    const strippedPath = parsed.pathname
      .replace(/\/(rest|auth|storage|realtime|functions|graphql)\/v1\/?.*$/i, '')
      .replace(/\/+$/, '');

    return `${parsed.origin}${strippedPath}`;
  } catch {
    return cleaned.replace(/\/+$/, '');
  }
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL as string | undefined);
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  ?.trim()
  .replace(/^["']|["']$/g, '') || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Validates that a URL uses http(s) or a safe local asset path (/src/assets/...)
 * to prevent javascript: or unsafe data: injections.
 */
export function isSafeMediaUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('/assets/') ||
    trimmed.startsWith('/heroes/')
  ) {
    return true;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function isSchemaMissingError(
  error: { code?: string; message?: string; details?: string } | null | undefined
): boolean {
  if (!error) return false;
  const code = (error.code || '').trim();
  const msg = (error.message || '').toLowerCase();
  if (code === '42P01' || code === 'PGRST205') {
    return true;
  }
  return (
    msg.includes('could not find the table') ||
    (msg.includes('relation') && msg.includes('public.') && msg.includes('does not exist'))
  );
}

const ALLOWED_AUDIO_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'm4a', 'aac']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'avif']);

export async function uploadAudioFile(file: File, userId: string): Promise<string> {
  const maxBytes = 25 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('O arquivo de áudio excede o limite máximo de 25 MB.');
  }

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_AUDIO_EXTENSIONS.has(ext)) {
    throw new Error('Formato de áudio inválido. Envie .mp3, .wav, .ogg ou .m4a.');
  }

  const objectPath = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('wenlang-audios')
    .upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) {
    throw new Error(`Falha ao enviar áudio para o Supabase Storage: ${error.message}`);
  }

  const { data } = supabase.storage.from('wenlang-audios').getPublicUrl(objectPath);
  return data.publicUrl;
}

export async function uploadCoverFile(file: File, userId: string): Promise<string> {
  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) {
    throw new Error('A imagem de capa excede o limite máximo de 5 MB.');
  }

  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
    throw new Error('Formato de imagem inválido. Envie JPG, PNG, WebP ou AVIF.');
  }

  const objectPath = `${userId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from('wenlang-covers')
    .upload(objectPath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (error) {
    throw new Error(`Falha ao enviar capa para o Supabase Storage: ${error.message}`);
  }

  const { data } = supabase.storage.from('wenlang-covers').getPublicUrl(objectPath);
  return data.publicUrl;
}
