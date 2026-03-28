create type public.user_plan as enum ('free', 'premium', 'pro');

alter table public.profiles
  add column plan public.user_plan not null default 'free';
