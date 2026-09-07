-- KitchenGit レシピ（既存 Check＆Stock プロジェクトへ増分追加）
-- Supabase SQL Editor で1回実行。全文の setup.sql は再実行しない。

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  tag text not null default '',
  servings_base integer not null default 2,
  pfc jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recipe_versions (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  version_key text not null,
  title text not null default '',
  rating text not null default '★4.0',
  message text not null default '',
  note text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  unique (recipe_id, version_key)
);
create index if not exists recipe_versions_recipe_id_idx on public.recipe_versions (recipe_id, sort_order desc);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.recipe_versions(id) on delete cascade,
  name text not null,
  base_amount numeric not null default 0,
  unit text not null default 'g',
  note text not null default '',
  sort_order integer not null default 0
);
create index if not exists recipe_ingredients_version_id_idx on public.recipe_ingredients (version_id, sort_order);

create table if not exists public.recipe_steps (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.recipe_versions(id) on delete cascade,
  instruction text not null,
  timer_seconds integer,
  sort_order integer not null default 0
);
create index if not exists recipe_steps_version_id_idx on public.recipe_steps (version_id, sort_order);

alter table public.recipes enable row level security;
alter table public.recipe_versions enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.recipe_steps enable row level security;

drop policy if exists "recipes_select" on public.recipes;
drop policy if exists "recipes_insert" on public.recipes;
drop policy if exists "recipes_update" on public.recipes;
drop policy if exists "recipes_delete" on public.recipes;
create policy "recipes_select" on public.recipes for select using (true);
create policy "recipes_insert" on public.recipes for insert with check (true);
create policy "recipes_update" on public.recipes for update using (true);
create policy "recipes_delete" on public.recipes for delete using (true);

drop policy if exists "recipe_versions_select" on public.recipe_versions;
drop policy if exists "recipe_versions_insert" on public.recipe_versions;
drop policy if exists "recipe_versions_update" on public.recipe_versions;
drop policy if exists "recipe_versions_delete" on public.recipe_versions;
create policy "recipe_versions_select" on public.recipe_versions for select using (true);
create policy "recipe_versions_insert" on public.recipe_versions for insert with check (true);
create policy "recipe_versions_update" on public.recipe_versions for update using (true);
create policy "recipe_versions_delete" on public.recipe_versions for delete using (true);

drop policy if exists "recipe_ingredients_select" on public.recipe_ingredients;
drop policy if exists "recipe_ingredients_insert" on public.recipe_ingredients;
drop policy if exists "recipe_ingredients_update" on public.recipe_ingredients;
drop policy if exists "recipe_ingredients_delete" on public.recipe_ingredients;
create policy "recipe_ingredients_select" on public.recipe_ingredients for select using (true);
create policy "recipe_ingredients_insert" on public.recipe_ingredients for insert with check (true);
create policy "recipe_ingredients_update" on public.recipe_ingredients for update using (true);
create policy "recipe_ingredients_delete" on public.recipe_ingredients for delete using (true);

drop policy if exists "recipe_steps_select" on public.recipe_steps;
drop policy if exists "recipe_steps_insert" on public.recipe_steps;
drop policy if exists "recipe_steps_update" on public.recipe_steps;
drop policy if exists "recipe_steps_delete" on public.recipe_steps;
create policy "recipe_steps_select" on public.recipe_steps for select using (true);
create policy "recipe_steps_insert" on public.recipe_steps for insert with check (true);
create policy "recipe_steps_update" on public.recipe_steps for update using (true);
create policy "recipe_steps_delete" on public.recipe_steps for delete using (true);

do $$ begin alter publication supabase_realtime add table public.recipes; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.recipe_versions; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.recipe_ingredients; exception when duplicate_object then null; end $$;
do $$ begin alter publication supabase_realtime add table public.recipe_steps; exception when duplicate_object then null; end $$;
