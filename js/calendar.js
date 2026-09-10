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

  const DEMO_DAY_TEMPLATES = [
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

  function prepDaysForStock(state, stock) {
    const M = Meals();
    if (stock.days && stock.days.length) return stock.days;
    const found = [];
    state.calendarDays.forEach((dayData) => {
      const hit = M.MEAL_SLOTS.some((meta) => M.slotMatchesPrep(M.slotOf(dayData, meta.key), stock));
      if (hit && !found.includes(dayData.day)) found.push(dayData.day);
    });
    return found;
  }

  function ensureWeek(state, weekStart) {
    const W = Week();
    if (!state.weeksByStart[weekStart]) {
      state.weeksByStart[weekStart] = weekStart === state.demoWeekStart
        ? W.applyTemplateToWeek(weekStart, DEMO_DAY_TEMPLATES)
        : W.buildEmptyWeekDays(weekStart);
    }
    if (state.prepByWeekStart[weekStart] === undefined) {
      state.prepByWeekStart[weekStart] = weekStart === state.demoWeekStart
        ? W.clone(DEMO_PREP_ITEMS)
        : [];
    }
    return state.weeksByStart[weekStart];
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

  function dayCardHeaderHtml(dayData, compact) {
    const escapeHtml = Meals().escapeHtml;
    const dateTitle = compact ? 'text-xs' : 'text-sm';
    return `
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 flex-wrap min-w-0">
          <span class="${dateTitle} font-bold text-slate-900">${escapeHtml(displayDateOf(dayData))} (${escapeHtml(dayData.day)})</span>
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
          ${dayCardHeaderHtml(dayData, true)}
          ${renderMealSlots(state, dayData, { date: dayData.date })}
          ${pfcBlockHtml(dayData)}
        </div>
      `;
    }).join('');
  }

  function renderPrepDayPills(state) {
    const escapeHtml = Meals().escapeHtml;
    currentPrepItems(state).forEach((stock) => {
      const el = document.getElementById(`prep-pills-${stock.id}`);
      if (!el) return;
      const days = prepDaysForStock(state, stock);
      el.innerHTML = days.map((dayLabel) => `
        <button type="button" onclick="jumpToPrepDay('${escapeHtml(dayLabel)}')" class="active-scale text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
          ${escapeHtml(dayLabel)}
        </button>
      `).join('');
    });
  }

  function renderPrepStock(state) {
    const escapeHtml = Meals().escapeHtml;
    const list = document.getElementById('prep-stock-list');
    const badge = document.getElementById('prep-count-badge');
    const items = currentPrepItems(state);
    if (badge) badge.textContent = `${items.length}品ストック`;
    if (!list) return;
    if (!items.length) {
      list.innerHTML = `
        <div class="bg-white/95 rounded-2xl p-3 border border-amber-100 space-y-2">
          <p class="font-bold text-slate-800">作り置きが未登録です</p>
          <p class="text-[10px] text-slate-500 leading-relaxed">この週の日曜作り置きはまだありません。</p>
          <button type="button" onclick="openRegisterFromCalendar()" class="active-scale w-full bg-amber-500 text-white text-[11px] font-bold py-2 rounded-xl">+ レシピを登録する</button>
        </div>
      `;
      return;
    }
    list.innerHTML = items.map((item) => `
      <div class="bg-white/95 rounded-2xl p-2.5 flex items-center justify-between gap-2 border border-amber-100 shadow-2xs">
        <div class="flex items-center gap-2 min-w-0">
          <i class="fa-solid fa-circle-check text-emerald-500 text-sm shrink-0"></i>
          <div class="min-w-0">
            <p class="font-bold text-slate-800">${escapeHtml(item.name)}${item.version ? ` <span class="font-mono text-emerald-600 text-[11px]">${escapeHtml(item.version)}</span>` : ''}</p>
            <p class="text-[10px] text-slate-400">${escapeHtml(item.note || '')}</p>
            <div id="prep-pills-${escapeHtml(item.id)}" class="flex flex-wrap items-center gap-1 mt-1.5"></div>
          </div>
        </div>
        <span class="text-[10px] font-mono font-bold text-slate-500 shrink-0">${escapeHtml(item.servingsLabel || '')}</span>
      </div>
    `).join('');
    renderPrepDayPills(state);
  }

  function render(state) {
    renderWeekNav(state);
    renderWeekOverview(state);
    renderPrepStock(state);
  }

  function scrollToDay(dateStr) {
    requestAnimationFrame(() => {
      const el = document.getElementById(Week().dayDomId(dateStr));
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  function bindGlobals(state) {
    window.shiftWeek = function (deltaDays) {
      shiftWeek(state, deltaDays);
      render(state);
    };
    window.goToThisWeek = function () {
      goToThisWeek(state);
      render(state);
    };
    window.aiSuggestRemaining = function () {
      const target = applyAiSuggestion(state);
      render(state);
      if (target) scrollToDay(target.date);
    };
    window.openRegisterFromCalendar = function () {
      if (hooks.onRegisterRecipe) hooks.onRegisterRecipe();
    };
    window.toggleDayServings = function (dateStr) {
      const dayData = toggleServings(state, dateStr);
      if (dayData && Meals().isChickenDinner(dayData) && hooks.onChickenServingsChange) {
        hooks.onChickenServingsChange(dayData);
      }
      render(state);
    };
    window.jumpToPrepDay = function (dayLabel) {
      const dayData = state.calendarDays.find((d) => d.day === dayLabel);
      if (!dayData) return;
      state.selectedDate = dayData.date;
      if (hooks.onShowCalendar) hooks.onShowCalendar();
      render(state);
      scrollToDay(dayData.date);
    };
    window.renderCalendar = function () {
      render(state);
    };

    MealEditor().bindGlobals(state, {
      getRecipes: hooks.getRecipes,
      showToast: hooks.showToast,
      onOpenRecipe: hooks.onOpenRecipe,
      onChange: () => render(state)
    });
  }

  return {
    init,
    bindGlobals,
    render
  };
})();
