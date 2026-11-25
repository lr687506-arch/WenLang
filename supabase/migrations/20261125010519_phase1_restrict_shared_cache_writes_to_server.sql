-- Shared translation results are written only by the trusted server using a
-- server-only Supabase service-role credential. Browser clients remain read-only.
drop policy if exists "Authenticated users can insert translation cache" on public.translation_cache;
revoke insert on public.translation_cache from anon, authenticated;
grant select on public.translation_cache to authenticated;
