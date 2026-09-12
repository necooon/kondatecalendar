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
        servings: row.servings,
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
    target.servings = source.servings;
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
      return;
    }
    try {
      const rows = await DB.fetchRange(weekStart);
      const daysNow = ensureWeek(state, weekStart);
      const merged = mergeRowsIntoWeek(daysNow, rows, snapshotGens);
      state.weeksByStart[weekStart] = merged;
      if (state.weekStart === weekStart) state.calendarDays = merged;
    } catch (e) {
      console.error(e);
      if (weekStart === state.demoWeekStart && !Meals().weekHasAnyMeal(ensureWeek(state, weekStart))) {
        applyOfflineDemo(state);
      }
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
    const thisStart = W.toIsoDate(W.startOfWeekMonday(today));
    state.demoWeekStart = thisStart;
    state.weekStart = thisStart;
    state.weeksByStart = {};
    state.prepByWeekStart = {};
    state.mealSaveGen = 0;
    state.calendarDays = ensureWeek(state, thisStart);
    const todayIso = W.toIsoDate(today);
    state.selectedDate = state.calendarDays.some((d) => d.date === todayIso)
      ? todayIso
      : state.calendarDays[0].date;
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
    if (opts.selectToday) {
      const todayIso = W.toIsoDate(new Date());
      const found = M.findDay(state.calendarDays, todayIso);
      state.selectedDate = found ? todayIso : state.calendarDays[index].date;
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
    setDisplayedWeek(state, W.toIsoDate(W.startOfWeekMonday(new Date())), { selectToday: true });
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

  function toggleServings(state, dateStr) {
    if (dateStr) state.selectedDate = dateStr;
    const dayData = Meals().findDay(state.calendarDays, state.selectedDate);
    if (!dayData) return null;
    dayData.servings = dayData.servings === 2 ? 1 : 2;
    if (dayData.isBusinessTrip) {
      dayData.tag = dayData.servings === 1 ? '出張 1人分' : '出張解除 2人分';
      dayData.tagColor = dayData.servings === 1 ? 'amber' : 'blue';
    } else if (dayData.tag === '空き枠' || dayData.tag.startsWith('AI提案')) {
      // keep tag
    } else if (dayData.tag === '出張解除 2人分' || dayData.tag === '出張 1人分') {
      dayData.tag = dayData.servings === 1 ? '1人分' : '2人分';
    }
    return dayData;
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

  function pfcBlockHtml(dayData) {
    if (!dayData.pfc) return '';
    return `
      <div class="flex items-center justify-between text-[10px] font-mono text-slate-500 px-1">
        <span>P: <strong class="text-rose-600 font-bold">${dayData.pfc.p}g</strong></span>
        <span>F: <strong class="text-amber-600 font-bold">${dayData.pfc.f}g</strong></span>
        <span>C: <strong class="text-sky-600 font-bold">${dayData.pfc.c}g</strong></span>
      </div>
    `;
  }

  function dayCardHeaderHtml(dayData) {
    const escapeHtml = Meals().escapeHtml;
    return `
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 flex-wrap min-w-0">
          <span class="text-xs font-bold text-slate-900">${escapeHtml(displayDateOf(dayData))} (${escapeHtml(dayData.day)})</span>
          ${dayData.isBusinessTrip ? '<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">出張日</span>' : ''}
        </div>
        <button type="button" onclick="toggleDayServings('${escapeHtml(dayData.date)}')" class="active-scale text-[11px] font-bold px-2.5 py-1 rounded-full border transition-all flex items-center gap-1 shrink-0 ${
          dayData.servings === 1
            ? 'bg-amber-500 text-white border-amber-500'
            : 'bg-slate-100 text-slate-700 border-slate-200'
        }">
          <i class="fa-solid ${dayData.servings === 1 ? 'fa-user' : 'fa-user-group'} text-[9px]"></i>
          <span>${dayData.servings}人分</span>
        </button>
      </div>
    `;
  }

  function mealSlotRowHtml(state, dayData, meta, options) {
    const M = Meals();
    const dateStr = (options && options.date) || dayData.date;
    const slot = M.slotOf(dayData, meta.key);
    const items = M.mealItems(slot);
    const filled = items.length > 0;
    const showAi = meta.key === 'dinner' && !filled;
    const prepChip = filled && isPrepMealSlot(state, slot)
      ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">作り置き</span>'
      : '';
    const openFn = `openMealEditor('${M.escapeHtml(dateStr)}','${meta.key}')`;

    if (showAi) {
      return `
        <div onclick="${openFn}" class="bg-emerald-50 border border-emerald-100 rounded-2xl p-2 flex items-center justify-between gap-2 cursor-pointer active:bg-emerald-100">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${meta.badge} shrink-0">${meta.label}</span>
            <p class="text-xs font-bold text-emerald-800 truncate">未設定</p>
          </div>
          <button type="button" onclick="event.stopPropagation(); aiSuggestRemaining()" class="active-scale bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shrink-0">AI</button>
        </div>
      `;
    }

    const titlesHtml = filled
      ? items.map((item) => `<p class="text-xs font-bold text-slate-900 truncate">${M.escapeHtml(item.title)}</p>`).join('')
      : '<p class="text-xs font-bold text-slate-400 truncate">未設定</p>';

    return `
      <div onclick="${openFn}" class="bg-slate-50 border border-slate-200/70 rounded-2xl p-2 flex items-start justify-between gap-2 cursor-pointer active:bg-slate-100">
        <div class="flex items-start gap-2 min-w-0 pr-1">
          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${meta.badge} shrink-0 mt-0.5">${meta.label}</span>
          <div class="min-w-0 space-y-0.5">${titlesHtml}</div>
        </div>
        <div class="flex items-center gap-1 shrink-0 mt-0.5">
          ${prepChip}
          <i class="fa-solid fa-chevron-right text-[11px] text-slate-300"></i>
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
    const badge = document.getElementById('week-relative-badge');
    const thisBtn = document.getElementById('goto-this-week-btn');
    if (title) title.textContent = W.relativeWeekTitle(state.weekStart);
    if (range) range.textContent = W.formatWeekRangeLabel(state.weekStart);
    const rel = W.relativeWeekBadge(state.weekStart);
    if (badge) {
      badge.textContent = rel;
      badge.className = rel === '今週'
        ? 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800'
        : 'text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700';
    }
    if (thisBtn) thisBtn.classList.toggle('hidden', W.weekDelta(state.weekStart) === 0);
  }

  function renderWeekOverview(state) {
    const M = Meals();
    const box = document.getElementById('week-overview');
    if (!box) return;
    const emptyBanner = M.weekHasAnyMeal(state.calendarDays) ? '' : `<div>${emptyWeekCtaHtml()}</div>`;
    const W = Week();
    box.innerHTML = emptyBanner + state.calendarDays.map((dayData) => {
      const selected = dayData.date === state.selectedDate;
      return `
        <div id="${W.dayDomId(dayData.date)}" class="bg-white rounded-3xl p-3.5 shadow-sm border space-y-2.5 ${
          selected ? 'border-emerald-300 ring-2 ring-emerald-500/20' : 'border-slate-200/60'
        }">
          ${dayCardHeaderHtml(dayData)}
          ${renderMealSlots(state, dayData, { compact: true, date: dayData.date })}
          ${pfcBlockHtml(dayData)}
        </div>
      `;
    }).join('');
  }

  function render(state) {
    renderWeekNav(state);
    renderWeekOverview(state);
  }

  function scrollToDay(dateStr) {
    requestAnimationFrame(() => {
      const el = document.getElementById(Week().dayDomId(dateStr));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function bindGlobals(state) {
    window.shiftWeek = async function (deltaDays) {
      shiftWeek(state, deltaDays);
      render(state);
      await hydrateWeek(state, state.weekStart);
      render(state);
    };
    window.goToThisWeek = async function () {
      goToThisWeek(state);
      render(state);
      await hydrateWeek(state, state.weekStart);
      render(state);
    };
    window.aiSuggestRemaining = async function () {
      const target = applyAiSuggestion(state);
      render(state);
      if (target) await persistDay(state, target);
      if (target) scrollToDay(target.date);
    };
    window.openRegisterFromCalendar = function () {
      if (hooks.onRegisterRecipe) hooks.onRegisterRecipe();
    };
    window.toggleDayServings = async function (dateStr) {
      const dayData = toggleServings(state, dateStr);
      if (dayData && Meals().isChickenDinner(dayData) && hooks.onChickenServingsChange) {
        hooks.onChickenServingsChange(dayData);
      }
      render(state);
      if (dayData) await persistDay(state, dayData);
    };
    window.renderCalendar = function () {
      render(state);
    };

    MealEditor().bindGlobals(state, {
      getRecipes: hooks.getRecipes,
      showToast: hooks.showToast,
      onOpenRecipe: hooks.onOpenRecipe,
      onRegisterRecipe: hooks.onRegisterRecipe,
      persistDay: (dayData) => persistDay(state, dayData),
      touchDay: (dayData) => touchDay(state, dayData),
      onChange: () => render(state)
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
