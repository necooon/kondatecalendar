window.KitchenGit = window.KitchenGit || {};

/**
 * Meal-slot data: 1 slot holds `{ items: [{ title, recipeId }] }`.
 * Legacy `{ title }` is read via mealItems() and rewritten on save.
 */
KitchenGit.Meals = (function () {
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
    return { items: [] };
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
      recipeId: item.recipeId || item.recipe_id || null
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
    return { title, recipeId: raw.recipeId || raw.recipe_id || null };
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
    delete slot.title;
    return slot;
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
    MEAL_SLOTS,
    escapeHtml,
    encodeJsString,
    emptyMealSlot,
    emptyMeals,
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
    titleMatchesPrep,
    slotMatchesPrep,
    findRecipeForTitle,
    findRecipeForItem,
    findDay,
    findDayInState
  };
})();
