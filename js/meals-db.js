window.KitchenGit = window.KitchenGit || {};

/**
 * DB JSONB の正（types/supabase.ts の meal_days.Row と対応）:
 * - meals: { breakfast|lunch|dinner: { items: { title, recipe_id }[] } }
 * - pfc: { p, f, c } | null
 *
 * UI は camelCase（recipeId / tagColor / isBusinessTrip）。
 *
 * @typedef {object} MealDayItem
 * @property {string} title
 * @property {string | null} recipeId
 *
 * @typedef {object} MealDay
 * @property {string} [id]
 * @property {string} date
 * @property {string} [day]
 * @property {string} tag
 * @property {string} tagColor
 * @property {number} servings
 * @property {boolean} isBusinessTrip
 * @property {{ p: number, f: number, c: number } | null} pfc
 * @property {{ breakfast: { items: MealDayItem[] }, lunch: { items: MealDayItem[] }, dinner: { items: MealDayItem[] } }} meals
 */

KitchenGit.demoMealDays = function demoMealDays() {
  return [
    {
      tag: '定番ルーティン', tagColor: 'blue', servings: 2, isBusinessTrip: false, pfc: { p: 34, f: 12, c: 40 },
      meals: {
        breakfast: { title: 'ヨーグルトとバナナ' },
        lunch: { title: 'ほうれん草ナムル弁当' },
        dinner: { title: '焼き鮭とキノコのホイル焼き' }
      }
    },
    {
      tag: '最新 v1.2', tagColor: 'purple', servings: 2, isBusinessTrip: false, pfc: { p: 38, f: 8, c: 42 },
      meals: {
        breakfast: { title: '納豆ごはん' },
        lunch: { title: 'ハーブサラダチキン弁当' },
        dinner: { title: '鶏むね肉と秋茄子のさっぱり炒め' }
      }
    },
    {
      tag: '出張 1人分', tagColor: 'amber', servings: 1, isBusinessTrip: true, pfc: { p: 32, f: 9, c: 35 },
      meals: {
        breakfast: { title: 'ホテル朝食' },
        lunch: { title: 'サラダチキン弁当（出張）' },
        dinner: { title: '豚ヒレと豆腐のスタミナ炒め' }
      }
    },
    {
      tag: '出張 1人分', tagColor: 'amber', servings: 1, isBusinessTrip: true, pfc: { p: 29, f: 14, c: 30 },
      meals: {
        breakfast: { title: 'ホテル朝食' },
        lunch: { title: '鶏むねそぼろ弁当' },
        dinner: {
          items: [
            { title: '秋刀魚の塩焼き' },
            { title: '具だくさん豚汁' }
          ]
        }
      }
    },
    {
      tag: '2週に1回', tagColor: 'emerald', servings: 2, isBusinessTrip: false, pfc: { p: 36, f: 11, c: 65 },
      meals: {
        breakfast: { title: '納豆ごはん' },
        lunch: { title: 'ナムルとサラダチキン' },
        dinner: { title: '特製スパイスキーマカレー' }
      }
    },
    {
      tag: '空き枠', tagColor: 'slate', servings: 2, isBusinessTrip: false, pfc: null,
      meals: {
        breakfast: { title: 'ホットケーキ' },
        lunch: { title: '残りキーマカレー' },
        dinner: { title: '' }
      }
    },
    {
      tag: '作り置き', tagColor: 'rose', servings: 2, isBusinessTrip: false, pfc: { p: 40, f: 10, c: 45 },
      meals: {
        breakfast: { title: 'トーストと卵' },
        lunch: { title: '作り置き仕込みの軽食' },
        dinner: { title: '週末作り置き ＆ 軽食' }
      }
    }
  ];
};

KitchenGit.MealsDB = (function () {
  let client = null;
  const Meals = () => KitchenGit.Meals;
  const Week = () => KitchenGit.Week;

  function throwIfError(error) {
    if (error) throw error;
  }

  function init() {
    const cfg = KitchenGit.SUPABASE_CONFIG;
    if (typeof supabase === 'undefined' || !supabase.createClient || !cfg) {
      client = null;
      return false;
    }
    try {
      client = supabase.createClient(cfg.url, cfg.anonKey);
      return true;
    } catch (e) {
      console.error('Supabase meals init failed', e);
      client = null;
      return false;
    }
  }

  function isReady() {
    return !!client;
  }

  function isoDate(value) {
    if (!value) return '';
    return String(value).slice(0, 10);
  }

  function mealsToDb(meals) {
    const M = Meals();
    const out = M.emptyMeals();
    M.MEAL_SLOTS.forEach((meta) => {
      out[meta.key] = {
        items: M.mealItems(meals && meals[meta.key]).map((item) => ({
          title: item.title,
          recipe_id: item.recipeId || null
        }))
      };
    });
    return out;
  }

  function mealsFromDb(raw) {
    const M = Meals();
    const out = M.emptyMeals();
    M.MEAL_SLOTS.forEach((meta) => {
      out[meta.key] = {
        items: M.mealItems(raw && raw[meta.key]).map((item) => ({
          title: item.title,
          recipeId: item.recipeId || null
        }))
      };
    });
    return out;
  }

  function snapshotPayload(dayData) {
    return {
      date: isoDate(dayData.date),
      servings: Number(dayData.servings) > 0 ? Number(dayData.servings) : 2,
      is_business_trip: !!dayData.isBusinessTrip,
      tag: dayData.tag || '',
      tag_color: dayData.tagColor || 'slate',
      pfc: dayData.pfc || null,
      meals: mealsToDb(dayData.meals)
    };
  }

  function mapRow(row) {
    const W = Week();
    const date = isoDate(row.date);
    return {
      id: row.id,
      date,
      day: W.WEEKDAYS[W.weekdayIndex(date)] || '',
      tag: row.tag || '',
      tagColor: row.tag_color || 'slate',
      servings: row.servings || 2,
      isBusinessTrip: !!row.is_business_trip,
      pfc: row.pfc || null,
      meals: mealsFromDb(row.meals)
    };
  }

  async function fetchRange(weekStart) {
    if (!client) throw new Error('cloud-not-ready');
    const W = Week();
    const start = isoDate(weekStart);
    const end = W.toIsoDate(W.addDays(start, 6));
    const { data, error } = await client
      .from('meal_days')
      .select('*')
      .gte('date', start)
      .lte('date', end)
      .order('date', { ascending: true });
    throwIfError(error);
    return (data || []).map(mapRow);
  }

  async function upsertDay(dayData) {
    if (!client) throw new Error('cloud-not-ready');
    if (!dayData || !dayData.date) throw new Error('missing-date');
    const { data, error } = await client
      .from('meal_days')
      .upsert(snapshotPayload(dayData), { onConflict: 'date' })
      .select()
      .single();
    throwIfError(error);
    return mapRow(data);
  }

  async function seedIfEmpty() {
    if (!client) throw new Error('cloud-not-ready');
    const { data, error } = await client
      .from('meal_days')
      .select('id')
      .limit(1);
    throwIfError(error);
    if (data && data.length) return;
    const W = Week();
    const weekStart = W.toIsoDate(W.startOfWeekMonday(new Date()));
    const days = W.applyTemplateToWeek(weekStart, KitchenGit.demoMealDays());
    const seeded = [];
    for (const day of days) {
      seeded.push(await upsertDay(day));
    }
    return seeded;
  }

  return { init, isReady, fetchRange, upsertDay, seedIfEmpty, mapRow };
})();
