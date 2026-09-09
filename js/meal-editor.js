window.KitchenGit = window.KitchenGit || {};

KitchenGit.MealEditor = (function () {
  const Meals = () => KitchenGit.Meals;
  const Week = () => KitchenGit.Week;

  let hooks = {};

  function recipesOf(state) {
    return (hooks.getRecipes && hooks.getRecipes()) || state.recipes || [];
  }

  function displayDateOf(dayData) {
    return dayData ? Week().formatMd(dayData.date) : '';
  }

  function notifySaved() {
    if (hooks.onChange) hooks.onChange();
  }

  function toast(message) {
    if (hooks.showToast) hooks.showToast(message);
  }

  function syncItemsFromDom(state) {
    const rows = document.querySelectorAll('#meal-edit-items [data-meal-item]');
    if (!rows.length) return;
    state.mealEditorItems = Array.from(rows).map((row) => ({
      title: ((row.querySelector('input') && row.querySelector('input').value) || ''),
      recipeId: row.dataset.recipeId || null
    }));
  }

  function renderItems(state) {
    const M = Meals();
    const list = document.getElementById('meal-edit-items');
    if (!list) return;
    const items = state.mealEditorItems && state.mealEditorItems.length
      ? state.mealEditorItems
      : M.emptyEditorItems();
    state.mealEditorItems = items;
    const recipes = recipesOf(state);
    list.innerHTML = items.map((item, index) => {
      const recipe = M.findRecipeForItem(recipes, item);
      const recipeId = recipe ? recipe.id : (item.recipeId || '');
      const openBtn = recipe
        ? `<button type="button" onclick="event.stopPropagation(); openMatchedRecipeFromMeal(${index})" class="active-scale w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0" title="レシピを開く" aria-label="レシピを開く"><i class="fa-solid fa-book-bookmark text-xs"></i></button>`
        : '';
      return `
        <div data-meal-item data-recipe-id="${M.escapeHtml(recipeId)}" class="flex items-center gap-1.5">
          <input type="text" value="${M.escapeHtml(item.title || '')}" placeholder="例: 焼き鮭とキノコのホイル焼き" class="flex-1 min-w-0 bg-slate-100 border border-slate-200 rounded-2xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none">
          ${openBtn}
          <button type="button" onclick="event.stopPropagation(); removeMealEditorItem(${index})" class="active-scale w-9 h-9 rounded-xl bg-slate-100 text-slate-400 shrink-0" title="削除" aria-label="削除">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>
      `;
    }).join('');
  }

  function renderRecipes(state) {
    const M = Meals();
    const wrap = document.getElementById('meal-edit-recipes-wrap');
    const list = document.getElementById('meal-edit-recipes');
    if (!wrap || !list) return;
    const recipes = recipesOf(state);
    wrap.classList.toggle('hidden', recipes.length === 0);
    const addedKeys = new Set(
      (state.mealEditorItems || []).flatMap((item) => {
        const keys = [];
        if (item.recipeId) keys.push(`id:${item.recipeId}`);
        const title = (item.title || '').trim();
        if (title) keys.push(`name:${title}`);
        return keys;
      })
    );
    list.innerHTML = recipes.map((recipe) => {
      const added = addedKeys.has(`id:${recipe.id}`) || addedKeys.has(`name:${recipe.name}`);
      const cls = added
        ? 'w-full text-left bg-emerald-50 border border-emerald-200 rounded-2xl px-3 py-2 font-bold text-emerald-800'
        : 'active-scale w-full text-left bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 font-bold text-slate-800';
      return `
        <button type="button" onclick="pickMealRecipe(${M.encodeJsString(recipe.name)}, ${M.encodeJsString(recipe.id)})" class="${cls}">
          ${M.escapeHtml(recipe.name)}${added ? ' <span class="text-[10px] font-bold">追加済</span>' : ''}
        </button>
      `;
    }).join('');
  }

  function focusLastInput() {
    const inputs = document.querySelectorAll('#meal-edit-items input');
    const last = inputs[inputs.length - 1];
    if (last) last.focus();
  }

  function open(state, dateStr, slotKey) {
    const M = Meals();
    const dayData = M.findDay(state.calendarDays, dateStr);
    if (!dayData) return;
    const meta = M.MEAL_SLOTS.find((m) => m.key === slotKey) || M.MEAL_SLOTS[0];
    state.selectedDate = dateStr;
    state.mealEditorDate = dateStr;
    state.mealEditorSlot = slotKey;
    const existing = M.mealItems(M.slotOf(dayData, slotKey));
    state.mealEditorItems = existing.length ? M.cloneMealItems(existing) : M.emptyEditorItems();
    const heading = document.getElementById('meal-edit-heading');
    if (heading) heading.textContent = `${displayDateOf(dayData)} (${dayData.day}) の${meta.label}`;
    renderItems(state);
    renderRecipes(state);
    document.getElementById('meal-edit-backdrop').classList.remove('hidden');
    document.getElementById('meal-edit-sheet').classList.remove('hidden');
    const firstInput = document.querySelector('#meal-edit-items input');
    if (firstInput) {
      firstInput.focus();
      firstInput.setSelectionRange(firstInput.value.length, firstInput.value.length);
    }
  }

  function close(state) {
    const backdrop = document.getElementById('meal-edit-backdrop');
    const sheet = document.getElementById('meal-edit-sheet');
    if (backdrop) backdrop.classList.add('hidden');
    if (sheet) sheet.classList.add('hidden');
    state.mealEditorDate = null;
    state.mealEditorSlot = null;
    state.mealEditorItems = [];
  }

  function bindGlobals(state, options) {
    hooks = options || {};

    window.openMealEditor = function (dateStr, slotKey) {
      open(state, dateStr, slotKey);
    };
    window.closeMealEditor = function () {
      close(state);
    };
    window.addMealEditorItem = function () {
      syncItemsFromDom(state);
      state.mealEditorItems.push({ title: '', recipeId: null });
      renderItems(state);
      focusLastInput();
    };
    window.removeMealEditorItem = function (index) {
      const M = Meals();
      syncItemsFromDom(state);
      state.mealEditorItems.splice(index, 1);
      if (!state.mealEditorItems.length) state.mealEditorItems = M.emptyEditorItems();
      renderItems(state);
      renderRecipes(state);
    };
    window.pickMealRecipe = function (name, recipeId) {
      syncItemsFromDom(state);
      const title = (name || '').trim();
      if (!title) return;
      const duplicate = state.mealEditorItems.some((item) => {
        if (recipeId && item.recipeId === recipeId) return true;
        return (item.title || '').trim() === title;
      });
      if (duplicate) {
        toast('すでに追加されています');
        return;
      }
      const last = state.mealEditorItems[state.mealEditorItems.length - 1];
      if (last && !(last.title || '').trim()) {
        last.title = title;
        last.recipeId = recipeId || null;
      } else {
        state.mealEditorItems.push({ title, recipeId: recipeId || null });
      }
      renderItems(state);
      renderRecipes(state);
    };
    window.saveMealSlot = function () {
      const M = Meals();
      const dayData = M.findDay(state.calendarDays, state.mealEditorDate);
      const slotKey = state.mealEditorSlot;
      if (!dayData || !slotKey) return;
      syncItemsFromDom(state);
      const recipes = recipesOf(state);
      const items = M.cloneMealItems(state.mealEditorItems).map((item) => {
        const title = item.title.trim();
        const recipe = M.findRecipeForItem(recipes, { title, recipeId: item.recipeId });
        return { title, recipeId: recipe ? recipe.id : null };
      }).filter((item) => item.title);
      M.writeMealItems(dayData, slotKey, items);
      close(state);
      notifySaved();
      toast(items.length ? '献立を保存しました' : '献立をクリアしました');
    };
    window.clearMealSlot = function () {
      const M = Meals();
      const dayData = M.findDay(state.calendarDays, state.mealEditorDate);
      const slotKey = state.mealEditorSlot;
      if (!dayData || !slotKey) return;
      M.writeMealItems(dayData, slotKey, []);
      close(state);
      notifySaved();
      toast('献立をクリアしました');
    };
    window.openMatchedRecipeFromMeal = function (index) {
      const M = Meals();
      syncItemsFromDom(state);
      const item = state.mealEditorItems[index];
      const title = item && (item.title || '').trim();
      const recipes = recipesOf(state);
      const recipe = M.findRecipeForItem(recipes, item);
      close(state);
      if (hooks.onOpenRecipe) hooks.onOpenRecipe(recipe, title);
    };
  }

  return {
    bindGlobals,
    renderRecipes,
    open,
    close
  };
})();
