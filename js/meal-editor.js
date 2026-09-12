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
    if (hooks.onShoppingRefresh) hooks.onShoppingRefresh();
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

  function selectedItems(state) {
    return (state.mealEditorItems || []).filter((item) => (item.title || '').trim());
  }

  function syncMemoFromInput(state) {
    const input = document.getElementById('meal-edit-memo-input');
    if (input) state.mealEditorMemo = input.value || '';
  }

  function itemsFromRecipes(state) {
    const M = Meals();
    const recipes = recipesOf(state);
    return M.cloneMealItems(selectedItems(state)).map((item) => {
      const title = (item.title || '').trim();
      const recipe = M.findRecipeForItem(recipes, { title, recipeId: item.recipeId });
      if (!recipe) return null;
      return { title: recipe.name || title, recipeId: recipe.id };
    }).filter(Boolean);
  }

  function renderTabUi(state) {
    const tab = state.mealEditorTab || 'recipe';
    const recipeBtn = document.getElementById('meal-edit-tab-recipe');
    const memoBtn = document.getElementById('meal-edit-tab-memo');
    const recipePanel = document.getElementById('meal-edit-panel-recipe');
    const memoPanel = document.getElementById('meal-edit-panel-memo');
    const activeCls = 'bg-white text-slate-900 shadow-sm border border-slate-900/10';
    const inactiveCls = 'text-slate-500';
    if (recipeBtn) recipeBtn.className = `py-2 rounded-xl text-[11px] font-bold transition-colors ${tab === 'recipe' ? activeCls : inactiveCls}`;
    if (memoBtn) memoBtn.className = `py-2 rounded-xl text-[11px] font-bold transition-colors ${tab === 'memo' ? activeCls + ' text-emerald-700' : inactiveCls}`;
    if (recipePanel) recipePanel.classList.toggle('hidden', tab !== 'recipe');
    if (memoPanel) memoPanel.classList.toggle('hidden', tab !== 'memo');
  }

  function renderQuickTags(state) {
    const M = Meals();
    const wrap = document.getElementById('meal-edit-quick-tags');
    if (!wrap) return;
    const activeTag = state.mealEditorMemoTag || '';
    wrap.innerHTML = M.MEMO_QUICK_TAGS.map((tag) => {
      const selected = activeTag === tag.label;
      const cls = selected
        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
        : 'bg-white border-slate-200 text-slate-700 active-scale';
      return `
        <button type="button" onclick='applyQuickTag(${M.encodeJsString(tag.label)})' class="px-2.5 py-1.5 rounded-full border text-[11px] font-bold ${cls}">
          ${tag.emoji} ${M.escapeHtml(tag.label)}
        </button>
      `;
    }).join('');
  }

  function renderMemoPanel(state) {
    const input = document.getElementById('meal-edit-memo-input');
    if (input && document.activeElement !== input) {
      input.value = state.mealEditorMemo || '';
    }
    renderQuickTags(state);
  }

  function renderItems(state) {
    const M = Meals();
    const list = document.getElementById('meal-edit-items');
    if (!list) return;
    const items = selectedItems(state);
    state.mealEditorItems = items;
    if (!items.length) {
      list.innerHTML = `
        <p class="text-[11px] text-slate-500 leading-relaxed bg-slate-50 border border-dashed border-slate-200 rounded-2xl px-3 py-2.5">
          まだ選んでいません。下の登録レシピから追加します。
        </p>
      `;
      return;
    }
    const recipes = recipesOf(state);
    list.innerHTML = items.map((item, index) => {
      const recipe = M.findRecipeForItem(recipes, item);
      const recipeId = recipe ? recipe.id : (item.recipeId || '');
      const label = (recipe && recipe.name) || item.title || '料理';
      const openBtn = recipe
        ? `<button type="button" onclick="event.stopPropagation(); openMatchedRecipeFromMeal(${index})" class="active-scale w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0" title="レシピを開く" aria-label="レシピを開く"><i class="fa-solid fa-book-bookmark text-xs"></i></button>`
        : '';
      const unmatchedNote = recipe
        ? ''
        : '<p class="text-[10px] font-medium text-amber-700">レシピ未登録のため、保存すると外れます</p>';
      return `
        <div data-meal-item data-recipe-id="${M.escapeHtml(recipeId)}" class="flex items-start gap-1.5 bg-slate-50 border border-slate-200 rounded-2xl pl-3 pr-1.5 py-1.5">
          <div class="flex-1 min-w-0 py-1.5">
            <p class="text-xs font-bold text-slate-900 truncate">${M.escapeHtml(label)}</p>
            ${unmatchedNote}
          </div>
          ${openBtn}
          <button type="button" onclick="event.stopPropagation(); removeMealEditorItem(${index})" class="active-scale w-9 h-9 rounded-xl bg-white text-slate-400 border border-slate-200 shrink-0 mt-0.5" title="削除" aria-label="削除">
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
    if ((state.mealEditorTab || 'recipe') !== 'recipe') {
      wrap.classList.add('hidden');
      return;
    }
    const recipes = recipesOf(state);
    wrap.classList.remove('hidden');
    if (!recipes.length) {
      list.innerHTML = `
        <div class="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-3 space-y-2">
          <p class="text-[11px] text-slate-600 leading-relaxed">献立は登録済みのレシピから選び、カレンダーに追加します。</p>
          <button type="button" onclick="openRegisterFromMealEditor()" class="active-scale w-full bg-emerald-600 text-white text-[11px] font-bold py-2 rounded-xl">
            + レシピを登録する
          </button>
        </div>
      `;
      return;
    }
    const addedKeys = new Set(
      selectedItems(state).flatMap((item) => {
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

  function renderEditor(state) {
    renderTabUi(state);
    renderItems(state);
    renderRecipes(state);
    renderMemoPanel(state);
  }

  function open(state, dateStr, slotKey) {
    const M = Meals();
    const dayData = M.findDayInState(state, dateStr);
    if (!dayData) return;
    const meta = M.MEAL_SLOTS.find((m) => m.key === slotKey) || M.MEAL_SLOTS[0];
    const slot = M.slotOf(dayData, slotKey);
    state.selectedDate = dateStr;
    state.mealEditorDate = dateStr;
    state.mealEditorSlot = slotKey;
    if (M.isMemoSlot(slot)) {
      state.mealEditorTab = 'memo';
      state.mealEditorMemo = slot.memo || '';
      state.mealEditorMemoTag = slot.memoTag || null;
      state.mealEditorItems = [];
    } else {
      state.mealEditorTab = 'recipe';
      state.mealEditorMemo = '';
      state.mealEditorMemoTag = null;
      const existing = M.mealItems(slot);
      state.mealEditorItems = existing.length ? M.cloneMealItems(existing) : [];
    }
    const heading = document.getElementById('meal-edit-heading');
    if (heading) heading.textContent = `${displayDateOf(dayData)} (${dayData.day}) の${meta.label}`;
    setEditorError('');
    renderEditor(state);
    document.getElementById('meal-edit-backdrop').classList.remove('hidden');
    document.getElementById('meal-edit-sheet').classList.remove('hidden');
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
    state.mealEditorTab = 'recipe';
    state.mealEditorMemo = '';
    state.mealEditorMemoTag = null;
  }

  function snapshotEditor(state) {
    syncMemoFromInput(state);
    return {
      dateStr: state.mealEditorDate,
      slotKey: state.mealEditorSlot,
      tab: state.mealEditorTab || 'recipe',
      items: Meals().cloneMealItems(selectedItems(state)),
      memo: (state.mealEditorMemo || '').trim(),
      memoTag: state.mealEditorMemoTag || null
    };
  }

  async function commitRecipeSlot(state, dateStr, slotKey, items, emptyMessage) {
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

  async function commitMemoSlot(state, dateStr, slotKey, payload, emptyMessage) {
    const M = Meals();
    const dayData = M.findDayInState(state, dateStr);
    if (!dayData || !slotKey) {
      toast('献立を保存できませんでした', 'error');
      return;
    }
    M.writeMealMemo(dayData, slotKey, payload);
    if (hooks.touchDay) hooks.touchDay(dayData);
    close(state, { force: true });
    notifySaved();
    if (hooks.persistDay) {
      const ok = await hooks.persistDay(dayData);
      if (!ok) return;
    }
    const saved = (payload.memo || payload.memoTag);
    toast(saved ? '外食・メモを保存しました' : emptyMessage);
  }

  async function commitClearSlot(state, dateStr, slotKey) {
    const M = Meals();
    const dayData = M.findDayInState(state, dateStr);
    if (!dayData || !slotKey) {
      toast('献立を保存できませんでした', 'error');
      return;
    }
    M.clearMealSlotData(dayData, slotKey);
    if (hooks.touchDay) hooks.touchDay(dayData);
    close(state, { force: true });
    notifySaved();
    if (hooks.persistDay) {
      const ok = await hooks.persistDay(dayData);
      if (!ok) return;
    }
    toast('献立をクリアしました');
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
    window.switchMealEditorTab = function (tab) {
      syncMemoFromInput(state);
      state.mealEditorTab = tab === 'memo' ? 'memo' : 'recipe';
      setEditorError('');
      renderEditor(state);
    };
    window.applyQuickTag = function (label) {
      const tag = (label || '').trim();
      if (!tag) return;
      state.mealEditorMemoTag = tag;
      const current = (state.mealEditorMemo || '').trim();
      if (!current) {
        state.mealEditorMemo = `${tag}：`;
      }
      renderMemoPanel(state);
      const input = document.getElementById('meal-edit-memo-input');
      if (input) {
        input.value = state.mealEditorMemo;
        input.focus();
      }
    };
    window.openRegisterFromMealEditor = function () {
      close(state, { force: true });
      if (hooks.onRegisterRecipe) hooks.onRegisterRecipe();
    };
    window.removeMealEditorItem = function (index) {
      state.mealEditorItems.splice(index, 1);
      setEditorError('');
      renderItems(state);
      renderRecipes(state);
    };
    window.pickMealRecipe = function (name, recipeId) {
      const title = (name || '').trim();
      if (!title || !recipeId) return;
      const duplicate = selectedItems(state).some((item) => {
        if (item.recipeId === recipeId) return true;
        return (item.title || '').trim() === title;
      });
      if (duplicate) {
        toast('すでに追加されています');
        return;
      }
      state.mealEditorItems = selectedItems(state).concat([{ title, recipeId }]);
      setEditorError('');
      renderItems(state);
      renderRecipes(state);
    };
    window.saveMealSlot = async function () {
      if (!beginAction()) return;
      const snap = snapshotEditor(state);
      if (snap.tab === 'memo') {
        if (!snap.memo && !snap.memoTag) {
          setEditorError('記録内容またはクイックタグを入力してください');
          return;
        }
        await commitMemoSlot(state, snap.dateStr, snap.slotKey, {
          memo: snap.memo,
          memoTag: snap.memoTag
        }, '献立をクリアしました');
        return;
      }
      state.mealEditorItems = snap.items;
      const items = itemsFromRecipes(state);
      await commitRecipeSlot(state, snap.dateStr, snap.slotKey, items, '献立を保存しました');
    };
    window.clearMealSlot = async function () {
      if (!beginAction()) return;
      const snap = snapshotEditor(state);
      await commitClearSlot(state, snap.dateStr, snap.slotKey);
    };
    window.openMatchedRecipeFromMeal = function (index) {
      const M = Meals();
      const item = state.mealEditorItems[index];
      const title = item && (item.title || '').trim();
      const recipes = recipesOf(state);
      const recipe = M.findRecipeForItem(recipes, item);
      close(state, { force: true });
      if (hooks.onOpenRecipe) hooks.onOpenRecipe(recipe, title);
    };

    const memoInput = document.getElementById('meal-edit-memo-input');
    if (memoInput) {
      memoInput.addEventListener('input', function () {
        state.mealEditorMemo = this.value || '';
      });
    }
  }

  return {
    bindGlobals,
    renderRecipes,
    open,
    close
  };
})();
