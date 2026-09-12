-- 人数管理を日単位から食単位（朝昼晩）へ移行。
-- 既存行は day-level servings を各 slot.servings にコピーする。

update public.meal_days
set meals = jsonb_set(
  jsonb_set(
    jsonb_set(
      meals,
      '{breakfast,servings}',
      to_jsonb(coalesce((meals->'breakfast'->>'servings')::integer, servings)),
      true
    ),
    '{lunch,servings}',
    to_jsonb(coalesce((meals->'lunch'->>'servings')::integer, servings)),
    true
  ),
  '{dinner,servings}',
  to_jsonb(coalesce((meals->'dinner'->>'servings')::integer, servings)),
  true
);

alter table public.meal_days
  alter column meals set default '{"breakfast":{"items":[],"servings":2},"lunch":{"items":[],"servings":2},"dinner":{"items":[],"servings":2}}'::jsonb;
