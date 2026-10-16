-- =============================================================================
-- Mueve is_admin() a un esquema privado que la API de Supabase no publica.
-- Así no se puede llamar como /rest/v1/rpc/is_admin (aviso del asesor de
-- seguridad). Las políticas RLS siguen funcionando: apuntan a la función, no a
-- su nombre.
-- =============================================================================
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

alter function public.is_admin() set schema private;
