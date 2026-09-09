-- 味バージョン履歴（コミットマップ）と作業ブランチ・ハッシュタグ。
-- ingredients / steps / pfc は HEAD スナップショットのまま残す。

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
