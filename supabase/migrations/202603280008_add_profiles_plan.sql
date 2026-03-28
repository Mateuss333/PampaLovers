-- Idempotente. OJO: el nombre del tipo en pg_catalog es user_plan (sin espacios).

do $block$
begin
  if not exists (
    select 1
    from pg_catalog.pg_type t
    join pg_catalog.pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public'
      and t.typname = 'user_plan'
  ) then
    create type public.user_plan as enum ('free', 'premium', 'pro');
  end if;
end
$block$;

alter table public.profiles
  add column if not exists plan public.user_plan not null default 'premium'::public.user_plan;

alter table public.profiles
  alter column plan set default 'premium'::public.user_plan;
