window.KitchenGit = window.KitchenGit || {};

KitchenGit.MealEditor = (function () {
  const Meals = () => KitchenGit.Meals;
  const Week = () => KitchenGit.Week;
  const BACKDROP_GUARD_MS = 500;
  const ACTION_LOCK_MS = 400;

  let hooks = {};
  let ignoreBackdropUntil = 0;
  let actionLockUntil = 0;

  function recipesOf(state) {
    return (hooks.getRecipes && hooks.getRecipes()) || state.recipes || [];
  }

  function displayDateOf(dayData) {
    return dayData ? Week().formatMd(dayData.date) : '';
  }

  function notifySaved() {
    if (hooks.onChange) hooks.onChange();
  }

  function toast(message, kind) {
    if (hooks.showToast) hooks.showToast(message, kind);
  }

  function armBackdropGuard() {
    ignoreBackdropUntil = Date.now() + BACKDROP_GUARD_MS;
  }

  function beginAction() {
    const now = Date.now();
    if (now < actionLockUntil) return false;
    actionLockUntil = now + ACTION_LOCK_MS;
    armBackdropGuard();
    return true;
  }

  function setEditorError(message) {
    const el = document.getElementById('meal-edit-error');
    if (!el) return;
    el.textContent = message || '';
    el.classList.toggle('hidden', !message);
  }

  function normalizedEditorItems(state) {
    const M = Meals();
    const recipes = recipesOf(state);
    return M.cloneMealItems(state.mealEditorItems).map((item) => {
      const title = (item.title || '').trim();
      const recipe = M.findRecipeForItem(recipes, { title, recipeId: item.recipeId });
      return { title, recipeId: recipe ? recipe.id : null };
    }).filter((item) => item.title);
  }

  function syncItemsFromDom(state) {
    const rows = document.querySelectorAll('#meal-edit-items [data-meal-item]');
    if (!rows.length) return;
    state.mealEditorItems = Array.from(rows).map((row) => ({
      title: ((row.querySelector('input') && row.querySelector('input').value) || ''),
      recipeId: row.dataset.recipeId || null
    }));
  }

  function bindItemInputEvents(state) {
    document.querySelectorAll('#meal-edit-items input').forEach((input) => {
      input.addEventListener('blur', armBackdropGuard);
      input.addEventListener('input', () => setEditorError(''));
    });
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
          <input type="text" value="${M.escapeHtml(item.title || '')}" placeholder="料理名を入力" class="flex-1 min-w-0 bg-slate-100 border border-slate-200 rounded-2xl p-3 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none">
          ${openBtn}
          <button type="button" onclick="event.stopPropagation(); removeMealEditorItem(${index})" class="active-scale w-9 h-9 rounded-xl bg-slate-100 text-slate-400 shrink-0" title="削除" aria-label="削除">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>
      `;
    }).join('');
    bindItemInputEvents(state);
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
        <button type="button" onclick='pickMealRecipe(${M.encodeJsString(recipe.name)}, ${M.encodeJsString(recipe.id)})' class="${cls}">
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
    const dayData = M.findDayInState(state, dateStr);
    if (!dayData) return;
    const meta = M.MEAL_SLOTS.find((m) => m.key === slotKey) || M.MEAL_SLOTS[0];
    state.selectedDate = dateStr;
    state.mealEditorDate = dateStr;
    state.mealEditorSlot = slotKey;
    const existing = M.mealItems(M.slotOf(dayData, slotKey));
    state.mealEditorItems = existing.length ? M.cloneMealItems(existing) : M.emptyEditorItems();
    const heading = document.getElementById('meal-edit-heading');
    if (heading) heading.textContent = `${displayDateOf(dayData)} (${dayData.day}) の${meta.label}`;
    setEditorError('');
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

  function close(state, options) {
    const force = !!(options && options.force);
    if (!force && Date.now() < ignoreBackdropUntil) return;
    const backdrop = document.getElementById('meal-edit-backdrop');
    const sheet = document.getElementById('meal-edit-sheet');
    if (backdrop) backdrop.classList.add('hidden');
    if (sheet) sheet.classList.add('hidden');
    setEditorError('');
    state.mealEditorDate = null;
    state.mealEditorSlot = null;
    state.mealEditorItems = [];
  }

  function snapshotEditor(state) {
    syncItemsFromDom(state);
    return {
      dateStr: state.mealEditorDate,
      slotKey: state.mealEditorSlot,
      items: Meals().cloneMealItems(state.mealEditorItems)
    };
  }

  async function commitSlot(state, dateStr, slotKey, items, emptyMessage) {
    const M = Meals();
    const dayData = M.findDayInState(state, dateStr);
    if (!dayData || !slotKey) {
      toast('献立を保存できませんでした', 'error');
      return;
    }
    M.writeMealItems(dayData, slotKey, items);
    if (hooks.touchDay) hooks.touchDay(dayData);
    close(state, { force: true });
    notifySaved();
    if (hooks.persistDay) {
      const ok = await hooks.persistDay(dayData);
      if (!ok) return;
    }
    toast(items.length ? '献立を保存しました' : emptyMessage);
  }

  function bindGlobals(state, options) {
    hooks = options || {};

    window.openMealEditor = function (dateStr, slotKey) {
      open(state, dateStr, slotKey);
    };
    window.closeMealEditor = function () {
      close(state, { force: true });
    };
    window.closeMealEditorFromBackdrop = function () {
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
      setEditorError('');
      renderItems(state);
      renderRecipes(state);
    };
    window.saveMealSlot = async function () {
      if (!beginAction()) return;
      const snap = snapshotEditor(state);
      state.mealEditorItems = snap.items;
      const items = normalizedEditorItems(state);
      if (!items.length) {
        setEditorError('料理名を入力してください');
        toast('料理名を入力してください', 'error');
        return;
      }
      await commitSlot(state, snap.dateStr, snap.slotKey, items, '献立をクリアしました');
    };
    window.clearMealSlot = async function () {
      if (!beginAction()) return;
      const snap = snapshotEditor(state);
      await commitSlot(state, snap.dateStr, snap.slotKey, [], '献立をクリアしました');
    };
    window.openMatchedRecipeFromMeal = function (index) {
      const M = Meals();
      syncItemsFromDom(state);
      const item = state.mealEditorItems[index];
      const title = item && (item.title || '').trim();
      const recipes = recipesOf(state);
      const recipe = M.findRecipeForItem(recipes, item);
      close(state, { force: true });
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
