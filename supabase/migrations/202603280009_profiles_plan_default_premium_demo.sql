-- Opcional: alinear default y filas existentes a Premium (MVP demo).

do $block$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'profiles'
      and column_name = 'plan'
  ) then
    alter table public.profiles
      alter column plan set default 'premium'::public.user_plan;

    update public.profiles
    set plan = 'premium'::public.user_plan;
  end if;
end
$block$;
