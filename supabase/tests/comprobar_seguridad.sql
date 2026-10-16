-- =============================================================================
-- Comprobación de seguridad (RLS) de la base de datos.
--
-- Cómo usarlo en Supabase: abre SQL Editor, pega este archivo completo y pulsa
-- "Run". Todo ocurre dentro de una transacción que se deshace al final
-- (ROLLBACK): no deja datos de prueba.
--   - Si todo va bien verás "Success. No rows returned".
--   - Si algo falla verás un error que empieza por "FALLO:".
--
-- También lo ejecuta `npm run test:db` contra un PostgreSQL local.
-- =============================================================================
begin;

-- Datos de prueba (como propietario de la base de datos) ---------------------
insert into auth.users (id, email) values
  ('00000000-0000-4000-8000-00000000000a', 'usuaria-a@example.com'),
  ('00000000-0000-4000-8000-00000000000b', 'usuario-b@example.com'),
  ('00000000-0000-4000-8000-00000000000c', 'admin@example.com');

do $$
begin
  assert (select count(*) from public.profiles
          where id in ('00000000-0000-4000-8000-00000000000a',
                       '00000000-0000-4000-8000-00000000000b',
                       '00000000-0000-4000-8000-00000000000c')) = 3,
    'FALLO: no se crea el perfil automáticamente al registrarse';
end $$;

update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-00000000000c';

insert into public.characters (slug, name, age, tagline, short_bio, persona, is_active)
values ('prueba-oculto', 'Oculto', 30, 'Prueba', 'Prueba', 'Prueba', false);

insert into public.conversations (id, user_id, character_id)
select '10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', id
from public.characters where slug = 'lucia';
insert into public.conversations (id, user_id, character_id)
select '10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', id
from public.characters where slug = 'lucia';

insert into public.messages (conversation_id, user_id, role, content) values
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'user', 'Hola, soy A'),
  ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'assistant', 'Hola A'),
  ('10000000-0000-4000-8000-00000000000b', '00000000-0000-4000-8000-00000000000b', 'user', 'Hola, soy B');

-- Un mensaje no puede apuntar a la conversación de otra persona.
do $$
begin
  begin
    insert into public.messages (conversation_id, user_id, role, content)
    values ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000b', 'user', 'intruso');
    raise exception 'FALLO: se pudo asociar un mensaje a la conversación de otro usuario';
  exception when foreign_key_violation then null;
  end;
end $$;

-- Como la usuaria A -------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

