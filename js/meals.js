window.KitchenGit = window.KitchenGit || {};

/**
 * Meal-slot data: 1 slot holds `{ items: [{ title, recipeId?, itemId? }], servings, kind?, memo?, memoTag? }`.
 * kind: 'recipe' (default) | 'memo'. Legacy `{ title }` is read via mealItems().
 */
KitchenGit.Meals = (function () {
  const DEFAULT_SERVINGS = 2;

  const MEMO_QUICK_TAGS = [
    { emoji: '🍴', label: '外食' },
    { emoji: '🍱', label: 'テイクアウト' },
    { emoji: '🏠', label: '実家・その他' }
  ];

  const MEMO_TAG_EMOJI = {
    '外食': '🍴',
    'テイクアウト': '🍱',
    '実家・その他': '🏠'
  };

  const MEAL_SLOTS = [
    { key: 'breakfast', label: '朝', badge: 'bg-amber-100 text-amber-800' },
    { key: 'lunch', label: '昼', badge: 'bg-sky-100 text-sky-800' },
    { key: 'dinner', label: '晩', badge: 'bg-indigo-100 text-indigo-800' }
  ];

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function encodeJsString(value) {
    return JSON.stringify(value == null ? '' : String(value))
      .replace(/&/g, '\\u0026')
      .replace(/</g, '\\u003c');
  }

  function emptyMealSlot() {
    return { items: [], servings: DEFAULT_SERVINGS, kind: 'recipe', memo: '', memoTag: null };
  }

  function slotKind(slot) {
    if (slot && slot.kind === 'memo') return 'memo';
    return 'recipe';
  }

  function isMemoSlot(slot) {
    return slotKind(slot) === 'memo' && !!(slot.memo || '').trim();
  }

  function slotMemoText(slot) {
    if (!isMemoSlot(slot)) return '';
    const tag = (slot.memoTag || '').trim();
    const body = (slot.memo || '').trim();
    if (tag && body) return `${tag}：${body}`;
    return body || tag;
  }

  function slotDisplayLabel(slot) {
    if (!isMemoSlot(slot)) return '';
    const tag = (slot.memoTag || '').trim();
    const emoji = MEMO_TAG_EMOJI[tag] || '📝';
    const body = (slot.memo || '').trim();
    if (tag && body) return `${emoji} ${tag}：${body}`;
    if (tag) return `${emoji} ${tag}`;
    return `${emoji} ${body}`;
  }

  function slotServings(slot, fallback) {
    const n = slot && Number(slot.servings);
    if (n > 0) return n;
    const fb = Number(fallback);
    return fb > 0 ? fb : DEFAULT_SERVINGS;
  }

  function setSlotServings(dayData, slotKey, servings) {
    const slot = ensureMealSlot(dayData, slotKey);
    const n = Number(servings);
    slot.servings = n > 0 ? n : DEFAULT_SERVINGS;
    return slot.servings;
  }

  function toggleSlotServings(dayData, slotKey) {
    const slot = ensureMealSlot(dayData, slotKey);
    return setSlotServings(dayData, slotKey, slotServings(slot) === 2 ? 1 : 2);
  }

  function emptyMeals() {
    return { breakfast: emptyMealSlot(), lunch: emptyMealSlot(), dinner: emptyMealSlot() };
  }

  function emptyEditorItems() {
    return [];
  }

  function cloneMealItems(items) {
    return (items || []).map((item) => ({
      title: item.title || '',
      recipeId: item.recipeId || item.recipe_id || null,
      itemId: item.itemId || item.item_id || null
    }));
  }

  function normalizeMealItem(raw) {
    if (!raw) return null;
    if (typeof raw === 'string') {
      const title = raw.trim();
      return title ? { title, recipeId: null } : null;
    }
    const title = (raw.title || '').trim();
    if (!title) return null;
    return {
      title,
      recipeId: raw.recipeId || raw.recipe_id || null,
      itemId: raw.itemId || raw.item_id || null
    };
  }

  function mealItems(slot) {
    if (!slot) return [];
    if (Array.isArray(slot.items)) {
      return slot.items.map(normalizeMealItem).filter(Boolean);
    }
    const one = normalizeMealItem(slot);
    return one ? [one] : [];
  }

  function isMealFilled(slot) {
    if (isMemoSlot(slot)) return true;
    return mealItems(slot).length > 0;
  }

  function dayMeals(dayData) {
    return (dayData && dayData.meals) || {};
  }

  function slotOf(dayData, slotKey) {
    return dayMeals(dayData)[slotKey];
  }

  function weekHasAnyMeal(days) {
    return (days || []).some((dayData) =>
      MEAL_SLOTS.some((meta) => isMealFilled(slotOf(dayData, meta.key)))
    );
  }

  function isChickenDinner(dayData) {
    return mealItems(slotOf(dayData, 'dinner')).some((item) => item.title.includes('鶏むね肉と秋茄子'));
  }

  function ensureMealSlot(dayData, slotKey) {
    if (!dayData.meals) dayData.meals = emptyMeals();
    if (!dayData.meals[slotKey]) dayData.meals[slotKey] = emptyMealSlot();
    return dayData.meals[slotKey];
  }

  function writeMealItems(dayData, slotKey, items) {
    const slot = ensureMealSlot(dayData, slotKey);
    slot.items = cloneMealItems(items).filter((item) => item.title.trim());
    slot.kind = 'recipe';
    slot.memo = '';
    slot.memoTag = null;
    delete slot.title;
    return slot;
  }

  function writeMealMemo(dayData, slotKey, payload) {
    const slot = ensureMealSlot(dayData, slotKey);
    const memo = ((payload && payload.memo) || '').trim();
    const memoTag = (payload && payload.memoTag) ? String(payload.memoTag).trim() : null;
    if (!memo && !memoTag) {
      slot.items = [];
      slot.kind = 'recipe';
      slot.memo = '';
      slot.memoTag = null;
      delete slot.title;
      return slot;
    }
    slot.kind = 'memo';
    slot.memo = memo;
    slot.memoTag = memoTag || null;
    slot.items = [];
    delete slot.title;
    return slot;
  }

  function clearMealSlotData(dayData, slotKey) {
    const slot = ensureMealSlot(dayData, slotKey);
    slot.items = [];
    slot.kind = 'recipe';
    slot.memo = '';
    slot.memoTag = null;
    delete slot.title;
    return slot;
  }

  function computeDayPfc(dayData, recipes) {
    const Nutrition = KitchenGit.Nutrition;
    if (!Nutrition || !dayData) return null;
    let p = 0;
    let f = 0;
    let c = 0;
    let hasAny = false;
    MEAL_SLOTS.forEach((meta) => {
      const slot = slotOf(dayData, meta.key);
      if (!slot || isMemoSlot(slot)) return;
      const servings = slotServings(slot);
      mealItems(slot).forEach((item) => {
        const recipe = findRecipeForItem(recipes, item);
        if (!recipe || !recipe.pfc) return;
        const base = Number(recipe.servingsBase) > 0 ? Number(recipe.servingsBase) : DEFAULT_SERVINGS;
        const scale = servings / base;
        p += (recipe.pfc.p || 0) * scale;
        f += (recipe.pfc.f || 0) * scale;
        c += (recipe.pfc.c || 0) * scale;
        hasAny = true;
      });
    });
    if (!hasAny) return null;
    return {
      p: Math.round(p * 10) / 10,
      f: Math.round(f * 10) / 10,
      c: Math.round(c * 10) / 10
    };
  }

  function titleMatchesPrep(title, item) {
    const text = title || '';
    if (item.match instanceof RegExp) return item.match.test(text);
    const needle = String(item.match || '');
    return !!needle && text.includes(needle);
  }

  function slotMatchesPrep(slot, prepItem) {
    return mealItems(slot).some((item) => titleMatchesPrep(item.title, prepItem));
  }

  function recipeMatchesQuery(recipe, query) {
    const q = (query || '').trim().toLowerCase();
    if (!q) return true;
    const name = (recipe.name || '').toLowerCase();
    const tag = (recipe.tag || '').toLowerCase();
    const tags = Array.isArray(recipe.tags) ? recipe.tags.join(' ').toLowerCase() : '';
    const branch = (recipe.branch || '').toLowerCase();
    return name.includes(q) || tag.includes(q) || tags.includes(q) || branch.includes(q);
  }

  function filterRecipesByQuery(recipes, query) {
    return (recipes || []).filter((recipe) => recipeMatchesQuery(recipe, query));
  }

  function findRecipeForTitle(recipes, title) {
    const q = (title || '').trim();
    if (!q) return null;
    return (recipes || []).find((r) => {
      const name = r.name || '';
      return name && (q.includes(name) || name.includes(q));
    }) || null;
  }

  function findRecipeForItem(recipes, item) {
    if (!item) return null;
    if (item.recipeId) {
      const byId = (recipes || []).find((r) => r.id === item.recipeId);
      if (byId) return byId;
    }
    return findRecipeForTitle(recipes, item.title);
  }

  function findFoodItemForItem(foodItems, item) {
    if (!item) return null;
    if (item.itemId) {
      const byId = (foodItems || []).find((food) => food.id === item.itemId);
      if (byId) return byId;
    }
    const title = (item.title || '').trim();
    if (!title) return null;
    return (foodItems || []).find((food) => {
      const name = food.name || '';
      return name && (title.includes(name) || name.includes(title));
    }) || null;
  }

  function findDay(days, dateStr) {
    return (days || []).find((d) => d.date === dateStr) || null;
  }

  function findDayInState(state, dateStr) {
    if (!state || !dateStr) return null;
    const current = findDay(state.calendarDays, dateStr);
    if (current) return current;
    const weeks = state.weeksByStart || {};
    if (weeks[state.weekStart]) {
      const sameWeek = findDay(weeks[state.weekStart], dateStr);
      if (sameWeek) return sameWeek;
    }
    const keys = Object.keys(weeks);
    for (let i = 0; i < keys.length; i += 1) {
      const found = findDay(weeks[keys[i]], dateStr);
      if (found) return found;
    }
    return null;
  }

  return {
    DEFAULT_SERVINGS,
    MEMO_QUICK_TAGS,
    MEMO_TAG_EMOJI,
    MEAL_SLOTS,
    escapeHtml,
    encodeJsString,
    emptyMealSlot,
    emptyMeals,
    slotKind,
    isMemoSlot,
    slotMemoText,
    slotDisplayLabel,
    slotServings,
    setSlotServings,
    toggleSlotServings,
    emptyEditorItems,
    cloneMealItems,
    mealItems,
    isMealFilled,
    dayMeals,
    slotOf,
    weekHasAnyMeal,
    isChickenDinner,
    ensureMealSlot,
    writeMealItems,
    writeMealMemo,
    clearMealSlotData,
    computeDayPfc,
    titleMatchesPrep,
    slotMatchesPrep,
    recipeMatchesQuery,
    filterRecipesByQuery,
    findRecipeForTitle,
    findRecipeForItem,
    findFoodItemForItem,
    findDay,
    findDayInState
  };
})();
