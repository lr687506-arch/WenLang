import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AlignedWord = {
  word: string;
  start: number;
  end: number;
  start_index: number;
  end_index: number;
  paragraph_index?: number;
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);

  try {
    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) {
      return json({ error: "Autenticação necessária." }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableMap = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
    const secretMap = Deno.env.get("SUPABASE_SECRET_KEYS");
    const publishableKey = publishableMap
      ? JSON.parse(publishableMap).default
      : Deno.env.get("SUPABASE_ANON_KEY");
    const secretKey = secretMap
      ? JSON.parse(secretMap).default
      : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !publishableKey || !secretKey) {
      return json({ error: "Configuração do Supabase incompleta." }, 500);
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ error: "Sessão inválida ou expirada." }, 401);

    const body = await req.json().catch(() => ({}));
    const textId = typeof body.textId === "string" ? body.textId : "";
    if (!isUuid(textId)) return json({ error: "Identificador de texto inválido." }, 400);

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: text, error: textError } = await admin
      .from("texts")
      .select("id, author_id, content, language, audio_url, audio_timestamps")
      .eq("id", textId)
      .maybeSingle();

    if (textError || !text) return json({ error: "Texto não encontrado." }, 404);
    if (text.author_id !== authData.user.id) {
      return json({ error: "Somente o autor pode preparar a sincronização deste áudio." }, 403);
    }
    if (!text.audio_url) return json({ error: "Esta publicação ainda não possui áudio." }, 400);

    const content = String(text.content || "").trim();
    if (!content) return json({ error: "O texto está vazio." }, 400);
    if (content.length > 20000) return json({ error: "O texto ultrapassa o limite de 20.000 caracteres." }, 413);

    // Only allow media already stored in this WenLang Supabase project.
    const audioUrl = new URL(text.audio_url);
    const projectOrigin = new URL(supabaseUrl).origin;
    if (
      audioUrl.origin !== projectOrigin ||
      !audioUrl.pathname.startsWith("/storage/v1/object/public/wenlang-audios/")
    ) {
      return json({ error: "O áudio precisa estar no bucket público wenlang-audios." }, 400);
    }

    const alignmentUrl = (Deno.env.get("ALIGNMENT_SERVICE_URL") || "").trim().replace(/\/+$/, "");
    const alignmentApiKey = Deno.env.get("ALIGNMENT_SERVICE_API_KEY") || "";
    if (!alignmentUrl) {
      return json({
        error: "O serviço de alinhamento ainda não está conectado. Configure ALIGNMENT_SERVICE_URL e ALIGNMENT_SERVICE_API_KEY nos secrets do Supabase.",
        code: "ALIGNMENT_SERVICE_NOT_CONFIGURED",
      }, 503);
    }

    const response = await fetch(`${alignmentUrl}/v1/align`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(alignmentApiKey ? { Authorization: `Bearer ${alignmentApiKey}` } : {}),
      },
      body: JSON.stringify({
        audio_url: text.audio_url,
        text: content,
        language: String(text.language || "").toUpperCase(),
        word_timestamps: true,
        return_character_offsets: true,
      }),
      signal: AbortSignal.timeout(180000),
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 400);
      console.error("Alignment provider failed", response.status, detail);
      return json({ error: "O serviço de alinhamento não conseguiu processar este áudio. Tente novamente mais tarde." }, 502);
    }

    const result = await response.json().catch(() => null);
    const words: AlignedWord[] = Array.isArray(result?.words) ? result.words : [];
    if (!words.length) {
      return json({ error: "O serviço não retornou palavras alinhadas em formato válido." }, 502);
    }

    const timestamps = [];
    let previousStart = -1;
    for (let index = 0; index < words.length; index++) {
      const item = words[index];
      const start = Number(item.start);
      const end = Number(item.end);
      const startIndex = Number(item.start_index);
      const endIndex = Number(item.end_index);
      const word = String(item.word || "").trim();

      if (
        !word ||
        !Number.isFinite(start) ||
        !Number.isFinite(end) ||
        start < 0 ||
        end <= start ||
        start < previousStart ||
        !Number.isInteger(startIndex) ||
        !Number.isInteger(endIndex) ||
        startIndex < 0 ||
        endIndex <= startIndex ||
        endIndex > content.length ||
        !content.slice(startIndex, endIndex).trim()
      ) {
        return json({ error: `O alinhamento retornou dados inválidos na palavra ${index + 1}.` }, 502);
      }

      const paragraphIndex = Number.isInteger(item.paragraph_index)
        ? Number(item.paragraph_index)
        : (content.slice(0, startIndex).match(/\n+/g) || []).length;

      timestamps.push({
        paragraphIndex,
        wordIndex: index,
        word,
        startSeconds: start,
        endSeconds: end,
        startIndex,
        endIndex,
      });
      previousStart = start;
    }

    const { error: updateError } = await admin
      .from("texts")
      .update({ audio_timestamps: timestamps })
      .eq("id", textId);

    if (updateError) {
      console.error("Could not save audio timestamps", updateError.message);
      return json({ error: "O alinhamento foi calculado, mas não pôde ser salvo na publicação." }, 500);
    }

    return json({ audio_timestamps: timestamps, word_count: timestamps.length });
  } catch (error) {
    console.error("align-text-audio error", error);
    return json({ error: "Falha inesperada ao sincronizar o áudio." }, 500);
  }
});
