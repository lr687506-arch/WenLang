import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import type { Profile } from '../types/database';
import { supabase, isSupabaseConfigured, isSchemaMissingError } from '../services/supabaseClient';
import { normalizeTargetLanguages, normalizeToDeepLTarget } from '../constants/languages';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  schemaMissing: boolean;
  profileError: string | null;
  refreshProfile: () => Promise<Profile | null>;
  updateProfile: (patch: Partial<Profile>) => Promise<{ error: string | null; data?: Profile }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const REQUEST_TIMEOUT_MS = 10_000;

function withTimeout<T>(promise: PromiseLike<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    Promise.resolve(promise),
    new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => reject(new Error(timeoutMessage)), ms);
    }),
  ]).finally(() => {
    if (timer !== undefined) clearTimeout(timer);
  });
}

function buildFallbackUsername(user: User): string {
  const fromMeta =
    typeof user.user_metadata?.username === 'string' ? user.user_metadata.username : '';
  const fromEmail = (user.email || 'reader').split('@')[0];
  const base =
    (fromMeta || fromEmail)
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, '')
      .slice(0, 18) || 'reader';
  return `${base}_${user.id.replace(/-/g, '').slice(0, 6)}`;
}

function normalizeProfileRow(row: Profile): Profile {
  return {
    ...row,
    native_language: normalizeToDeepLTarget(row.native_language || 'PT-BR'),
    target_languages: normalizeTargetLanguages(row.target_languages),
    onboarding_completed: Boolean(row.onboarding_completed),
    xp_points: typeof row.xp_points === 'number' ? row.xp_points : 0,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [profileResolvedForUserId, setProfileResolvedForUserId] = useState<string | null>(null);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const fetchSeqRef = useRef(0);

  const fetchOrProvisionProfile = useCallback(async (authUser: User): Promise<Profile | null> => {
    const seq = ++fetchSeqRef.current;
    setProfileError(null);

    try {
      // 1. Lookup existing row in global public.profiles by authenticated user id
      const { data, error } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', authUser.id).maybeSingle(),
        REQUEST_TIMEOUT_MS,
        'Tempo limite excedido ao conectar com o banco de dados Supabase.'
      );

      if (fetchSeqRef.current !== seq) return null;

      if (error) {
        if (isSchemaMissingError(error)) {
          setSchemaMissing(true);
        } else {
          setSchemaMissing(false);
          setProfileError(error.message);
        }
        return null;
      }

      setSchemaMissing(false);

      if (data) {
        const normalized = normalizeProfileRow(data as Profile);
        setProfile(normalized);
        return normalized;
      }

      // 2. If trigger hasn't created the profile yet, safely upsert with ignoreDuplicates
      const insertPayload = {
        id: authUser.id,
        username: buildFallbackUsername(authUser),
        full_name:
          typeof authUser.user_metadata?.full_name === 'string'
            ? authUser.user_metadata.full_name.trim() || null
            : null,
        native_language: 'PT-BR',
        target_languages: [] as string[],
        onboarding_completed: false,
        xp_points: 0,
      };

      const { error: upsertError } = await withTimeout(
        supabase.from('profiles').upsert(insertPayload, {
          onConflict: 'id',
          ignoreDuplicates: true,
        }),
        REQUEST_TIMEOUT_MS,
        'Tempo limite excedido ao inicializar seu perfil.'
      );

      if (fetchSeqRef.current !== seq) return null;

      if (upsertError) {
        if (isSchemaMissingError(upsertError)) {
          setSchemaMissing(true);
        } else {
          setProfileError(upsertError.message);
        }
        return null;
      }

      // 3. Read back the canonical row
      const { data: provisioned, error: refetchError } = await withTimeout(
        supabase.from('profiles').select('*').eq('id', authUser.id).single(),
        REQUEST_TIMEOUT_MS,
        'Tempo limite excedido ao carregar seu perfil.'
      );

      if (fetchSeqRef.current !== seq) return null;

      if (refetchError || !provisioned) {
        if (isSchemaMissingError(refetchError)) {
          setSchemaMissing(true);
        } else {
          setProfileError(
            refetchError?.message || 'Não foi possível carregar o perfil do usuário.'
          );
        }
        return null;
      }

      const normalizedCreated = normalizeProfileRow(provisioned as Profile);
      setProfile(normalizedCreated);
      return normalizedCreated;
    } catch (err) {
      if (fetchSeqRef.current !== seq) return null;
      setProfileError(
        err instanceof Error ? err.message : 'Erro inesperado ao carregar seu perfil.'
      );
      return null;
    } finally {
      if (fetchSeqRef.current === seq) {
        setProfileResolvedForUserId(authUser.id);
      }
    }
  }, []);

  // Effect 1: Auth session initialization & listener.
  // CRITICAL: Keep onAuthStateChange 100% synchronous (never await Supabase queries inside it)
  // to avoid the @supabase/supabase-js v2 navigator.locks deadlock.
  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return;
    }

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (!nextSession?.user) {
        setProfile(null);
        setSchemaMissing(false);
        setProfileError(null);
        setProfileResolvedForUserId(null);
      }
      setAuthReady(true);
    });

    withTimeout(
      supabase.auth.getSession(),
      REQUEST_TIMEOUT_MS,
      'Tempo limite excedido ao verificar sua sessão.'
    )
      .then(({ data }) => {
        if (!active) return;
        const currentSession = data?.session ?? null;
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
      })
      .catch(() => {
        if (!active) return;
        setSession(null);
        setUser(null);
      })
      .finally(() => {
        if (active) setAuthReady(true);
      });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // Effect 2: Load or provision profile OUTSIDE the auth lock whenever the authenticated user changes.
  useEffect(() => {
    if (!authReady) return;
    if (!user) {
      setProfile(null);
      setProfileResolvedForUserId(null);
      return;
    }

    void fetchOrProvisionProfile(user);
  }, [authReady, user?.id, fetchOrProvisionProfile]);

  const refreshProfile = useCallback(async () => {
    if (!user) return null;
    return fetchOrProvisionProfile(user);
  }, [user, fetchOrProvisionProfile]);

  const updateProfile = useCallback(
    async (patch: Partial<Profile>): Promise<{ error: string | null; data?: Profile }> => {
      if (!user) return { error: 'Usuário não autenticado.' };

      const normalizedPatch: Partial<Profile> = { ...patch };
      if (typeof normalizedPatch.native_language === 'string') {
        normalizedPatch.native_language = normalizeToDeepLTarget(normalizedPatch.native_language);
      }
      if (Array.isArray(normalizedPatch.target_languages)) {
        normalizedPatch.target_languages = normalizeTargetLanguages(
          normalizedPatch.target_languages
        );
      }

      const { data, error } = await supabase
        .from('profiles')
        .update(normalizedPatch)
        .eq('id', user.id)
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          return { error: 'Este nome de usuário já está em uso. Escolha outro.' };
        }
        return { error: error.message };
      }

      const normalized = normalizeProfileRow(data as Profile);
      setProfile(normalized);
      return { error: null, data: normalized };
    },
    [user]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut().catch(() => {});
    setProfile(null);
    setSession(null);
    setUser(null);
    setSchemaMissing(false);
    setProfileError(null);
    setProfileResolvedForUserId(null);
  }, []);

  const loading = !authReady || (Boolean(user) && profileResolvedForUserId !== user?.id);

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        profile,
        loading,
        schemaMissing,
        profileError,
        refreshProfile,
        updateProfile,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
