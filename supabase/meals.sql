-- RecipeOps 献立（kondatecalendar プロジェクト）
-- 1日1行。朝昼晩の料理は meals JSONB（items[].title / recipe_id、servings、kind、memo、memo_tag）。
-- Supabase SQL Editor で1回実行してよい（create if not exists）。

create table if not exists public.meal_days (
  id uuid primary key default gen_random_uuid(),
  date date not null unique,
  servings integer not null default 2 check (servings >= 1),
  is_business_trip boolean not null default false,
  tag text not null default '',
  tag_color text not null default 'slate',
  pfc jsonb,
  meals jsonb not null default '{"breakfast":{"items":[],"servings":2},"lunch":{"items":[],"servings":2},"dinner":{"items":[],"servings":2}}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_days_pfc_object_chk
    check (pfc is null or jsonb_typeof(pfc) = 'object'),
  constraint meal_days_meals_object_chk
    check (jsonb_typeof(meals) = 'object')
);

create or replace function public.meal_days_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists meal_days_set_updated_at on public.meal_days;
create trigger meal_days_set_updated_at
  before update on public.meal_days
  for each row
  execute function public.meal_days_set_updated_at();

alter table public.meal_days enable row level security;

drop policy if exists "meal_days_select" on public.meal_days;
drop policy if exists "meal_days_insert" on public.meal_days;
drop policy if exists "meal_days_update" on public.meal_days;
drop policy if exists "meal_days_delete" on public.meal_days;
create policy "meal_days_select" on public.meal_days for select using (true);
create policy "meal_days_insert" on public.meal_days for insert with check (true);
create policy "meal_days_update" on public.meal_days for update using (true);
create policy "meal_days_delete" on public.meal_days for delete using (true);

grant select, insert, update, delete on table public.meal_days to anon, authenticated;
grant all on table public.meal_days to service_role;
