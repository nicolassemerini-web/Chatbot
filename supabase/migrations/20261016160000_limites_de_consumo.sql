-- =============================================================================
-- Límites de consumo: contador diario por usuario y registro del gasto estimado.
--
-- - usage_counters guarda, por usuario y día (hora de Madrid), los mensajes, los
--   tokens y el coste estimado en micro-dólares (1 céntimo = 10.000 micro-dólares).
-- - Solo el servidor (service_role) puede escribirlas. El usuario puede leer las suyas.
-- - consume_message() es atómica: dos peticiones simultáneas no pueden pasar del límite.
-- - El límite diario sale del plan del usuario (tabla plans), editable desde el panel.
-- =============================================================================

create table public.usage_counters (
  user_id uuid not null references auth.users (id) on delete cascade,
  day date not null,
  messages integer not null default 0 check (messages >= 0),
  tokens_in bigint not null default 0 check (tokens_in >= 0),
  tokens_out bigint not null default 0 check (tokens_out >= 0),
  cost_micros bigint not null default 0 check (cost_micros >= 0),
  primary key (user_id, day)
);

create index usage_counters_day_idx on public.usage_counters (day);

alter table public.usage_counters enable row level security;

create policy "ver el consumo propio" on public.usage_counters
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.usage_counters from anon;
revoke insert, update, delete on public.usage_counters from authenticated;

-- Cuenta un mensaje del día si no se supera el límite del plan.
create function public.consume_message(p_user uuid)
returns table (allowed boolean, used integer, quota integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_day date := (now() at time zone 'Europe/Madrid')::date;
  v_quota integer;
  v_used integer;
begin
  select pl.daily_messages into v_quota
  from public.profiles p
  join public.plans pl on pl.id = p.plan
  where p.id = p_user;

  if v_quota is null then
    v_quota := 0;
  end if;

  insert into public.usage_counters (user_id, day)
  values (p_user, v_day)
  on conflict (user_id, day) do nothing;

  update public.usage_counters c
  set messages = c.messages + 1
  where c.user_id = p_user and c.day = v_day and c.messages < v_quota
  returning c.messages into v_used;

  if v_used is null then
    select c.messages into v_used
    from public.usage_counters c
    where c.user_id = p_user and c.day = v_day;
    return query select false, coalesce(v_used, 0), v_quota;
    return;
  end if;

  return query select true, v_used, v_quota;
end;
$$;

-- Suma los tokens y el coste estimado de una respuesta.
create function public.record_usage(
  p_user uuid, p_tokens_in integer, p_tokens_out integer, p_cost_micros bigint
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.usage_counters as c (user_id, day, tokens_in, tokens_out, cost_micros)
  values (
    p_user, (now() at time zone 'Europe/Madrid')::date,
    greatest(p_tokens_in, 0), greatest(p_tokens_out, 0), greatest(p_cost_micros, 0)
  )
  on conflict (user_id, day) do update set
    tokens_in = c.tokens_in + excluded.tokens_in,
    tokens_out = c.tokens_out + excluded.tokens_out,
    cost_micros = c.cost_micros + excluded.cost_micros;
$$;

-- Gasto estimado de todos los usuarios hoy (freno global de emergencia).
create function public.global_cost_today()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(cost_micros), 0)::bigint
  from public.usage_counters
  where day = (now() at time zone 'Europe/Madrid')::date;
$$;

-- Solo el servidor puede llamarlas (ni visitantes ni usuarios con sesión).
revoke execute on function public.consume_message(uuid) from public, anon, authenticated;
revoke execute on function public.record_usage(uuid, integer, integer, bigint) from public, anon, authenticated;
revoke execute on function public.global_cost_today() from public, anon, authenticated;
grant execute on function public.consume_message(uuid) to service_role;
grant execute on function public.record_usage(uuid, integer, integer, bigint) to service_role;
grant execute on function public.global_cost_today() to service_role;
