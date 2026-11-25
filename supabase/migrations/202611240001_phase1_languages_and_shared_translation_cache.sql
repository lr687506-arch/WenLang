-- WenLang Phase 1: canonical language catalog and persistent shared translation cache.
-- Additive and idempotent; existing user/content rows are preserved.
create table if not exists public.languages (
  code text primary key,
  source_code text not null,
  deepl_target_code text not null unique,
  name text not null,
  native_name text not null,
  is_active boolean not null default true,
  sort_order smallint not null default 100,
  created_at timestamptz not null default now(),
  constraint languages_code_format check (code = upper(code) and length(code) between 2 and 5),
  constraint languages_source_code_format check (source_code = upper(source_code) and length(source_code) between 2 and 5)
);
insert into public.languages (code,source_code,deepl_target_code,name,native_name,sort_order) values
('PT-BR','PT','PT-BR','Portuguese (Brazil)','Português',1),
('EN-US','EN','EN-US','English (United States)','English',2),
('ES','ES','ES','Spanish','Español',3),
('JA','JA','JA','Japanese','日本語',4),
('ZH','ZH','ZH','Chinese','中文',5),
('ID','ID','ID','Indonesian','Bahasa Indonesia',6),
('FR','FR','FR','French','Français',7),
('DE','DE','DE','German','Deutsch',8),
('KO','KO','KO','Korean','한국어',9),
('IT','IT','IT','Italian','Italiano',10)
on conflict (code) do update set source_code=excluded.source_code, deepl_target_code=excluded.deepl_target_code, name=excluded.name, native_name=excluded.native_name, is_active=excluded.is_active, sort_order=excluded.sort_order;

alter table public.profiles add column if not exists interface_language text;
update public.profiles
set interface_language = case
  when exists (select 1 from public.languages l where l.code = profiles.native_language) then profiles.native_language
  when profiles.native_language = 'PT' then 'PT-BR'
  when profiles.native_language = 'EN' then 'EN-US'
  else 'PT-BR'
end
where interface_language is null;
alter table public.profiles alter column interface_language set default 'PT-BR', alter column interface_language set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname='profiles_interface_language_fkey' and conrelid='public.profiles'::regclass) then
    alter table public.profiles add constraint profiles_interface_language_fkey
      foreign key (interface_language) references public.languages(code) on update cascade on delete restrict;
  end if;
end $$;

create index if not exists idx_languages_active_sort on public.languages(sort_order,name) where is_active=true;

create table if not exists public.translation_cache (
  id uuid primary key default gen_random_uuid(),
  source_language text not null,
  target_language text not null,
  normalized_text text not null,
  context_key text not null default '',
  original_text text not null,
  translated_text text not null,
  detected_source_language text,
  created_at timestamptz not null default now(),
  constraint uq_translation_cache_lookup unique (source_language,target_language,normalized_text,context_key),
  constraint chk_translation_cache_text_lengths check (
    length(trim(normalized_text)) between 1 and 500
    and length(trim(original_text)) between 1 and 1500
    and length(trim(translated_text)) between 1 and 10000
    and length(context_key) <= 600
  )
);
create index if not exists idx_translation_cache_lookup on public.translation_cache(source_language,target_language,normalized_text,context_key);
alter table public.translation_cache enable row level security;
alter table public.languages enable row level security;

drop policy if exists "Authenticated users can read active languages" on public.languages;
create policy "Authenticated users can read active languages" on public.languages for select to authenticated using (is_active=true);
drop policy if exists "Authenticated users can read translation cache" on public.translation_cache;
create policy "Authenticated users can read translation cache" on public.translation_cache for select to authenticated using (true);
drop policy if exists "Authenticated users can insert translation cache" on public.translation_cache;
revoke all on public.languages from anon,authenticated;
grant select on public.languages to authenticated;
revoke all on public.translation_cache from anon,authenticated;
grant select on public.translation_cache to authenticated;
notify pgrst,'reload schema';

create index if not exists idx_profiles_interface_language on public.profiles(interface_language);
