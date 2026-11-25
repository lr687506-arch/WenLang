-- Applied migration: index the profile interface language foreign key.
create index if not exists idx_profiles_interface_language on public.profiles(interface_language);