do $$
declare n integer;
begin
  assert (select count(*) from public.profiles) = 1, 'FALLO: A ve perfiles de otras personas';
  assert (select count(*) from public.conversations) = 1, 'FALLO: A ve conversaciones ajenas';
  assert (select count(*) from public.messages) = 2, 'FALLO: A ve mensajes ajenos';
  assert not exists (select 1 from public.messages where content = 'Hola, soy B'),
    'FALLO: A puede leer el mensaje de B';
  assert not exists (select 1 from public.characters where slug = 'prueba-oculto'),
    'FALLO: A ve personajes no publicados';
  assert (select count(*) from public.app_settings) = 0, 'FALLO: A puede leer los ajustes';
  assert (select count(*) from public.admin_audit_log) = 0, 'FALLO: A puede leer el registro de administración';
  assert not private.is_admin(), 'FALLO: A aparece como administradora';

  -- Puede cambiar su nombre visible…
  update public.profiles set display_name = 'Ana' where id = '00000000-0000-4000-8000-00000000000a';
  get diagnostics n = row_count;
  assert n = 1, 'FALLO: A no puede editar su propio nombre';

  -- …pero no el perfil de otra persona.
  update public.profiles set display_name = 'Hackeado' where id = '00000000-0000-4000-8000-00000000000b';
  get diagnostics n = row_count;
  assert n = 0, 'FALLO: A puede editar el perfil de B';

  -- No puede ascenderse a administradora ni cambiarse de plan.
  begin
    update public.profiles set role = 'admin' where id = '00000000-0000-4000-8000-00000000000a';
    raise exception 'FALLO: A puede cambiar su rol';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set plan = 'free' where id = '00000000-0000-4000-8000-00000000000a';
    raise exception 'FALLO: A puede cambiar su plan';
  exception when insufficient_privilege then null;
  end;

  -- No puede escribir mensajes ni conversaciones directamente.
  begin
    insert into public.messages (conversation_id, user_id, role, content)
    values ('10000000-0000-4000-8000-00000000000a', '00000000-0000-4000-8000-00000000000a', 'assistant', 'falso');
    raise exception 'FALLO: A puede insertar mensajes directamente';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.messages set content = 'editado';
    raise exception 'FALLO: A puede editar mensajes';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.conversations (user_id, character_id)
    select '00000000-0000-4000-8000-00000000000a', id from public.characters where slug = 'noa';
    raise exception 'FALLO: A puede crear conversaciones directamente';
  exception when insufficient_privilege then null;
  end;

  -- No puede crear ni modificar contenido editable.
  begin
    insert into public.characters (slug, name, age, tagline, short_bio, persona)
    values ('pirata', 'Pirata', 30, 'x', 'x', 'x');
    raise exception 'FALLO: A puede crear personajes';
  exception when insufficient_privilege then null;
  end;
  update public.characters set name = 'Cambiado' where slug = 'lucia';
  get diagnostics n = row_count;
  assert n = 0, 'FALLO: A puede editar personajes';
  begin
    insert into public.site_content (key, value) values ('home.title', 'Hackeado');
    raise exception 'FALLO: A puede editar los textos de la web';
  exception when insufficient_privilege then null;
  end;
  update public.plans set daily_messages = 9999;
  get diagnostics n = row_count;
  assert n = 0, 'FALLO: A puede editar los planes';

  -- No puede borrar la conversación de B, pero sí la suya (y sus mensajes).
  delete from public.conversations where id = '10000000-0000-4000-8000-00000000000b';
  get diagnostics n = row_count;
  assert n = 0, 'FALLO: A puede borrar conversaciones de B';
end $$;

-- Como el administrador C ----------------------------------------------------------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-00000000000c","role":"authenticated"}';

do $$
declare n integer;
begin
  assert private.is_admin(), 'FALLO: C no se reconoce como administrador';
  assert exists (select 1 from public.characters where slug = 'prueba-oculto'),
    'FALLO: el administrador no ve los personajes ocultos';
  assert (select count(*) from public.profiles) >= 3, 'FALLO: el administrador no ve los perfiles';
  -- Privacidad: ni siquiera el administrador lee las conversaciones de los usuarios.
  assert (select count(*) from public.messages) = 0, 'FALLO: el administrador puede leer mensajes privados';

  update public.characters set tagline = 'Editada por admin' where slug = 'lucia';
  get diagnostics n = row_count;
  assert n = 1, 'FALLO: el administrador no puede editar personajes';
  insert into public.site_content (key, value) values ('prueba.texto', 'Hola');
  insert into public.app_settings (key, value) values ('prueba.ajuste', '{"x":1}');
  update public.plans set daily_messages = 50 where id = 'free';
  get diagnostics n = row_count;
  assert n = 1, 'FALLO: el administrador no puede editar planes';
end $$;

-- Como visitante sin sesión (anon) -----------------------------------------------
reset role;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';

do $$
begin
  assert (select count(*) from public.characters where slug = 'lucia') = 1,
    'FALLO: un visitante no ve los personajes publicados';
  assert not exists (select 1 from public.characters where slug = 'prueba-oculto'),
    'FALLO: un visitante ve personajes ocultos';
  assert (select count(*) from public.plans) >= 1, 'FALLO: un visitante no ve los planes';
  begin
    perform 1 from public.messages;
    raise exception 'FALLO: un visitante puede consultar la tabla de mensajes';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.profiles;
    raise exception 'FALLO: un visitante puede consultar los perfiles';
  exception when insufficient_privilege then null;
  end;
end $$;

