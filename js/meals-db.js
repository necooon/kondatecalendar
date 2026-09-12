window.KitchenGit = window.KitchenGit || {};

/**
 * DB JSONB の正（types/supabase.ts の meal_days.Row と対応）:
 * - meals: { breakfast|lunch|dinner: { items: { title, recipe_id }[], servings: number } }
 * - pfc: { p, f, c } | null
 * - servings (列): 後方互換用。保存時は各食の最大人数を書き込む。
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
 * @property {boolean} isBusinessTrip
 * @property {{ p: number, f: number, c: number } | null} pfc
 * @property {{ breakfast: { items: MealDayItem[], servings: number }, lunch: { items: MealDayItem[], servings: number }, dinner: { items: MealDayItem[], servings: number } }} meals
 */

function demoSlot(items, servings) {
  const M = KitchenGit.Meals;
  const slot = M.emptyMealSlot();
  slot.servings = servings != null ? servings : M.DEFAULT_SERVINGS;
  if (typeof items === 'string') {
    if (items) slot.items = [{ title: items, recipeId: null }];
  } else if (Array.isArray(items)) {
    slot.items = items.map((item) => ({
      title: typeof item === 'string' ? item : item.title,
      recipeId: item.recipeId || null
    }));
  }
  return slot;
}

KitchenGit.demoMealDays = function demoMealDays() {
  // Order matches Saturday-start week: 土, 日, 月, 火, 水, 木, 金
  return [
    {
      tag: '空き枠', tagColor: 'slate', isBusinessTrip: false, pfc: null,
      meals: {
        breakfast: demoSlot('ホットケーキ', 2),
        lunch: demoSlot('残りキーマカレー', 2),
        dinner: demoSlot('', 2)
      }
    },
    {
      tag: '作り置き', tagColor: 'rose', isBusinessTrip: false, pfc: { p: 40, f: 10, c: 45 },
      meals: {
        breakfast: demoSlot('トーストと卵', 2),
        lunch: demoSlot('作り置き仕込みの軽食', 1),
        dinner: demoSlot('週末作り置き ＆ 軽食', 2)
      }
    },
    {
      tag: '定番ルーティン', tagColor: 'blue', isBusinessTrip: false, pfc: { p: 34, f: 12, c: 40 },
      meals: {
        breakfast: demoSlot('ヨーグルトとバナナ', 2),
        lunch: demoSlot('ほうれん草ナムル弁当', 2),
        dinner: demoSlot('焼き鮭とキノコのホイル焼き', 2)
      }
    },
    {
      tag: '最新 v1.2', tagColor: 'purple', isBusinessTrip: false, pfc: { p: 38, f: 8, c: 42 },
      meals: {
        breakfast: demoSlot('納豆ごはん', 2),
        lunch: demoSlot('ハーブサラダチキン弁当', 2),
        dinner: demoSlot('鶏むね肉と秋茄子のさっぱり炒め', 2)
      }
    },
    {
      tag: '出張 1人分', tagColor: 'amber', isBusinessTrip: true, pfc: { p: 32, f: 9, c: 35 },
      meals: {
        breakfast: demoSlot('ホテル朝食', 1),
        lunch: demoSlot('サラダチキン弁当（出張）', 1),
        dinner: demoSlot('豚ヒレと豆腐のスタミナ炒め', 1)
      }
    },
    {
      tag: '出張 1人分', tagColor: 'amber', isBusinessTrip: true, pfc: { p: 29, f: 14, c: 30 },
      meals: {
        breakfast: demoSlot('ホテル朝食', 1),
        lunch: demoSlot('鶏むねそぼろ弁当', 1),
        dinner: demoSlot([
          { title: '秋刀魚の塩焼き' },
          { title: '具だくさん豚汁' }
        ], 1)
      }
    },
    {
      tag: '2週に1回', tagColor: 'emerald', isBusinessTrip: false, pfc: { p: 36, f: 11, c: 65 },
      meals: {
        breakfast: demoSlot('納豆ごはん', 2),
        lunch: demoSlot('ナムルとサラダチキン', 2),
        dinner: demoSlot('特製スパイスキーマカレー', 2)
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

  function legacyDayServings(dayData, rowFallback) {
    const M = Meals();
    const fromSlots = M.MEAL_SLOTS.map((meta) => M.slotServings(M.slotOf(dayData, meta.key), rowFallback));
    const max = Math.max(...fromSlots, 0);
    if (max > 0) return max;
    const legacy = Number(dayData && dayData.servings);
    if (legacy > 0) return legacy;
    const row = Number(rowFallback);
    return row > 0 ? row : M.DEFAULT_SERVINGS;
  }

  function mealsToDb(meals) {
    const M = Meals();
    const out = M.emptyMeals();
    M.MEAL_SLOTS.forEach((meta) => {
      const slot = (meals && meals[meta.key]) || {};
      out[meta.key] = {
        items: M.mealItems(slot).map((item) => ({
          title: item.title,
          recipe_id: item.recipeId || null
        })),
        servings: M.slotServings(slot)
      };
    });
    return out;
  }

  function mealsFromDb(raw, rowFallback) {
    const M = Meals();
    const fallback = Number(rowFallback) > 0 ? Number(rowFallback) : M.DEFAULT_SERVINGS;
    const out = M.emptyMeals();
    M.MEAL_SLOTS.forEach((meta) => {
      const slot = (raw && raw[meta.key]) || {};
      out[meta.key] = {
        items: M.mealItems(slot).map((item) => ({
          title: item.title,
          recipeId: item.recipeId || null
        })),
        servings: M.slotServings(slot, fallback)
      };
    });
    return out;
  }

  function snapshotPayload(dayData) {
    const meals = mealsToDb(dayData.meals);
    return {
      date: isoDate(dayData.date),
      servings: legacyDayServings(dayData),
      is_business_trip: !!dayData.isBusinessTrip,
      tag: dayData.tag || '',
      tag_color: dayData.tagColor || 'slate',
      pfc: dayData.pfc || null,
      meals
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
      isBusinessTrip: !!row.is_business_trip,
      pfc: row.pfc || null,
      meals: mealsFromDb(row.meals, row.servings)
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
    const weekStart = W.toIsoDate(W.startOfWeekSaturday(new Date()));
    const days = W.applyTemplateToWeek(weekStart, KitchenGit.demoMealDays());
    const seeded = [];
    for (const day of days) {
      seeded.push(await upsertDay(day));
    }
    return seeded;
  }

  return { init, isReady, fetchRange, upsertDay, seedIfEmpty, mapRow };
})();
