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

  function foodItemsOf(state) {
    return (hooks.getFoodItems && hooks.getFoodItems()) || state.foodItems || [];
  }

  function searchQueryOf(state) {
    return state.mealEditorSearchQuery || '';
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

  function itemKeys(items) {
    return (items || []).flatMap((item) => {
      const keys = [];
      if (item.recipeId) keys.push(`recipe:${item.recipeId}`);
      if (item.itemId) keys.push(`item:${item.itemId}`);
      const title = (item.title || '').trim();
      if (title) keys.push(`name:${title.toLowerCase()}`);
      return keys;
    });
  }

  function isDuplicateItem(items, candidate) {
    const keys = new Set(itemKeys(items));
    if (candidate.recipeId && keys.has(`recipe:${candidate.recipeId}`)) return true;
    if (candidate.itemId && keys.has(`item:${candidate.itemId}`)) return true;
    const title = (candidate.title || '').trim();
    if (title && keys.has(`name:${title.toLowerCase()}`)) return true;
    return false;
  }

  function syncMemoFromInput(state) {
    const input = document.getElementById('meal-edit-memo-input');
    if (input) state.mealEditorMemo = input.value || '';
  }

  function itemsFromEditor(state) {
    const M = Meals();
    const recipes = recipesOf(state);
    return M.cloneMealItems(selectedItems(state)).map((item) => {
      const title = (item.title || '').trim();
      if (!title) return null;

      const recipe = M.findRecipeForItem(recipes, { title, recipeId: item.recipeId });
      if (!recipe) return null;
      return { title: recipe.name || title, recipeId: recipe.id, itemId: null };
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
        <button type="button" data-tag-label="${M.escapeHtml(tag.label)}" onclick="applyQuickTag(this.dataset.tagLabel)" class="px-2.5 py-1.5 rounded-full border text-[11px] font-bold ${cls}">
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
    const currentBox = document.getElementById('meal-edit-current-slot-box');
    const list = document.getElementById('meal-edit-items');
    if (!list) return;
    const items = selectedItems(state);
    state.mealEditorItems = items;
    if (currentBox) {
      currentBox.classList.toggle('hidden', items.length === 0);
    }
    if (!items.length) {
      list.innerHTML = '';
      return;
    }
    const recipes = recipesOf(state);
    const foodItems = foodItemsOf(state);
    list.innerHTML = items.map((item, index) => {
      const food = M.findFoodItemForItem(foodItems, item);
      const recipe = food ? null : M.findRecipeForItem(recipes, item);
      const recipeId = recipe ? recipe.id : (item.recipeId || '');
      const itemId = food ? food.id : (item.itemId || '');
      const label = (food && food.name) || (recipe && recipe.name) || item.title || '料理';
      const imgUrl = recipe ? (recipe.imageUrl || M.recipeImageUrl(recipe)) : '';
      const imgHtml = imgUrl
        ? `<img src="${M.escapeHtml(imgUrl)}" alt="" class="w-9 h-9 rounded-xl object-cover shrink-0 bg-slate-100 border border-slate-200/80">`
        : '';
      const openBtn = recipe
        ? `<button type="button" onclick="event.stopPropagation(); openMatchedRecipeFromMeal(${index})" class="active-scale w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0" title="レシピを開く" aria-label="レシピを開く"><i class="fa-solid fa-book-bookmark text-xs"></i></button>`
        : '';
      const kindBadge = food
        ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">材料</span>'
        : '';
      const unmatchedNote = (recipe || food)
        ? ''
        : '<p class="text-[10px] font-medium text-amber-700">未登録のため、保存すると外れます</p>';
      return `
        <div data-meal-item data-recipe-id="${M.escapeHtml(recipeId)}" data-item-id="${M.escapeHtml(itemId)}" class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2">
          ${imgHtml}
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5 min-w-0">
              <p class="text-xs font-bold text-slate-900 truncate">${M.escapeHtml(label)}</p>
              ${kindBadge}
            </div>
            ${unmatchedNote}
          </div>
          ${openBtn}
          <button type="button" onclick="event.stopPropagation(); removeMealEditorItem(${index})" class="active-scale w-8 h-8 rounded-xl bg-white text-slate-400 border border-slate-200 shrink-0" title="削除" aria-label="削除">
            <i class="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>
      `;
    }).join('');
  }

  const QUICK_FILTER_CHIPS = ['すべて', '鶏肉', '豚肉', '魚', '豆腐', '卵', '野菜', '定番', '汁物'];

  function escapeRegex(string) {
    return String(string || '').replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
  }

  function renderQuickChips(state) {
    const M = Meals();
    const container = document.getElementById('meal-edit-quick-chips');
    if (!container) return;
    const currentQuery = (searchQueryOf(state) || '').trim();
    container.innerHTML = QUICK_FILTER_CHIPS.map((chip) => {
      const isAll = chip === 'すべて';
      const isActive = isAll ? !currentQuery : currentQuery === chip;
      const cls = isActive
        ? 'bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-full shadow-2xs border border-emerald-600 active-scale whitespace-nowrap text-[11px]'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/80 px-2.5 py-1 rounded-full active-scale whitespace-nowrap text-[11px]';
      return `
        <button type="button" data-chip="${M.escapeHtml(chip)}" onclick="applyMealEditorChip(this.dataset.chip)" class="${cls}">
          ${M.escapeHtml(chip)}
        </button>
      `;
    }).join('');
  }

  function recipeImageUrl(recipe) {
    if (recipe && recipe.imageUrl) return recipe.imageUrl;
    const name = (recipe && recipe.name) || '';
    if (name.includes('豚肉') || name.includes('生姜焼き') || name.includes('豚')) {
      return 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1';
    }
    if (name.includes('鶏') || name.includes('チキン') || name.includes('炒め')) {
      return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';
    }
    if (name.includes('麻婆豆腐') || name.includes('豆腐')) {
      return 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6';
    }
    if (name.includes('鮭') || name.includes('魚') || name.includes('さば') || name.includes('鯖')) {
      return 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2';
    }
    if (name.includes('パスタ') || name.includes('麺')) {
      return 'https://images.unsplash.com/photo-1621996346565-e3d5d6281295';
    }
    return 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c';
  }

  function isRecipeInInterval(recipe, targetDateStr, state) {
    const interval = Number(recipe.intervalDays) || 0;
    if (interval <= 0) return false;
    if (!targetDateStr) return false;

    const targetDate = new Date(targetDateStr);
    if (Number.isNaN(targetDate.getTime())) return false;

    const allDays = [];
    if (state.weeksByStart) {
      Object.values(state.weeksByStart).forEach((week) => {
        if (Array.isArray(week)) allDays.push(...week);
      });
    }
    if (state.calendarDays && Array.isArray(state.calendarDays)) {
      allDays.push(...state.calendarDays);
    }

    const dayMap = new Map();
    allDays.forEach((d) => {
      if (d && d.date) dayMap.set(d.date, d);
    });

    const targetMs = targetDate.getTime();
    const intervalMs = interval * 24 * 60 * 60 * 1000;
    const startMs = targetMs - intervalMs;

    for (const [dateStr, dayData] of dayMap.entries()) {
      const dTime = new Date(dateStr).getTime();
      if (!Number.isNaN(dTime) && dTime >= startMs && dTime < targetMs) {
        const slots = dayData.slots || {};
        for (const slotKey of Object.keys(slots)) {
          const slot = slots[slotKey];
          if (slot && Array.isArray(slot.items)) {
            for (const item of slot.items) {
              if (item.recipeId === recipe.id || (item.title && recipe.name && item.title.trim() === recipe.name.trim())) {
                return true;
              }
            }
          }
        }
      }
    }
    return false;
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
    const query = searchQueryOf(state).trim();
    wrap.classList.remove('hidden');

    const clearBtn = document.getElementById('meal-edit-search-clear');
    if (clearBtn) clearBtn.classList.toggle('hidden', !query);

    renderQuickChips(state);

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

    const matchesList = [];
    recipes.forEach((recipe) => {
      if (isRecipeInInterval(recipe, state.selectedDate, state)) {
        return;
      }
      const details = M.recipeMatchesQueryDetails
        ? M.recipeMatchesQueryDetails(recipe, query)
        : { matches: M.recipeMatchesQuery(recipe, query), matchedIngredients: [], tokens: [] };
      if (details.matches) {
        matchesList.push({ recipe, details });
      }
    });

    const countBadge = document.getElementById('meal-edit-search-count-badge');
    if (countBadge) {
      countBadge.textContent = query ? `一致 ${matchesList.length}件` : `全 ${recipes.length}件`;
    }

    const headerEl = document.getElementById('meal-edit-recipes-header');
    if (headerEl) {
      headerEl.textContent = query ? `「${query}」の検索結果 (${matchesList.length}件)` : `登録レシピ一覧 (${recipes.length}件)`;
    }

    if (!matchesList.length) {
      list.innerHTML = `
        <div class="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-3.5 text-center space-y-2">
          <p class="text-[11px] text-slate-600 leading-relaxed font-bold">
            「${M.escapeHtml(query)}」に一致するレシピはありません
          </p>
          <p class="text-[10px] text-slate-400">
            料理名や材料名（例: 鶏肉, 豚肉, 豆腐, 茄子）を変えて検索するか、条件をクリアしてください。
          </p>
          <button type="button" onclick="clearMealEditorSearch()" class="inline-flex items-center gap-1.5 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl hover:bg-emerald-100 active-scale">
            <i class="fa-solid fa-rotate-left text-[10px]"></i>
            <span>絞り込みをクリア</span>
          </button>
        </div>
      `;
      return;
    }

    const addedKeys = new Set(itemKeys(selectedItems(state)));
    list.innerHTML = matchesList.map(({ recipe, details }) => {
      const added = addedKeys.has(`recipe:${recipe.id}`) || addedKeys.has(`name:${(recipe.name || '').toLowerCase()}`);

      // Highlight matching keyword tokens in recipe name
      let displayName = M.escapeHtml(recipe.name);
      if (query && details.tokens && details.tokens.length) {
        details.tokens.forEach((tok) => {
          if (!tok) return;
          const re = new RegExp(`(${escapeRegex(tok)})`, 'gi');
          displayName = displayName.replace(re, '<mark class="bg-amber-200 text-amber-950 font-bold px-0.5 rounded">$1</mark>');
        });
      }

      const tagBadge = recipe.tag
        ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${M.escapeHtml(recipe.tag)}</span>`
        : '';
      const pfcBadge = recipe.pfc && recipe.pfc.kcal
        ? `<span class="text-[9px] font-mono text-slate-400">${Math.round(recipe.pfc.kcal)} kcal</span>`
        : '';
      const imgUrl = recipeImageUrl(recipe);

      return `
        <div class="border ${added ? 'bg-emerald-50/60 border-emerald-300' : 'bg-white border-slate-200/90 hover:border-emerald-300'} rounded-2xl p-2.5 shadow-2xs transition-all flex items-center gap-3">
          <img src="${imgUrl}" alt="${M.escapeHtml(recipe.name)}" class="w-12 h-12 rounded-xl object-cover shrink-0 bg-slate-100 border border-slate-200/80">
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 mb-0.5 flex-wrap">
              ${tagBadge}
              ${pfcBadge}
            </div>
            <h4 class="text-xs font-bold text-slate-900 leading-snug truncate">${displayName}</h4>
          </div>
          <div class="shrink-0 flex items-center gap-1">
            <button type="button" data-recipe-id="${M.escapeHtml(recipe.id)}" onclick="viewRecipeFromMealEditor(this.dataset.recipeId)" title="レシピ詳細を見る" class="w-7 h-7 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200 flex items-center justify-center text-xs active-scale">
              <i class="fa-solid fa-book-open"></i>
            </button>
            <button type="button" data-recipe-name="${M.escapeHtml(recipe.name)}" data-recipe-id="${M.escapeHtml(recipe.id)}" onclick="pickAndSaveMealRecipe(this.dataset.recipeName, this.dataset.recipeId)" class="active-scale text-xs font-bold px-3.5 py-2 rounded-xl transition-all bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-1">
              <i class="fa-solid fa-plus text-[10px]"></i>
              <span>この枠に登録</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }



  function appendMealItem(state, item) {
    if (isDuplicateItem(selectedItems(state), item)) {
      toast('すでに追加されています');
      return false;
    }
    state.mealEditorItems = selectedItems(state).concat([item]);
    setEditorError('');
    renderItems(state);
    renderRecipes(state);
    return true;
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
    if (heading) {
      heading.innerHTML = `
        <span class="inline-flex items-center gap-2 flex-wrap">
          <span>${displayDateOf(dayData)} (${dayData.day})</span>
          <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${meta.badge} text-[11px] font-bold">
            <span class="material-symbols-outlined text-[14px] leading-none" aria-hidden="true">${meta.icon}</span>
            <span>${meta.label}</span>
          </span>
        </span>
      `;
    }
    state.mealEditorSearchQuery = '';
    const searchInput = document.getElementById('meal-edit-search-input');
    if (searchInput) searchInput.value = '';
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
    state.mealEditorSearchQuery = '';
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
    window.openImageScannerFromMealEditor = function () {
      close(state, { force: true });
      if (window.openImageScannerModal) window.openImageScannerModal();
    };
    window.removeMealEditorItem = function (index) {
      state.mealEditorItems.splice(index, 1);
      setEditorError('');
      renderEditor(state);
    };
    window.pickAndSaveMealRecipe = async function (name, recipeId) {
      const title = (name || '').trim();
      if (!title || !recipeId) return;
      if (!beginAction()) return;
      const item = { title, recipeId, itemId: null };
      state.mealEditorItems = [item];
      const items = itemsFromEditor(state);
      await commitRecipeSlot(state, state.mealEditorDate, state.mealEditorSlot, items, '献立を保存しました');
      toast(`「${title}」を献立に登録しました`);
    };

    window.pickMealRecipe = function (name, recipeId) {
      const title = (name || '').trim();
      if (!title || !recipeId) return;
      appendMealItem(state, { title, recipeId, itemId: null });
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
      const items = itemsFromEditor(state);
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

    window.clearMealEditorSearch = function () {
      state.mealEditorSearchQuery = '';
      const input = document.getElementById('meal-edit-search-input');
      if (input) input.value = '';
      renderRecipes(state);
    };

    window.applyMealEditorChip = function (chip) {
      if (chip === 'すべて') {
        state.mealEditorSearchQuery = '';
      } else if ((state.mealEditorSearchQuery || '').trim() === chip) {
        state.mealEditorSearchQuery = '';
      } else {
        state.mealEditorSearchQuery = chip;
      }
      const input = document.getElementById('meal-edit-search-input');
      if (input) input.value = state.mealEditorSearchQuery;
      renderRecipes(state);
    };

    window.viewRecipeFromMealEditor = function (recipeId) {
      close(state, { force: true });
      if (typeof window.showRecipeDetail === 'function') {
        if (typeof window.switchTab === 'function') window.switchTab('recipe');
        window.showRecipeDetail(recipeId);
      }
    };

    const memoInput = document.getElementById('meal-edit-memo-input');
    if (memoInput) {
      memoInput.addEventListener('input', function () {
        state.mealEditorMemo = this.value || '';
      });
    }

    const searchInput = document.getElementById('meal-edit-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', function () {
        state.mealEditorSearchQuery = this.value || '';
        renderRecipes(state);
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
