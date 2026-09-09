window.KitchenGit = window.KitchenGit || {};

KitchenGit.Calendar = (function () {
  const Week = () => KitchenGit.Week;

  const TAG_CLASSES = {
    purple: 'bg-purple-100 text-purple-800',
    amber: 'bg-amber-100 text-amber-800',
    blue: 'bg-blue-100 text-blue-800',
    rose: 'bg-rose-100 text-rose-800',
    emerald: 'bg-emerald-100 text-emerald-800',
    slate: 'bg-slate-100 text-slate-600'
  };

  const MEAL_SLOTS = [
    { key: 'breakfast', label: '朝', badge: 'bg-amber-100 text-amber-800' },
    { key: 'lunch', label: '昼', badge: 'bg-sky-100 text-sky-800' },
    { key: 'dinner', label: '晩', badge: 'bg-indigo-100 text-indigo-800' }
  ];

  const AI_DINNER = {
    title: '秋鯖の竜田揚げ ＆ キノコポン酢和え',
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
        dinner: { title: '秋刀魚の塩焼き ＆ 具だくさん豚汁' }
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

  const VIEW_BTN_ACTIVE = 'flex-1 py-1.5 rounded-xl text-[11px] font-bold active-scale bg-slate-900 text-white shadow-sm';
  const VIEW_BTN_IDLE = 'flex-1 py-1.5 rounded-xl text-[11px] font-bold active-scale text-slate-600';

  let hooks = {};

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function encodeJsString(value) {
    return JSON.stringify(value == null ? '' : String(value)).replace(/</g, '\\u003c');
  }

  function mealTitle(slot) {
    return ((slot && slot.title) || '').trim();
  }

  function isMealFilled(slot) {
    return mealTitle(slot).length > 0;
  }

  function dayMeals(dayData) {
    return (dayData && dayData.meals) || {};
  }

  function dinnerTitle(dayData) {
    return mealTitle(dayMeals(dayData).dinner);
  }

  function isChickenDinner(dayData) {
    return dinnerTitle(dayData).includes('鶏むね肉と秋茄子');
  }

  function displayDateOf(dayData) {
    return dayData ? Week().formatMd(dayData.date) : '';
  }

  function findDay(days, dateStr) {
    return (days || []).find((d) => d.date === dateStr) || null;
  }

  function weekHasAnyMeal(days) {
    return (days || []).some((dayData) =>
      MEAL_SLOTS.some((meta) => isMealFilled(dayMeals(dayData)[meta.key]))
    );
  }

  function ensureMealSlot(dayData, slotKey) {
    if (!dayData.meals) dayData.meals = Week().emptyMeals();
    if (!dayData.meals[slotKey]) dayData.meals[slotKey] = { title: '' };
    return dayData.meals[slotKey];
  }

  function titleMatchesPrep(title, item) {
    const text = title || '';
    if (item.match instanceof RegExp) return item.match.test(text);
    const needle = String(item.match || '');
    return !!needle && text.includes(needle);
  }

  function currentPrepItems(state) {
    return state.prepByWeekStart[state.weekStart] || [];
  }

  function isPrepMealTitle(state, title) {
    return currentPrepItems(state).some((item) => titleMatchesPrep(title, item));
  }

  function prepDaysForStock(state, stock) {
    if (stock.days && stock.days.length) return stock.days;
    const found = [];
    state.calendarDays.forEach((dayData) => {
      const hit = MEAL_SLOTS.some((meta) => titleMatchesPrep(mealTitle(dayMeals(dayData)[meta.key]), stock));
      if (hit && !found.includes(dayData.day)) found.push(dayData.day);
    });
    return found;
  }

  function findRecipeForTitle(recipes, title) {
    const q = (title || '').trim();
    if (!q) return null;
    return (recipes || []).find((r) => {
      const name = r.name || '';
      return name && (q.includes(name) || name.includes(q));
    }) || null;
  }

  function recipesOf(state) {
    return (hooks.getRecipes && hooks.getRecipes()) || state.recipes || [];
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
    const opts = options || {};
    const keepWeekday = opts.weekdayIndex != null
      ? opts.weekdayIndex
      : W.weekdayIndex(state.selectedDate || weekStart);
    const index = Math.min(Math.max(keepWeekday, 0), 6);
    state.weekStart = weekStart;
    state.calendarDays = ensureWeek(state, weekStart);
    if (opts.selectToday) {
      const todayIso = W.toIsoDate(new Date());
      const found = findDay(state.calendarDays, todayIso);
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
    const emptyDinner = state.calendarDays.find((d) => !isMealFilled(dayMeals(d).dinner));
    const saturday = state.calendarDays.find((d) => d.day === '土');
    const target = emptyDinner || saturday || state.calendarDays[state.calendarDays.length - 1];
    if (!target) return null;
    ensureMealSlot(target, 'dinner').title = AI_DINNER.title;
    target.tag = AI_DINNER.tag;
    target.tagColor = AI_DINNER.tagColor;
    target.pfc = AI_DINNER.pfc;
    state.selectedDate = target.date;
    return target;
  }

  function toggleServings(state, dateStr) {
    if (dateStr) state.selectedDate = dateStr;
    const dayData = findDay(state.calendarDays, state.selectedDate);
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
    const tagClass = TAG_CLASSES[dayData.tagColor] || TAG_CLASSES.emerald;
    const dateTitle = compact ? 'text-xs' : 'text-sm';
    return `
      <div class="flex items-center justify-between gap-2">
        <div class="flex items-center gap-1.5 flex-wrap min-w-0">
          <span class="${dateTitle} font-bold text-slate-900">${escapeHtml(displayDateOf(dayData))} (${escapeHtml(dayData.day)})</span>
          ${dayData.isBusinessTrip ? '<span class="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full font-mono">出張日</span>' : ''}
          <span class="text-[9px] font-bold px-2 py-0.5 rounded-full ${tagClass}">${escapeHtml(dayData.tag)}</span>
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

  function slotDotClass(filled, isSelected) {
    if (filled) return 'bg-emerald-400';
    return isSelected ? 'bg-white/35' : 'bg-slate-300';
  }

  function mealSlotRowHtml(state, dayData, meta, options) {
    const compact = !!(options && options.compact);
    const dateStr = (options && options.date) || dayData.date;
    const title = mealTitle(dayMeals(dayData)[meta.key]);
    const filled = title.length > 0;
    const showAi = meta.key === 'dinner' && !filled;
    const prepChip = filled && isPrepMealTitle(state, title)
      ? '<span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 shrink-0">作り置き</span>'
      : '';
    const openFn = `openMealEditor('${escapeHtml(dateStr)}','${meta.key}')`;
    const pad = compact ? 'p-2' : 'p-2.5';
    const titleClass = compact ? 'truncate' : 'leading-snug';

    if (showAi) {
      if (compact) {
        return `
          <div onclick="${openFn}" class="bg-emerald-50 border border-emerald-100 rounded-2xl ${pad} flex items-center justify-between gap-2 cursor-pointer active:bg-emerald-100">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${meta.badge} shrink-0">${meta.label}</span>
              <p class="text-xs font-bold text-emerald-800 truncate">未設定</p>
            </div>
            <button type="button" onclick="event.stopPropagation(); aiSuggestRemaining()" class="active-scale bg-emerald-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shrink-0">AI</button>
          </div>
        `;
      }
      return `
        <div onclick="${openFn}" class="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 flex items-center justify-between gap-2 cursor-pointer active:bg-emerald-100">
          <div class="flex items-start gap-2 min-w-0">
            <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${meta.badge} shrink-0">${meta.label}</span>
            <div class="min-w-0">
              <p class="text-xs font-bold text-emerald-800">未設定</p>
              <p class="text-[10px] text-emerald-700 mt-0.5"><i class="fa-solid fa-wand-magic-sparkles mr-1"></i>空き枠です</p>
            </div>
          </div>
          <button type="button" onclick="event.stopPropagation(); aiSuggestRemaining()" class="active-scale bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-full shrink-0">AIで決める</button>
        </div>
      `;
    }

    return `
      <div onclick="${openFn}" class="bg-slate-50 border border-slate-200/70 rounded-2xl ${pad} flex items-center justify-between gap-2 cursor-pointer active:bg-slate-100">
        <div class="flex items-center gap-2 min-w-0 pr-1">
          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded-full ${meta.badge} shrink-0">${meta.label}</span>
          <p class="text-xs font-bold ${filled ? 'text-slate-900' : 'text-slate-400'} ${titleClass}">${filled ? escapeHtml(title) : '未設定'}</p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          ${prepChip}
          <i class="fa-solid fa-chevron-right text-[11px] text-slate-300"></i>
        </div>
      </div>
    `;
  }

  function renderMealSlots(state, dayData, options) {
    const rows = MEAL_SLOTS.map((meta) => mealSlotRowHtml(state, dayData, meta, options)).join('');
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

  function updateCalendarViewChrome(state) {
    const isWeek = state.calendarView === 'week';
    const strip = document.getElementById('week-strip');
    const dayCard = document.getElementById('day-detail-card');
    const weekOverview = document.getElementById('week-overview');
    const dayBtn = document.getElementById('cal-view-day');
    const weekBtn = document.getElementById('cal-view-week');
    if (strip) {
      strip.classList.toggle('hidden', isWeek);
      strip.classList.toggle('flex', !isWeek);
    }
    if (dayCard) dayCard.classList.toggle('hidden', isWeek);
    if (weekOverview) weekOverview.classList.toggle('hidden', !isWeek);
    if (dayBtn) dayBtn.className = isWeek ? VIEW_BTN_IDLE : VIEW_BTN_ACTIVE;
    if (weekBtn) weekBtn.className = isWeek ? VIEW_BTN_ACTIVE : VIEW_BTN_IDLE;
  }

  function renderWeekStrip(state) {
    const strip = document.getElementById('week-strip');
    if (!strip) return;
    strip.innerHTML = '';
    const W = Week();
    state.calendarDays.forEach((item) => {
      const isSelected = item.date === state.selectedDate;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.onclick = () => {
        state.selectedDate = item.date;
        render(state);
      };
      btn.className = `shrink-0 w-12 py-2 rounded-2xl flex flex-col items-center transition-all active-scale ${
        isSelected ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
      }`;
      const dayColor = item.day === '日'
        ? (isSelected ? 'text-rose-300' : 'text-rose-500')
        : item.day === '土'
          ? (isSelected ? 'text-sky-300' : 'text-sky-500')
          : 'opacity-80';
      const meals = dayMeals(item);
      const slotDots = MEAL_SLOTS.map((meta) => {
        const filled = isMealFilled(meals[meta.key]);
        return `<span class="w-1.5 h-1.5 rounded-full ${slotDotClass(filled, isSelected)}"></span>`;
      }).join('');
      btn.innerHTML = `
        <span class="text-[10px] font-bold ${dayColor}">${item.day}</span>
        <span class="text-sm font-bold font-mono">${W.dayNumber(item.date)}</span>
        <span class="mt-1 flex items-center gap-[3px]">${slotDots}</span>
      `;
      strip.appendChild(btn);
    });
  }

  function renderDayDetail(state) {
    const card = document.getElementById('day-detail-card');
    if (!card) return;
    const dayData = findDay(state.calendarDays, state.selectedDate) || state.calendarDays[0];
    if (!dayData) {
      card.innerHTML = emptyWeekCtaHtml();
      return;
    }
    card.innerHTML = `
      ${dayCardHeaderHtml(dayData, false)}
      ${weekHasAnyMeal(state.calendarDays) ? '' : emptyWeekCtaHtml()}
      ${renderMealSlots(state, dayData, { date: dayData.date })}
      ${pfcBlockHtml(dayData)}
    `;
  }

  function renderWeekOverview(state) {
    const box = document.getElementById('week-overview');
    if (!box) return;
    const emptyBanner = weekHasAnyMeal(state.calendarDays) ? '' : `<div>${emptyWeekCtaHtml()}</div>`;
    const W = Week();
    box.innerHTML = emptyBanner + state.calendarDays.map((dayData) => {
      const selected = dayData.date === state.selectedDate;
      return `
        <div id="${W.dayDomId(dayData.date)}" class="bg-white rounded-3xl p-3.5 shadow-sm border space-y-2.5 ${
          selected ? 'border-emerald-300 ring-2 ring-emerald-500/20' : 'border-slate-200/60'
        }">
          ${dayCardHeaderHtml(dayData, true)}
          ${renderMealSlots(state, dayData, { compact: true, date: dayData.date })}
          ${pfcBlockHtml(dayData)}
        </div>
      `;
    }).join('');
  }

  function renderPrepDayPills(state) {
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
    updateCalendarViewChrome(state);
    renderWeekNav(state);
    renderWeekStrip(state);
    renderDayDetail(state);
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
    window.setCalendarView = function (view) {
      state.calendarView = view === 'week' ? 'week' : 'day';
      render(state);
    };
    window.aiSuggestRemaining = function () {
      const target = applyAiSuggestion(state);
      render(state);
      if (target && state.calendarView === 'week') scrollToDay(target.date);
    };
    window.openRegisterFromCalendar = function () {
      if (hooks.onRegisterRecipe) hooks.onRegisterRecipe();
    };
    window.toggleDayServings = function (dateStr) {
      const dayData = toggleServings(state, dateStr);
      if (dayData && isChickenDinner(dayData) && hooks.onChickenServingsChange) {
        hooks.onChickenServingsChange(dayData);
      }
      render(state);
    };
    window.jumpToPrepDay = function (dayLabel) {
      const dayData = state.calendarDays.find((d) => d.day === dayLabel);
      if (!dayData) return;
      state.selectedDate = dayData.date;
      state.calendarView = 'week';
      if (hooks.onShowCalendar) hooks.onShowCalendar();
      render(state);
      scrollToDay(dayData.date);
    };
    window.openMealEditor = function (dateStr, slotKey) {
      const dayData = findDay(state.calendarDays, dateStr);
      if (!dayData) return;
      const meta = MEAL_SLOTS.find((m) => m.key === slotKey) || MEAL_SLOTS[0];
      state.selectedDate = dateStr;
      state.mealEditorDate = dateStr;
      state.mealEditorSlot = slotKey;
      const heading = document.getElementById('meal-edit-heading');
      const input = document.getElementById('meal-edit-title');
      const title = mealTitle(dayMeals(dayData)[slotKey]);
      if (heading) heading.textContent = `${displayDateOf(dayData)} (${dayData.day}) の${meta.label}`;
      if (input) input.value = title;
      renderMealEditorRecipes(state, title);
      document.getElementById('meal-edit-backdrop').classList.remove('hidden');
      document.getElementById('meal-edit-sheet').classList.remove('hidden');
      if (input) {
        input.focus();
        input.setSelectionRange(input.value.length, input.value.length);
      }
    };
    window.closeMealEditor = function () {
      const backdrop = document.getElementById('meal-edit-backdrop');
      const sheet = document.getElementById('meal-edit-sheet');
      if (backdrop) backdrop.classList.add('hidden');
      if (sheet) sheet.classList.add('hidden');
      state.mealEditorDate = null;
      state.mealEditorSlot = null;
    };
    window.pickMealRecipe = function (name) {
      const input = document.getElementById('meal-edit-title');
      if (input) input.value = name;
      renderMealEditorRecipes(state, name);
    };
    window.saveMealSlot = function () {
      const dayData = findDay(state.calendarDays, state.mealEditorDate);
      const slotKey = state.mealEditorSlot;
      const input = document.getElementById('meal-edit-title');
      if (!dayData || !slotKey) return;
      const title = ((input && input.value) || '').trim();
      ensureMealSlot(dayData, slotKey).title = title;
      window.closeMealEditor();
      render(state);
      if (hooks.showToast) hooks.showToast(title ? '献立を保存しました' : '献立をクリアしました');
    };
    window.clearMealSlot = function () {
      const input = document.getElementById('meal-edit-title');
      if (input) input.value = '';
      window.saveMealSlot();
    };
    window.openMatchedRecipeFromMeal = function () {
      const input = document.getElementById('meal-edit-title');
      const title = ((input && input.value) || '').trim();
      const recipe = findRecipeForTitle(recipesOf(state), title);
      window.closeMealEditor();
      if (hooks.onOpenRecipe) hooks.onOpenRecipe(recipe, title);
    };
    window.renderCalendar = function () {
      render(state);
    };
  }

  function renderMealEditorRecipes(state, currentTitle) {
    const wrap = document.getElementById('meal-edit-recipes-wrap');
    const list = document.getElementById('meal-edit-recipes');
    const openBtn = document.getElementById('meal-edit-open-recipe');
    if (!wrap || !list) return;
    const recipes = recipesOf(state);
    wrap.classList.toggle('hidden', recipes.length === 0);
    list.innerHTML = recipes.map((recipe) => `
      <button type="button" onclick="pickMealRecipe(${encodeJsString(recipe.name)})" class="active-scale w-full text-left bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 font-bold text-slate-800">
        ${escapeHtml(recipe.name)}
      </button>
    `).join('');
    if (openBtn) openBtn.classList.toggle('hidden', !findRecipeForTitle(recipes, currentTitle));
  }

  function syncMealEditorRecipeButton(state, title) {
    const openBtn = document.getElementById('meal-edit-open-recipe');
    if (openBtn) openBtn.classList.toggle('hidden', !findRecipeForTitle(recipesOf(state), title));
  }

  return {
    MEAL_SLOTS,
    init,
    bindGlobals,
    render,
    isChickenDinner,
    findDay,
    findRecipeForTitle,
    renderMealEditorRecipes,
    syncMealEditorRecipeButton
  };
})();
