import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [schemaMissing, setSchemaMissing] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const fetchOrProvisionProfile = useCallback(async (authUser: User): Promise<Profile | null> => {
    setProfileError(null);

    // 1. Lookup existing row in global public.profiles by authenticated user id
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .maybeSingle();

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

    // 2. If trigger hasn't created the profile yet (e.g. legacy account), safely upsert with ignoreDuplicates
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

    const { error: upsertError } = await supabase
      .from('profiles')
      .upsert(insertPayload, { onConflict: 'id', ignoreDuplicates: true });

    if (upsertError) {
      if (isSchemaMissingError(upsertError)) {
        setSchemaMissing(true);
      } else {
        setProfileError(upsertError.message);
      }
      return null;
    }

    // 3. Read back the canonical row
    const { data: provisioned, error: refetchError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (refetchError || !provisioned) {
      if (isSchemaMissingError(refetchError)) {
        setSchemaMissing(true);
      } else {
        setProfileError(refetchError?.message || 'Não foi possível carregar o perfil do usuário.');
      }
      return null;
    }

    const normalizedCreated = normalizeProfileRow(provisioned as Profile);
    setProfile(normalizedCreated);
    return normalizedCreated;
  }, []);

  useEffect(() => {
    let active = true;

    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      const currentSession = data.session ?? null;
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      if (currentSession?.user) {
        await fetchOrProvisionProfile(currentSession.user);
      }
      if (active) setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      if (nextSession?.user) {
        setLoading(true);
        await fetchOrProvisionProfile(nextSession.user);
      } else {
        setProfile(null);
        setSchemaMissing(false);
        setProfileError(null);
      }
      if (active) setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, [fetchOrProvisionProfile]);

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
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setUser(null);
    setSchemaMissing(false);
    setProfileError(null);
  }, []);

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
