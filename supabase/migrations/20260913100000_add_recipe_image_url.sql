-- レシピテーブルに画像URL（または最適化済み画像データURI）カラムを追加
alter table public.recipes
  add column if not exists image_url text;
