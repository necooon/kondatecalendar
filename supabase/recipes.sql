-- RecipeOps レシピ（kondatecalendar プロジェクト）
-- 材料・手順は JSONB の HEAD スナップショット。versions に味コミット履歴を持つ。
-- Supabase SQL Editor で1回実行してよい（create if not exists / add column if not exists）。

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text not null default '',
  tags jsonb not null default '[]'::jsonb,
  branch text not null default 'main',
  servings_base integer not null default 2 check (servings_base >= 1),
  pfc jsonb,
  ingredients jsonb not null default '[]'::jsonb,
  steps jsonb not null default '[]'::jsonb,
  versions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint recipes_pfc_object_chk
    check (pfc is null or jsonb_typeof(pfc) = 'object'),
  constraint recipes_ingredients_array_chk
    check (jsonb_typeof(ingredients) = 'array'),
  constraint recipes_steps_array_chk
    check (jsonb_typeof(steps) = 'array'),
  constraint recipes_tags_array_chk
    check (jsonb_typeof(tags) = 'array'),
  constraint recipes_versions_object_chk
    check (jsonb_typeof(versions) = 'object')
);

alter table public.recipes
  add column if not exists branch text not null default 'main',
  add column if not exists tags jsonb not null default '[]'::jsonb,
  add column if not exists versions jsonb not null default '{}'::jsonb;

alter table public.recipes drop constraint if exists recipes_tags_array_chk;
alter table public.recipes add constraint recipes_tags_array_chk
  check (jsonb_typeof(tags) = 'array');

alter table public.recipes drop constraint if exists recipes_versions_object_chk;
alter table public.recipes add constraint recipes_versions_object_chk
  check (jsonb_typeof(versions) = 'object');

create index if not exists recipes_created_at_idx
  on public.recipes (created_at desc);

create or replace function public.recipes_set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists recipes_set_updated_at on public.recipes;
create trigger recipes_set_updated_at
  before update on public.recipes
  for each row
  execute function public.recipes_set_updated_at();

alter table public.recipes enable row level security;

drop policy if exists "recipes_select" on public.recipes;
drop policy if exists "recipes_insert" on public.recipes;
drop policy if exists "recipes_update" on public.recipes;
drop policy if exists "recipes_delete" on public.recipes;
create policy "recipes_select" on public.recipes for select using (true);
create policy "recipes_insert" on public.recipes for insert with check (true);
create policy "recipes_update" on public.recipes for update using (true);
create policy "recipes_delete" on public.recipes for delete using (true);

grant select, insert, update, delete on table public.recipes to anon, authenticated;
grant all on table public.recipes to service_role;