-- La usuaria A borra su conversación: desaparecen también sus mensajes -----------
reset role;
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

do $$
declare n integer;
begin
  delete from public.conversations where id = '10000000-0000-4000-8000-00000000000a';
  get diagnostics n = row_count;
  assert n = 1, 'FALLO: A no puede borrar su propia conversación';
  assert (select count(*) from public.messages) = 0, 'FALLO: no se borran los mensajes de la conversación';
end $$;

reset role;

-- Límites de consumo ----------------------------------------------------------
-- Datos de consumo de A y de B (como propietario).
insert into public.usage_counters (user_id, day, messages, cost_micros) values
  ('00000000-0000-4000-8000-00000000000a', (now() at time zone 'Europe/Madrid')::date, 3, 100),
  ('00000000-0000-4000-8000-00000000000b', (now() at time zone 'Europe/Madrid')::date, 5, 200);

set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-4000-8000-00000000000a","role":"authenticated"}';

do $$
declare n integer;
begin
  assert (select count(*) from public.usage_counters) = 1, 'FALLO: A ve el consumo de otras personas';
  update public.usage_counters set messages = 0;
  get diagnostics n = row_count;
  assert false, 'FALLO: A puede editar su contador de consumo';
exception when insufficient_privilege then null;
end $$;

do $$
begin
  begin
    perform public.consume_message('00000000-0000-4000-8000-00000000000a');
    raise exception 'FALLO: un usuario puede ejecutar consume_message';
  exception when insufficient_privilege then null; end;
  begin
    perform public.record_usage('00000000-0000-4000-8000-00000000000a', 1, 1, 1);
    raise exception 'FALLO: un usuario puede ejecutar record_usage';
  exception when insufficient_privilege then null; end;
  begin
    perform public.global_cost_today();
    raise exception 'FALLO: un usuario puede ejecutar global_cost_today';
  exception when insufficient_privilege then null; end;
end $$;

reset role;
set local role anon;
set local request.jwt.claims to '{"role":"anon"}';
do $$
begin
  begin
    perform public.consume_message('00000000-0000-4000-8000-00000000000a');
    raise exception 'FALLO: un visitante puede ejecutar consume_message';
  exception when insufficient_privilege then null; end;
  begin
    perform 1 from public.usage_counters;
    raise exception 'FALLO: un visitante puede leer el consumo';
  exception when insufficient_privilege then null; end;
end $$;

-- El servidor (service_role) cuenta mensajes hasta el límite del plan y ni uno más.
reset role;
update public.plans set daily_messages = 2 where id = 'free';
delete from public.usage_counters;
set local role service_role;
do $$
declare r record;
begin
  select * into r from public.consume_message('00000000-0000-4000-8000-00000000000a');
  assert r.allowed and r.used = 1 and r.quota = 2, 'FALLO: primer mensaje del día';
  select * into r from public.consume_message('00000000-0000-4000-8000-00000000000a');
  assert r.allowed and r.used = 2, 'FALLO: segundo mensaje del día';
  select * into r from public.consume_message('00000000-0000-4000-8000-00000000000a');
  assert not r.allowed and r.used = 2 and r.quota = 2, 'FALLO: se permite pasar del límite diario';
  assert (select count(*) from public.consume_message('00000000-0000-4000-8000-00000000000a')) = 1,
    'FALLO: consume_message devuelve más de una fila al estar bloqueado';
  -- El límite de A no afecta a B.
  select * into r from public.consume_message('00000000-0000-4000-8000-00000000000b');
  assert r.allowed and r.used = 1, 'FALLO: el límite de A afecta a B';

  perform public.record_usage('00000000-0000-4000-8000-00000000000a', 1000, 50, 125);
  perform public.record_usage('00000000-0000-4000-8000-00000000000a', 500, 25, 75);
  assert (select tokens_in from public.usage_counters where user_id = '00000000-0000-4000-8000-00000000000a') = 1500, 'FALLO: suma de tokens';
  assert public.global_cost_today() = 200, 'FALLO: gasto global del día';
end $$;

reset role;
rollback;
