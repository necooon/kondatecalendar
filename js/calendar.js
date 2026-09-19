window.KitchenGit = window.KitchenGit || {};

KitchenGit.Calendar = (function () {
  const Week = () => KitchenGit.Week;
  const Meals = () => KitchenGit.Meals;
  const MealEditor = () => KitchenGit.MealEditor;

  const AI_DINNER = {
    items: [
      { title: '秋鯖の竜田揚げ' },
      { title: 'キノコポン酢和え' }
    ],
    tag: 'AI提案 (旬食材)',
    tagColor: 'emerald',
    pfc: { p: 35, f: 15, c: 38 }
  };

  const DEMO_PREP_ITEMS = [
    { id: 'chicken', name: '自家製ハーブサラダチキン', version: 'v2.1', note: 'P: 42g / 低脂質 / 水曜と金曜に消費', servingsLabel: '2食分', match: 'サラダチキン', days: ['水', '金'] },
    { id: 'namul', name: 'ほうれん草と人参のナムル', version: '', note: 'βカロテン・鉄分補給常備菜', servingsLabel: '3食分', match: 'ナムル', days: null },
    { id: 'soboro', name: '鶏むねそぼろ（冷凍ストック）', version: '', note: 'P: 28g / 木曜弁当のタンパク源', servingsLabel: '4食分', match: 'そぼろ', days: ['木'] }
  ];

  let hooks = {};

  function displayDateOf(dayData) {
    return dayData ? Week().formatMd(dayData.date) : '';
  }

  function currentPrepItems(state) {
    return state.prepByWeekStart[state.weekStart] || [];
  }

  function isPrepMealSlot(state, slot) {
    const M = Meals();
    return currentPrepItems(state).some((item) => M.slotMatchesPrep(slot, item));
  }

  function ensureWeek(state, weekStart) {
    const W = Week();
    if (!state.weeksByStart[weekStart]) {
      state.weeksByStart[weekStart] = W.buildEmptyWeekDays(weekStart);
    }
    if (state.prepByWeekStart[weekStart] === undefined) {
      state.prepByWeekStart[weekStart] = weekStart === state.demoWeekStart
        ? W.clone(DEMO_PREP_ITEMS)
        : [];
    }
    return state.weeksByStart[weekStart];
  }

  function mergeRowsIntoWeek(days, rows, snapshotGens) {
    const byDate = {};
    (rows || []).forEach((row) => {
      if (row && row.date) byDate[row.date] = row;
    });
    const gens = snapshotGens || {};
    return (days || []).map((day) => {
      const row = byDate[day.date];
      const savedDuringFetch = (day.localSaveGen || 0) > (gens[day.date] || 0);
      if (savedDuringFetch) {
        if (row && row.id && !day.id) day.id = row.id;
        return day;
      }
      if (!row) return day;
      return Object.assign({}, day, {
        id: row.id,
        tag: row.tag,
        tagColor: row.tagColor,
        isBusinessTrip: row.isBusinessTrip,
        pfc: row.pfc,
        meals: row.meals
      }, { date: day.date, day: day.day, localSaveGen: day.localSaveGen });
    });
  }

  function findLiveDay(state, dateStr) {
    return Meals().findDayInState(state, dateStr);
  }

  function touchDay(state, dayData) {
    if (!dayData) return;
    const gen = (state.mealSaveGen = (state.mealSaveGen || 0) + 1);
    dayData.localSaveGen = gen;
    const live = findLiveDay(state, dayData.date);
    if (live && live !== dayData) live.localSaveGen = gen;
  }

  function copyDayWrite(target, source) {
    if (!target || !source || target === source) return;
    target.tag = source.tag;
    target.tagColor = source.tagColor;
    target.isBusinessTrip = source.isBusinessTrip;
    target.pfc = source.pfc;
    target.meals = source.meals;
    target.localSaveGen = source.localSaveGen;
  }

  function applyOfflineDemo(state) {
    const W = Week();
    const templates = KitchenGit.demoMealDays ? KitchenGit.demoMealDays() : [];
    const weekStart = state.demoWeekStart || state.weekStart;
    if (!weekStart || !templates.length) return;
    state.weeksByStart[weekStart] = W.applyTemplateToWeek(weekStart, templates);
    if (state.weekStart === weekStart) {
      state.calendarDays = state.weeksByStart[weekStart];
    }
  }

  async function hydrateWeek(state, weekStart) {
    const daysAtStart = ensureWeek(state, weekStart);
    const snapshotGens = {};
    daysAtStart.forEach((day) => {
      snapshotGens[day.date] = day.localSaveGen || 0;
    });
    const DB = KitchenGit.MealsDB;
    if (!DB || !DB.isReady()) {
      if (weekStart === state.demoWeekStart) applyOfflineDemo(state);
      ensureWeek(state, weekStart).forEach((d) => { state.allDaysMap[d.date] = d; });
      return;
    }
    try {
      const rows = await DB.fetchRange(weekStart);
      const daysNow = ensureWeek(state, weekStart);
      const merged = mergeRowsIntoWeek(daysNow, rows, snapshotGens);
      state.weeksByStart[weekStart] = merged;
      merged.forEach((d) => { state.allDaysMap[d.date] = d; });
      if (state.weekStart === weekStart) state.calendarDays = merged;
    } catch (e) {
      console.error(e);
      if (weekStart === state.demoWeekStart && !Meals().weekHasAnyMeal(ensureWeek(state, weekStart))) {
        applyOfflineDemo(state);
      }
      ensureWeek(state, weekStart).forEach((d) => { state.allDaysMap[d.date] = d; });
    }
  }

  async function hydrateMonth(state, year, month) {
    const DB = KitchenGit.MealsDB;
    if (!DB || !DB.isReady() || !DB.fetchMonthRange) return;
    try {
      const rows = await DB.fetchMonthRange(year, month);
      rows.forEach((row) => {
        if (row && row.date) {
          state.allDaysMap[row.date] = row;
        }
      });
    } catch (e) {
      console.error('hydrateMonth failed', e);
    }
  }

  async function loadFromCloud(state) {
    const DB = KitchenGit.MealsDB;
    const ready = DB && DB.init();
    if (!ready) {
      applyOfflineDemo(state);
      return false;
    }
    try {
      await DB.seedIfEmpty();
      await hydrateWeek(state, state.weekStart);
      return true;
    } catch (e) {
      console.error(e);
      applyOfflineDemo(state);
      return false;
    }
  }

  async function persistDay(state, dayData) {
    const DB = KitchenGit.MealsDB;
    if (!dayData) return false;
    touchDay(state, dayData);
    if (!DB || !DB.isReady()) {
      copyDayWrite(findLiveDay(state, dayData.date) || dayData, dayData);
      state.allDaysMap[dayData.date] = dayData;
      render(state);
      return true;
    }
    const dateStr = dayData.date;
    try {
      const saved = await DB.upsertDay(dayData);
      const live = findLiveDay(state, dateStr) || dayData;
      if (saved && saved.id) {
        live.id = saved.id;
        dayData.id = saved.id;
      }
      copyDayWrite(live, dayData);
      state.allDaysMap[dayData.date] = dayData;
      render(state);
      return true;
    } catch (e) {
      console.error(e);
      if (hooks.showToast) hooks.showToast('クラウドへ保存できませんでした', 'error');
      return false;
    }
  }

  function init(state, options) {
    hooks = options || {};
    const W = Week();
    const today = new Date();
    const thisStart = W.toIsoDate(W.startOfWeekSaturday(today));
    state.demoWeekStart = thisStart;
    state.weekStart = thisStart;
    state.weeksByStart = {};
    state.prepByWeekStart = {};
    state.mealSaveGen = 0;
    state.expandedDays = {};
    state.calendarViewMode = state.calendarViewMode || 'list';
    state.monthlyYear = state.monthlyYear || today.getFullYear();
    state.monthlyMonth = state.monthlyMonth !== undefined ? state.monthlyMonth : today.getMonth();
    state.allDaysMap = state.allDaysMap || {};
    state.calendarDays = ensureWeek(state, thisStart);
    state.calendarDays.forEach((d) => { state.allDaysMap[d.date] = d; });
    const todayIso = W.toIsoDate(today);
    state.selectedDate = state.calendarDays.some((d) => d.date === todayIso)
      ? todayIso
      : state.calendarDays[0].date;
    if (state.calendarDays.some((d) => d.date === todayIso)) {
      state.expandedDays[todayIso] = true;
    }
    return state;
  }

  function setDisplayedWeek(state, weekStart, options) {
    const W = Week();
    const M = Meals();
    const opts = options || {};
    const keepWeekday = opts.weekdayIndex != null
      ? opts.weekdayIndex
      : W.weekdayIndex(state.selectedDate || weekStart);
    const index = Math.min(Math.max(keepWeekday, 0), 6);
    state.weekStart = weekStart;
    state.calendarDays = ensureWeek(state, weekStart);
    state.expandedDays = {};
    if (opts.selectToday) {
      const todayIso = W.toIsoDate(new Date());
      const found = M.findDay(state.calendarDays, todayIso);
      state.selectedDate = found ? todayIso : state.calendarDays[index].date;
      if (found) state.expandedDays[todayIso] = true;
    } else {
      state.selectedDate = state.calendarDays[index].date;
    }
  }

  function shiftWeek(state, deltaDays) {
    const W = Week();
    const weekday = W.weekdayIndex(state.selectedDate || state.weekStart);
    setDisplayedWeek(state, W.toIsoDate(W.addDays(state.weekStart, deltaDays)), { weekdayIndex: weekday });
  }

  function goToThisWeek(state) {
    const W = Week();
    setDisplayedWeek(state, W.toIsoDate(W.startOfWeekSaturday(new Date())), { selectToday: true });
    setTimeout(() => {
      const todayIso = W.toIsoDate(new Date());
      const el = document.getElementById(W.dayDomId(todayIso));
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
  }

  function applyAiSuggestion(state) {
    const M = Meals();
    const emptyDinner = state.calendarDays.find((d) => !M.isMealFilled(M.slotOf(d, 'dinner')));
    const saturday = state.calendarDays.find((d) => d.day === '土');
    const target = emptyDinner || saturday || state.calendarDays[state.calendarDays.length - 1];
    if (!target) return null;
    M.writeMealItems(target, 'dinner', AI_DINNER.items);
    target.tag = AI_DINNER.tag;
    target.tagColor = AI_DINNER.tagColor;
    target.pfc = AI_DINNER.pfc;
    touchDay(state, target);
    state.selectedDate = target.date;
    return target;
  }

  function toggleSlotServings(state, dateStr, slotKey) {
    const M = Meals();
    if (dateStr) state.selectedDate = dateStr;
    const dayData = M.findDay(state.calendarDays, dateStr || state.selectedDate);
    if (!dayData || !slotKey) return null;
    M.toggleSlotServings(dayData, slotKey);
    return { dayData, slotKey };
  }

  function slotServingsButtonHtml(dateStr, meta, slot) {
    const M = Meals();
    const servings = M.slotServings(slot);
    return `
      <button type="button" onclick="event.stopPropagation(); toggleSlotServings('${M.escapeHtml(dateStr)}','${meta.key}')" class="active-scale text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all flex items-center gap-0.5 shrink-0 ${
        servings === 1
          ? 'bg-amber-500 text-white border-amber-500'
          : 'bg-white text-slate-600 border-slate-200'
      }" aria-label="${M.escapeHtml(meta.label)} ${servings}人分">
        <i class="fa-solid ${servings === 1 ? 'fa-user' : 'fa-user-group'} text-[8px]"></i>
        <span>${servings}</span>
      </button>
    `;
  }

  function emptyWeekCtaHtml() {
    return `
      <div class="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-3 space-y-2">
        <p class="text-xs font-bold text-slate-800">献立が未登録です</p>
        <p class="text-[11px] text-slate-500 leading-relaxed">この週の献立はまだありません。AIに提案してもらうか、レシピから登録できます。</p>
        <div class="flex flex-col gap-1.5">
          <button type="button" onclick="aiSuggestRemaining()" class="active-scale w-full bg-emerald-600 text-white text-[11px] font-bold py-2 rounded-xl">
            <i class="fa-solid fa-wand-magic-sparkles mr-1"></i>AIに今週の献立を提案してもらう
          </button>
          <button type="button" onclick="openRegisterFromCalendar()" class="active-scale w-full bg-white text-slate-800 text-[11px] font-bold py-2 rounded-xl border border-slate-200">
            + レシピを登録する
          </button>
        </div>
      </div>
    `;
  }

  function recipesOf(state) {
    return (hooks.getRecipes && hooks.getRecipes()) || state.recipes || [];
  }

  function pfcBlockHtml(state, dayData) {
    const M = Meals();
    const computed = M.computeDayPfc(dayData, recipesOf(state));
    const pfc = computed || dayData.pfc;
    if (!pfc) return '';
    return `
      <div class="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
        <span>P: <strong class="text-rose-600 font-bold">${pfc.p}g</strong></span>
        <span>F: <strong class="text-amber-600 font-bold">${pfc.f}g</strong></span>
        <span>C: <strong class="text-sky-600 font-bold">${pfc.c}g</strong></span>
      </div>
    `;
  }

  function isDayExpanded(state, dateStr) {
    if (state.expandedDays && state.expandedDays[dateStr] !== undefined) {
      return state.expandedDays[dateStr];
    }
    const M = Meals();
    const W = Week();
    const dayData = M.findDay(state.calendarDays, dateStr);
    const hasMeal = dayData ? M.weekHasAnyMeal([dayData]) : false;
    const todayIso = W.toIsoDate(new Date());
    return hasMeal || dateStr === todayIso;
  }

  function setDayExpanded(state, dateStr, expanded) {
    if (!state.expandedDays) state.expandedDays = {};
    if (expanded) state.expandedDays[dateStr] = true;
    else delete state.expandedDays[dateStr];
  }

  function toggleDayExpanded(state, dateStr) {
    setDayExpanded(state, dateStr, !isDayExpanded(state, dateStr));
    state.selectedDate = dateStr;
  }

  function expandAllDays(state) {
    if (!state.expandedDays) state.expandedDays = {};
    (state.calendarDays || []).forEach((day) => {
      state.expandedDays[day.date] = true;
    });
  }

  function collapseAllDays(state) {
    state.expandedDays = {};
  }

  function mealSlotIndicatorHtml(dayData, meta) {
    const M = Meals();
    const filled = M.isMealFilled(M.slotOf(dayData, meta.key));
    const iconColors = {
      breakfast: filled ? 'text-amber-600 bg-amber-50 border-amber-200' : 'text-slate-300 bg-slate-50 border-slate-200/60 opacity-50',
      lunch: filled ? 'text-sky-600 bg-sky-50 border-sky-200' : 'text-slate-300 bg-slate-50 border-slate-200/60 opacity-50',
      dinner: filled ? 'text-indigo-600 bg-indigo-50 border-indigo-200' : 'text-slate-300 bg-slate-50 border-slate-200/60 opacity-50'
    };
    const status = filled ? '設定済み' : '未設定';
    return `<span class="inline-flex items-center justify-center w-4 h-4 rounded-full border ${iconColors[meta.key] || 'text-slate-400'}" title="${meta.label}: ${status}" aria-label="${meta.label}${status}"><span class="material-symbols-outlined text-[10px] leading-none" aria-hidden="true">${meta.icon}</span></span>`;
  }

  function slotBadgeHtml(meta) {
    const labelColor = {
      breakfast: 'text-amber-800 bg-amber-100/90 border-amber-200',
      lunch: 'text-sky-800 bg-sky-100/90 border-sky-200',
      dinner: 'text-indigo-800 bg-indigo-100/90 border-indigo-200'
    }[meta.key] || 'text-slate-800 bg-slate-100 border-slate-200';

    return `
      <div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-xl border ${labelColor} shrink-0 shadow-2xs">
        <span class="w-5 h-5 rounded-full ${meta.badge} inline-flex items-center justify-center">
          <span class="material-symbols-outlined text-[13px] leading-none" aria-hidden="true">${meta.icon}</span>
        </span>
        <span class="text-[11px] font-bold tracking-tight">${meta.label}</span>
      </div>
    `;
  }

  function dayCardHeaderHtml(state, dayData) {
    const M = Meals();
    const escapeHtml = M.escapeHtml;
    const dateStr = dayData.date;
    const expanded = isDayExpanded(state, dateStr);
    const indicators = expanded
      ? ''
      : `<span class="flex items-center gap-1.5">${Meals().MEAL_SLOTS.map((meta) => mealSlotIndicatorHtml(dayData, meta)).join('')}</span>`;
    const chevron = expanded ? 'fa-chevron-down' : 'fa-chevron-right';
    return `
      <button type="button" onclick="toggleDayAccordion('${escapeHtml(dateStr)}')" aria-expanded="${expanded ? 'true' : 'false'}" class="active-scale w-full flex items-center justify-between gap-2 text-left -mx-0.5 px-0.5 py-0.5 rounded-xl">
        <span class="text-xs font-bold text-slate-900">${escapeHtml(displayDateOf(dayData))} (${escapeHtml(dayData.day)})</span>
        <span class="flex items-center gap-2 shrink-0">
          ${indicators}
          <i class="fa-solid ${chevron} text-[11px] text-slate-400" aria-hidden="true"></i>
        </span>
      </button>
    `;
  }

  function mealSlotRowHtml(state, dayData, meta, options) {
    const M = Meals();
    const dateStr = (options && options.date) || dayData.date;
    const slot = M.slotOf(dayData, meta.key);
    const filled = M.isMealFilled(slot);
    const isMemo = M.isMemoSlot(slot);
    const items = M.mealItems(slot);
    const prepChip = filled && !isMemo && isPrepMealSlot(state, slot)
      ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">作り置き</span>'
      : '';
    const openFn = `openMealEditor('${M.escapeHtml(dateStr)}','${meta.key}')`;
    const badgeHtml = slotBadgeHtml(meta);

    const slotContainerClass = {
      breakfast: filled ? 'bg-amber-50/70 border-amber-200/90' : 'bg-amber-50/30 border-dashed border-amber-200/70 hover:border-amber-400',
      lunch: filled ? 'bg-sky-50/70 border-sky-200/90' : 'bg-sky-50/30 border-dashed border-sky-200/70 hover:border-sky-400',
      dinner: filled ? 'bg-indigo-50/70 border-indigo-200/90' : 'bg-indigo-50/30 border-dashed border-indigo-200/70 hover:border-indigo-400'
    }[meta.key] || 'bg-slate-50 border-slate-200/70';

    if (isMemo) {
      const label = M.slotDisplayLabel(slot);
      return `
        <div class="bg-amber-50/80 border border-amber-200/90 rounded-2xl p-2.5 flex items-start justify-between gap-2 shadow-2xs">
          <div onclick="${openFn}" class="flex items-start gap-2.5 min-w-0 pr-1 cursor-pointer flex-1">
            <div class="mt-0.5">${badgeHtml}</div>
            <p class="text-xs font-bold text-amber-900 truncate mt-1">${M.escapeHtml(label)}</p>
          </div>
          <div class="flex items-center gap-1 shrink-0 mt-0.5">
            <button type="button" onclick="${openFn}" class="active-scale px-2.5 py-1.5 rounded-xl bg-white border border-amber-300 text-amber-800 text-[10px] font-bold flex items-center gap-1 hover:bg-amber-100 shadow-2xs" title="献立を編集">
              <i class="fa-solid fa-pen text-[9px]"></i>
              <span>編集</span>
            </button>
          </div>
        </div>
      `;
    }

    if (!filled) {
      return `
        <div class="${slotContainerClass} rounded-2xl p-2.5 flex items-center justify-between gap-2 border shadow-2xs transition-all">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            ${badgeHtml}
            <span class="text-xs text-slate-400 font-medium pl-0.5">未設定</span>
          </div>
          <button type="button" onclick="${openFn}" class="active-scale px-3 py-1.5 rounded-xl bg-white hover:bg-emerald-50 border border-slate-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5 shadow-2xs shrink-0 transition-colors" title="献立を登録">
            <i class="fa-solid fa-plus text-xs"></i>
            <span>登録</span>
          </button>
        </div>
      `;
    }

    const recipes = recipesOf(state);
    const itemsHtml = items.map((item) => {
      const recipe = M.findRecipeForItem(recipes, item);
      const recipeId = recipe ? recipe.id : (item.recipeId || '');
      const imgUrl = M.recipeImageUrl(recipe);
      const imgHtml = imgUrl
        ? `<img src="${M.escapeHtml(imgUrl)}" alt="${M.escapeHtml(item.title)}" class="w-10 h-10 rounded-xl object-cover shrink-0 bg-slate-100 border border-slate-200/80 shadow-2xs group-hover:scale-105 transition-transform">`
        : `<div class="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-200/80 flex items-center justify-center shrink-0 shadow-2xs"><i class="fa-solid fa-utensils text-xs"></i></div>`;
      const clickAction = `onclick="event.stopPropagation(); openRecipeByCalendarClick('${M.escapeHtml(recipeId)}', '${M.escapeHtml(item.title)}')"`;
      return `
        <div ${clickAction} class="flex items-center gap-2.5 group cursor-pointer py-1" title="レシピを開く">
          ${imgHtml}
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold text-slate-900 truncate group-hover:text-emerald-700 group-hover:underline">${M.escapeHtml(item.title)}</p>
            ${recipe && recipe.tag ? `<span class="text-[9px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded inline-block mt-0.5">${M.escapeHtml(recipe.tag)}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');

    return `
      <div class="${slotContainerClass} rounded-2xl p-2.5 flex items-start justify-between gap-2 border shadow-2xs transition-all">
        <div class="flex items-start gap-2.5 min-w-0 pr-1 flex-1">
          <div class="mt-0.5">${badgeHtml}</div>
          <div class="min-w-0 space-y-1 flex-1 pt-0.5">${itemsHtml}</div>
        </div>
        <div class="flex items-center gap-1.5 shrink-0 mt-0.5">
          ${prepChip}
          ${slotServingsButtonHtml(dateStr, meta, slot)}
          <button type="button" onclick="${openFn}" class="active-scale px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 hover:bg-slate-100 shadow-2xs" title="献立を編集" aria-label="献立を編集">
            <i class="fa-solid fa-pen text-[9px] text-emerald-600"></i>
            <span>編集</span>
          </button>
        </div>
      </div>
    `;
  }

  function renderMealSlots(state, dayData, options) {
    const rows = Meals().MEAL_SLOTS.map((meta) => mealSlotRowHtml(state, dayData, meta, options)).join('');
    return `<div class="space-y-1.5">${rows}</div>`;
  }

  function renderWeekNav(state) {
    const W = Week();
    const title = document.getElementById('week-plan-title');
    const range = document.getElementById('week-range-label');
    if (title) title.textContent = W.relativeWeekTitle(state.weekStart);
    if (range) range.textContent = W.formatWeekRangeLabel(state.weekStart);
  }

  function renderWeekOverview(state) {
    const M = Meals();
    const box = document.getElementById('week-overview');
    if (!box) return;
    const emptyBanner = M.weekHasAnyMeal(state.calendarDays) ? '' : `<div>${emptyWeekCtaHtml()}</div>`;
    const W = Week();
    box.innerHTML = emptyBanner + state.calendarDays.map((dayData) => {
      const selected = dayData.date === state.selectedDate;
      const expanded = isDayExpanded(state, dayData.date);
      const bodyHtml = expanded
        ? `${renderMealSlots(state, dayData, { compact: true, date: dayData.date })}${pfcBlockHtml(state, dayData)}`
        : '';
      return `
        <div id="${W.dayDomId(dayData.date)}" class="bg-white rounded-3xl p-3.5 shadow-sm border ${
          expanded ? 'space-y-2.5' : ''
        } ${selected && expanded ? 'border-emerald-300 ring-2 ring-emerald-500/20' : 'border-slate-200/60'}">
          ${dayCardHeaderHtml(state, dayData)}
          ${bodyHtml ? `<div class="space-y-2.5">${bodyHtml}</div>` : ''}
        </div>
      `;
    }).join('');
  }

  const CALENDAR_SEARCH_CHIPS = ['すべて', '鶏肉', '豚肉', '魚', '豆腐', '卵', '野菜', '定番', '汁物'];

  function renderCalendarSearchChips(state) {
    const container = document.getElementById('calendar-search-chips');
    if (!container) return;
    const currentQuery = (state.calendarRecipeSearchQuery || '').trim();
    container.innerHTML = CALENDAR_SEARCH_CHIPS.map((chip) => {
      const isAll = chip === 'すべて';
      const isActive = isAll ? !currentQuery : currentQuery === chip;
      const cls = isActive
        ? 'bg-emerald-600 text-white font-bold px-2.5 py-1 rounded-full shadow-2xs border border-emerald-600 active-scale whitespace-nowrap text-[11px]'
        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200/80 px-2.5 py-1 rounded-full active-scale whitespace-nowrap text-[11px]';
      return `
        <button type="button" data-chip="${Meals().escapeHtml(chip)}" onclick="applyCalendarSearchChip(this.dataset.chip)" class="${cls}">
          ${Meals().escapeHtml(chip)}
        </button>
      `;
    }).join('');
  }

  function renderCalendarSearch(state) {
    const M = Meals();
    const W = Week();
    const clearBtn = document.getElementById('calendar-recipe-search-clear');
    const resultsPanel = document.getElementById('calendar-search-results');
    const countBadge = document.getElementById('calendar-search-count-badge');
    if (!resultsPanel) return;

    renderCalendarSearchChips(state);

    const query = (state.calendarRecipeSearchQuery || '').trim();
    if (clearBtn) clearBtn.classList.toggle('hidden', !query);

    if (!query) {
      resultsPanel.classList.add('hidden');
      resultsPanel.innerHTML = '';
      if (countBadge) countBadge.textContent = '';
      return;
    }

    const recipes = hooks.getRecipes ? hooks.getRecipes() : (state.recipes || []);
    const matchesList = [];
    recipes.forEach((recipe) => {
      const details = M.recipeMatchesQueryDetails
        ? M.recipeMatchesQueryDetails(recipe, query)
        : { matches: M.recipeMatchesQuery(recipe, query), matchedIngredients: [], tokens: [] };
      if (details.matches) {
        matchesList.push({ recipe, details });
      }
    });

    if (countBadge) {
      countBadge.textContent = `${matchesList.length}件ヒット`;
    }

    resultsPanel.classList.remove('hidden');

    if (!matchesList.length) {
      resultsPanel.innerHTML = `
        <div class="bg-slate-50 border border-dashed border-slate-200 rounded-2xl p-3 text-center space-y-1.5">
          <p class="text-xs font-bold text-slate-700">「${M.escapeHtml(query)}」に一致するレシピはありません</p>
          <p class="text-[10px] text-slate-400">材料名（例: 鶏肉, 生姜, 豆腐）や料理名で検索してください</p>
          <button type="button" onclick="clearCalendarRecipeSearch()" class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-xl hover:bg-emerald-100 active-scale mt-1">
            <i class="fa-solid fa-rotate-left text-[10px]"></i>
            <span>検索をクリア</span>
          </button>
        </div>
      `;
      return;
    }

    const weekDays = state.calendarDays || ensureWeek(state, state.weekStart);

    resultsPanel.innerHTML = matchesList.map(({ recipe, details }) => {
      const allIngredients = M.getRecipeIngredients ? M.getRecipeIngredients(recipe) : [];
      const ingNames = allIngredients.map((i) => i.name).filter(Boolean);
      const matchedIngs = details.matchedIngredients || [];

      let displayName = M.escapeHtml(recipe.name);
      if (query && details.tokens && details.tokens.length) {
        details.tokens.forEach((tok) => {
          if (!tok) return;
          const re = new RegExp(`(${String(tok).replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
          displayName = displayName.replace(re, '<mark class="bg-amber-200 text-amber-950 font-bold px-0.5 rounded">$1</mark>');
        });
      }

      let ingredientsPreview = '';
      if (matchedIngs.length > 0) {
        ingredientsPreview = `
          <div class="mt-1 flex items-center gap-1 flex-wrap text-[11px]">
            <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">一致した材料:</span>
            ${matchedIngs.map((ing) => `
              <span class="text-[10px] font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 px-1.5 py-0.5 rounded-full flex items-center gap-1">
                <i class="fa-solid fa-check text-[8px] text-emerald-600"></i>${M.escapeHtml(ing)}
              </span>
            `).join('')}
          </div>
        `;
      } else if (ingNames.length > 0) {
        ingredientsPreview = `
          <p class="mt-1 text-[10.5px] text-slate-500 line-clamp-1">
            <span class="font-bold text-slate-600">材料:</span> ${M.escapeHtml(ingNames.slice(0, 5).join('、'))}${ingNames.length > 5 ? '…' : ''}
          </p>
        `;
      }

      const tagBadge = recipe.tag
        ? `<span class="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">${M.escapeHtml(recipe.tag)}</span>`
        : '';
      const pfcBadge = recipe.pfc && recipe.pfc.kcal
        ? `<span class="text-[9px] font-mono text-slate-400">${Math.round(recipe.pfc.kcal)} kcal</span>`
        : '';

      return `
        <div class="bg-slate-50/80 border border-slate-200 rounded-2xl p-2.5 space-y-2">
          <div class="flex items-start justify-between gap-2">
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-1.5 mb-1 flex-wrap">
                ${tagBadge}
                ${pfcBadge}
              </div>
              <h4 class="text-xs font-bold text-slate-900 leading-snug">${displayName}</h4>
              ${ingredientsPreview}
            </div>
            <button type="button" data-recipe-id="${M.escapeHtml(recipe.id)}" onclick="showRecipeDetailFromCalendar(this.dataset.recipeId)" title="レシピ詳細を見る" class="shrink-0 w-7 h-7 rounded-xl bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 flex items-center justify-center text-xs active-scale">
              <i class="fa-solid fa-book-open"></i>
            </button>
          </div>

          <!-- 今週の枠へ追加するクイックボタン -->
          <div class="pt-1.5 border-t border-slate-200/60">
            <div class="flex items-center justify-between mb-1">
              <span class="text-[10px] font-bold text-slate-500">今週の夕食枠に追加:</span>
              <span class="text-[10px] text-slate-400">タップで即時登録</span>
            </div>
            <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
              ${weekDays.map((day) => {
                const daySlot = M.slotOf(day, 'dinner');
                const isFilled = M.isMealFilled(daySlot);
                const hasThis = M.mealItems(daySlot).some((it) => it.title === recipe.name || it.recipeId === recipe.id);
                return `
                  <button type="button" data-date="${M.escapeHtml(day.date)}" data-recipe-id="${M.escapeHtml(recipe.id)}" data-recipe-name="${M.escapeHtml(recipe.name)}" onclick="assignRecipeToDayDinner(this.dataset.date, this.dataset.recipeId, this.dataset.recipeName)" class="shrink-0 text-[10px] font-bold px-2 py-1 rounded-xl transition-all active-scale ${
                    hasThis
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : isFilled
                      ? 'bg-white text-slate-700 border border-slate-200 hover:border-emerald-400'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  }">
                    ${hasThis ? '✓ ' : '+ '}${W.formatMd(day.date)} (${day.day})${hasThis ? '追加済' : ''}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderMonthlyCalendar(state) {
    const W = Week();
    const M = Meals();
    const year = state.monthlyYear;
    const month = state.monthlyMonth;

    const titleEl = document.getElementById('monthly-title-label');
    if (titleEl) titleEl.textContent = `${year}年 ${month + 1}月`;

    const btnList = document.getElementById('cal-view-btn-list');
    const btnMonthly = document.getElementById('cal-view-btn-monthly');
    const listNav = document.getElementById('calendar-list-nav-wrap');
    const monthlyNav = document.getElementById('calendar-monthly-nav-wrap');
    const listContainer = document.getElementById('calendar-list-view-container');
    const monthlyContainer = document.getElementById('calendar-monthly-view-container');

    const isMonthly = state.calendarViewMode === 'monthly';

    if (btnList) {
      btnList.className = isMonthly
        ? 'active-scale px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-slate-600 hover:text-slate-900'
        : 'active-scale px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-white text-slate-900 shadow-xs';
    }
    if (btnMonthly) {
      btnMonthly.className = isMonthly
        ? 'active-scale px-3 py-1.5 rounded-xl text-xs font-bold transition-all bg-white text-slate-900 shadow-xs'
        : 'active-scale px-3 py-1.5 rounded-xl text-xs font-bold transition-all text-slate-600 hover:text-slate-900';
    }

    if (listNav) listNav.classList.toggle('hidden', isMonthly);
    if (monthlyNav) monthlyNav.classList.toggle('hidden', !isMonthly);
    if (listContainer) listContainer.classList.toggle('hidden', isMonthly);
    if (monthlyContainer) monthlyContainer.classList.toggle('hidden', !isMonthly);

    if (!isMonthly) return;

    const gridEl = document.getElementById('monthly-calendar-grid');
    if (!gridEl) return;

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const cells = [];
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevLastDay - i;
      const m = month === 0 ? 11 : month - 1;
      const y = month === 0 ? year - 1 : year;
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, currentMonth: false, date: dateStr });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ day: d, currentMonth: true, date: dateStr });
    }

    let nextDay = 1;
    while (cells.length % 7 !== 0) {
      const m = month === 11 ? 0 : month + 1;
      const y = month === 11 ? year + 1 : year;
      const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(nextDay).padStart(2, '0')}`;
      cells.push({ day: nextDay, currentMonth: false, date: dateStr });
      nextDay++;
    }

    const todayIso = W.toIsoDate(new Date());

    gridEl.innerHTML = cells.map(cell => {
      const dayData = state.allDaysMap[cell.date];
      const isToday = cell.date === todayIso;
      const isSelected = cell.date === state.selectedDate;

      let filledCount = 0;
      let dinnerTitle = '';
      let dinnerImgUrl = '';
      if (dayData && dayData.meals) {
        M.MEAL_SLOTS.forEach(meta => {
          if (M.isMealFilled(M.slotOf(dayData, meta.key))) filledCount++;
        });
        const dinnerSlot = M.slotOf(dayData, 'dinner');
        if (M.isMealFilled(dinnerSlot)) {
          const items = M.mealItems(dinnerSlot);
          if (items.length > 0) {
            dinnerTitle = items[0].title;
            const recipes = recipesOf(state);
            const recipe = M.findRecipeForItem(recipes, items[0]);
            dinnerImgUrl = M.recipeImageUrl(recipe);
          }
        }
      }

      let cellClass = 'min-h-[72px] rounded-2xl p-1.5 flex flex-col justify-between border transition-all active-scale cursor-pointer ';
      if (isSelected) {
        cellClass += 'bg-emerald-50 border-emerald-400 ring-1 ring-emerald-500/30 shadow-xs';
      } else if (isToday) {
        cellClass += 'bg-emerald-50/50 border-emerald-300';
      } else if (cell.currentMonth) {
        cellClass += 'bg-white border-slate-200/80 hover:border-slate-300';
      } else {
        cellClass += 'bg-slate-50/60 border-slate-100 opacity-60';
      }

      const dObj = W.localDate(cell.date);
      const wday = dObj.getDay();
      let numColor = cell.currentMonth ? 'text-slate-800' : 'text-slate-400';
      if (wday === 0) numColor = cell.currentMonth ? 'text-rose-600' : 'text-rose-300';
      if (wday === 6) numColor = cell.currentMonth ? 'text-sky-600' : 'text-sky-300';

      const dotsHtml = filledCount > 0
        ? `<div class="flex items-center gap-0.5 mt-0.5">
             <span class="text-[9px] font-mono font-bold text-emerald-700 bg-emerald-100 px-1 rounded">${filledCount}/3食</span>
           </div>`
        : `<span class="text-[9px] text-slate-300">—</span>`;

      const titleHtml = dinnerImgUrl
        ? `<div class="mt-1 flex items-center gap-1 bg-slate-50 rounded-lg p-0.5 border border-slate-200/60 overflow-hidden" title="${M.escapeHtml(dinnerTitle)}">
             <img src="${M.escapeHtml(dinnerImgUrl)}" alt="" class="w-4 h-4 rounded object-cover shrink-0">
             <span class="text-[8.5px] font-bold text-slate-700 truncate">${M.escapeHtml(dinnerTitle)}</span>
           </div>`
        : (dinnerTitle ? `<p class="text-[9px] font-bold text-slate-700 truncate mt-0.5" title="${M.escapeHtml(dinnerTitle)}">${M.escapeHtml(dinnerTitle)}</p>` : '');

      return `
        <div data-date="${cell.date}" onclick="jumpToDateFromMonthly('${cell.date}')" class="${cellClass}">
          <div class="flex items-center justify-between">
            <span class="text-xs font-bold font-mono ${numColor}">${cell.day}</span>
            ${isToday ? '<span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>' : ''}
          </div>
          <div class="space-y-0.5 min-w-0">
            ${dotsHtml}
            ${titleHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  function render(state) {
    renderWeekNav(state);
    renderCalendarSearch(state);
    renderWeekOverview(state);
    renderMonthlyCalendar(state);
  }

  function scrollToDay(dateStr) {
    requestAnimationFrame(() => {
      const el = document.getElementById(Week().dayDomId(dateStr));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function bindGlobals(state) {
    window.clearCalendarRecipeSearch = function () {
      state.calendarRecipeSearchQuery = '';
      const input = document.getElementById('calendar-recipe-search-input');
      if (input) input.value = '';
      renderCalendarSearch(state);
    };

    window.applyCalendarSearchChip = function (chip) {
      if (chip === 'すべて') {
        state.calendarRecipeSearchQuery = '';
      } else if ((state.calendarRecipeSearchQuery || '').trim() === chip) {
        state.calendarRecipeSearchQuery = '';
      } else {
        state.calendarRecipeSearchQuery = chip;
      }
      const input = document.getElementById('calendar-recipe-search-input');
      if (input) input.value = state.calendarRecipeSearchQuery;
      renderCalendarSearch(state);
    };

    window.assignRecipeToDayDinner = async function (dateStr, recipeId, recipeName) {
      const M = Meals();
      const W = Week();
      const dayData = M.findDayInState(state, dateStr);
      if (!dayData) return;
      const slot = M.ensureMealSlot(dayData, 'dinner');
      const existing = M.mealItems(slot);
      const isAlready = existing.some((it) => it.title === recipeName || it.recipeId === recipeId);
      if (isAlready) {
        if (hooks.showToast) hooks.showToast('すでにこの枠に登録されています');
        return;
      }
      const newItems = existing.concat([{ title: recipeName, recipeId, type: 'recipe' }]);
      M.writeMealItems(slot, newItems);
      touchDay(state, dayData);
      render(state);
      await persistDay(state, dayData);
      if (hooks.onShoppingRefresh) hooks.onShoppingRefresh();
      if (hooks.showToast) hooks.showToast(`「${recipeName}」を ${W.formatMd(dateStr)} (${dayData.day}) の夕食に追加しました`);
    };

    window.showRecipeDetailFromCalendar = function (recipeId) {
      if (typeof window.switchTab === 'function') window.switchTab('recipe');
      if (typeof window.showRecipeDetail === 'function') window.showRecipeDetail(recipeId);
    };

    window.openRecipeByCalendarClick = function (recipeId, title) {
      const recipes = recipesOf(state);
      let found = null;
      if (recipeId) {
        found = recipes.find((r) => r.id === recipeId);
      }
      if (!found && title) {
        found = recipes.find((r) => r.name === title || (r.name || '').includes(title) || title.includes(r.name || ''));
      }
      if (found && found.id) {
        if (typeof window.switchTab === 'function') window.switchTab('recipe');
        if (typeof window.showRecipeDetail === 'function') window.showRecipeDetail(found.id);
      } else if (recipeId) {
        if (typeof window.switchTab === 'function') window.switchTab('recipe');
        if (typeof window.showRecipeDetail === 'function') window.showRecipeDetail(recipeId);
      } else if (title) {
        if (hooks.showToast) hooks.showToast(`「${title}」のレシピはまだ登録されていません`);
      }
    };

    const calSearchInput = document.getElementById('calendar-recipe-search-input');
    if (calSearchInput) {
      calSearchInput.addEventListener('input', function () {
        state.calendarRecipeSearchQuery = this.value || '';
        renderCalendarSearch(state);
      });
    }

    window.shiftWeek = async function (deltaDays) {
      shiftWeek(state, deltaDays);
      render(state);
      await hydrateWeek(state, state.weekStart);
      render(state);
      if (hooks.onShoppingRefresh) hooks.onShoppingRefresh();
    };
    window.goToThisWeek = async function () {
      goToThisWeek(state);
      render(state);
      await hydrateWeek(state, state.weekStart);
      render(state);
      if (hooks.onShoppingRefresh) hooks.onShoppingRefresh();
    };
    window.aiSuggestRemaining = async function () {
      const target = applyAiSuggestion(state);
      render(state);
      if (target) await persistDay(state, target);
      if (target) scrollToDay(target.date);
      if (hooks.onShoppingRefresh) hooks.onShoppingRefresh();
    };
    window.openRegisterFromCalendar = function () {
      if (hooks.onRegisterRecipe) hooks.onRegisterRecipe();
    };
    window.toggleSlotServings = async function (dateStr, slotKey) {
      const result = toggleSlotServings(state, dateStr, slotKey);
      if (!result) return;
      const { dayData, slotKey: key } = result;
      if (key === 'dinner' && Meals().isChickenDinner(dayData) && hooks.onChickenServingsChange) {
        hooks.onChickenServingsChange(dayData, key);
      }
      render(state);
      await persistDay(state, dayData);
      if (hooks.onShoppingRefresh) hooks.onShoppingRefresh();
    };
    window.renderCalendar = function () {
      render(state);
    };
    window.toggleDayAccordion = function (dateStr) {
      toggleDayExpanded(state, dateStr);
      render(state);
    };
    window.expandAllDays = function () {
      expandAllDays(state);
      render(state);
    };
    window.collapseAllDays = function () {
      collapseAllDays(state);
      render(state);
    };

    window.setCalendarViewMode = async function (mode) {
      state.calendarViewMode = mode;
      if (mode === 'monthly') {
        await hydrateMonth(state, state.monthlyYear, state.monthlyMonth);
      }
      render(state);
    };

    window.shiftMonthlyMonth = async function (delta) {
      state.monthlyMonth += delta;
      if (state.monthlyMonth > 11) {
        state.monthlyMonth = 0;
        state.monthlyYear += 1;
      } else if (state.monthlyMonth < 0) {
        state.monthlyMonth = 11;
        state.monthlyYear -= 1;
      }
      await hydrateMonth(state, state.monthlyYear, state.monthlyMonth);
      render(state);
    };

    window.goToCurrentMonth = async function () {
      const now = new Date();
      state.monthlyYear = now.getFullYear();
      state.monthlyMonth = now.getMonth();
      await hydrateMonth(state, state.monthlyYear, state.monthlyMonth);
      render(state);
    };

    window.jumpToDateFromMonthly = async function (dateStr) {
      const W = Week();
      const saturdayStart = W.toIsoDate(W.startOfWeekSaturday(dateStr));
      state.calendarViewMode = 'list';
      setDisplayedWeek(state, saturdayStart, { weekdayIndex: W.weekdayIndex(dateStr) });
      state.selectedDate = dateStr;
      state.expandedDays = { [dateStr]: true };
      render(state);
      await hydrateWeek(state, state.weekStart);
      render(state);
      scrollToDay(dateStr);
    };

    MealEditor().bindGlobals(state, {
      getRecipes: hooks.getRecipes,
      getFoodItems: hooks.getFoodItems,
      insertFoodItem: hooks.insertFoodItem,
      showToast: hooks.showToast,
      onOpenRecipe: hooks.onOpenRecipe,
      onRegisterRecipe: hooks.onRegisterRecipe,
      persistDay: (dayData) => persistDay(state, dayData),
      touchDay: (dayData) => touchDay(state, dayData),
      onChange: () => render(state),
      onShoppingRefresh: hooks.onShoppingRefresh
    });
  }

  return {
    init,
    bindGlobals,
    render,
    hydrateWeek,
    loadFromCloud
  };
})();
