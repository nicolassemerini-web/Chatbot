-- =============================================================================
-- Esquema inicial: perfiles, planes, personajes, contenido editable,
-- conversaciones y mensajes, con seguridad por filas (RLS) en todas las tablas.
--
-- Principios:
-- - Cada usuario solo puede leer sus propios datos (auth.uid()).
-- - El contenido editable (personajes, textos, planes, ajustes) solo lo
--   modifican los administradores (profiles.role = 'admin').
-- - Los mensajes, el plan y el rol nunca se escriben desde el navegador: los
--   escribe el servidor con la clave secreta (service_role), que salta RLS.
-- =============================================================================

-- Utilidad: mantener updated_at al día ----------------------------------------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Planes ------------------------------------------------------------------------
create table public.plans (
  id text primary key check (id ~ '^[a-z0-9_-]{1,32}$'),
  name text not null check (char_length(name) between 1 and 60),
  daily_messages integer not null check (daily_messages >= 0),
  max_output_tokens integer not null check (max_output_tokens between 50 and 4000),
  model text check (model is null or char_length(model) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger plans_updated_at before update on public.plans
  for each row execute function public.set_updated_at();

insert into public.plans (id, name, daily_messages, max_output_tokens)
values ('free', 'Gratuito', 30, 400);

-- Perfiles ------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) between 1 and 40),
  adult_confirmed_at timestamptz,
  terms_accepted_at timestamptz,
  plan text not null default 'free' references public.plans (id),
  role text not null default 'user' check (role in ('user', 'admin')),
  initiative_enabled boolean not null default true,
  created_at timestamptz not null default now()
);

-- Crea el perfil automáticamente al registrarse un usuario.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ¿El usuario actual es administrador? (security definer para no depender de
-- las políticas de profiles y evitar recursión).
create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
$$;

revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated, service_role;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Personajes ------------------------------------------------------------------------
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{1,40}$'),
  name text not null check (char_length(name) between 1 and 40),
  age integer not null check (age between 18 and 120),
  tagline text not null check (char_length(tagline) between 1 and 120),
  short_bio text not null check (char_length(short_bio) between 1 and 400),
  interests text[] not null default '{}' check (cardinality(interests) <= 12),
  accent text not null default 'rose'
    check (accent in ('amber', 'sky', 'emerald', 'rose', 'violet', 'slate')),
  persona text not null check (char_length(persona) between 1 and 4000),
  style_rules text[] not null default '{}' check (cardinality(style_rules) <= 20),
  boundaries text[] not null default '{}' check (cardinality(boundaries) <= 20),
  initiative_level text not null default 'medium'
    check (initiative_level in ('low', 'medium', 'high')),
  prompt_version integer not null default 1 check (prompt_version >= 1),
  model text check (model is null or char_length(model) <= 100),
  avatar_url text check (avatar_url is null or avatar_url ~ '^https://'),
  mock_greeting text not null default '' check (char_length(mock_greeting) <= 500),
  mock_replies text[] not null default '{}' check (cardinality(mock_replies) <= 20),
  is_active boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger characters_updated_at before update on public.characters
  for each row execute function public.set_updated_at();

-- Historial de versiones de cada ficha (para deshacer cambios desde el panel).
create table public.character_versions (
  id bigint generated always as identity primary key,
  character_id uuid not null references public.characters (id) on delete cascade,
  version integer not null,
  data jsonb not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (character_id, version)
);

-- Contenido editable ----------------------------------------------------------------
create table public.site_content (
  key text primary key check (key ~ '^[a-z0-9_.-]{1,80}$'),
  value text not null check (char_length(value) <= 20000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create trigger site_content_updated_at before update on public.site_content
  for each row execute function public.set_updated_at();

create table public.app_settings (
  key text primary key check (key ~ '^[a-z0-9_.-]{1,80}$'),
  value jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null
);

create trigger app_settings_updated_at before update on public.app_settings
  for each row execute function public.set_updated_at();

create table public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users (id) on delete set null,
  entity text not null,
  entity_id text,
  before jsonb,
  after jsonb,
  created_at timestamptz not null default now()
);

-- Conversaciones y mensajes ----------------------------------------------------------
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  character_id uuid not null references public.characters (id) on delete cascade,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now(),
  unique (user_id, character_id),
  -- Permite que messages garantice que su user_id coincide con el de la conversación.
  unique (id, user_id)
);

create table public.messages (
  id bigint generated always as identity primary key,
  conversation_id uuid not null,
  user_id uuid not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 8000),
  created_at timestamptz not null default now(),
  foreign key (conversation_id, user_id)
    references public.conversations (id, user_id) on delete cascade
);

create index messages_conversation_idx on public.messages (conversation_id, id);
create index conversations_user_idx on public.conversations (user_id, last_message_at desc);

-- =============================================================================
-- Seguridad por filas (RLS)
-- =============================================================================
alter table public.plans enable row level security;
alter table public.profiles enable row level security;
alter table public.characters enable row level security;
alter table public.character_versions enable row level security;
alter table public.site_content enable row level security;
alter table public.app_settings enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- Planes: lectura pública; escritura solo administradores.
create policy "planes visibles para todos" on public.plans
  for select to anon, authenticated using (true);
create policy "planes editables por administradores" on public.plans
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Perfiles: cada usuario ve y edita el suyo; los administradores ven todos.
create policy "ver el perfil propio" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "editar el perfil propio" on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- El usuario solo puede cambiar estas columnas; plan y rol, nunca.
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name, adult_confirmed_at, terms_accepted_at, initiative_enabled)
  on public.profiles to authenticated;

-- Personajes: se ven los publicados; los administradores ven y editan todos.
create policy "personajes publicados visibles" on public.characters
  for select to anon, authenticated
  using (is_active or (select public.is_admin()));
create policy "personajes editables por administradores" on public.characters
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

create policy "versiones solo administradores" on public.character_versions
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Textos de la web: lectura pública; escritura solo administradores.
create policy "textos visibles para todos" on public.site_content
  for select to anon, authenticated using (true);
create policy "textos editables por administradores" on public.site_content
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- Ajustes y registro: solo administradores (el servidor usa la clave secreta).
create policy "ajustes solo administradores" on public.app_settings
  for all to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "registro visible para administradores" on public.admin_audit_log
  for select to authenticated using ((select public.is_admin()));
revoke insert, update, delete on public.admin_audit_log from anon, authenticated;

-- Conversaciones: el usuario ve y borra las suyas; las crea el servidor.
create policy "ver conversaciones propias" on public.conversations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "borrar conversaciones propias" on public.conversations
  for delete to authenticated using (user_id = (select auth.uid()));
revoke insert, update on public.conversations from anon, authenticated;

-- Mensajes: el usuario lee los suyos; solo el servidor los escribe.
create policy "ver mensajes propios" on public.messages
  for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete on public.messages from anon, authenticated;

-- Los usuarios anónimos no tienen nada que hacer con datos personales.
revoke all on public.profiles, public.conversations, public.messages,
  public.character_versions, public.app_settings, public.admin_audit_log from anon;
