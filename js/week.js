window.KitchenGit = window.KitchenGit || {};

/**
 * Monday-start week helpers (local timezone).
 * Internal calendar keys are ISO `YYYY-MM-DD`.
 */
KitchenGit.Week = (function () {
  const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];
  const MS_PER_WEEK = 7 * 24 * 60 * 60 * 1000;

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function localDate(value) {
    if (value instanceof Date) {
      if (Number.isNaN(value.getTime())) return new Date(NaN);
      return new Date(value.getFullYear(), value.getMonth(), value.getDate());
    }
    const parts = String(value || '').split('-').map(Number);
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (!y || !m || !d) return new Date(NaN);
    return new Date(y, m - 1, d);
  }

  function toIsoDate(date) {
    const d = localDate(date);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function startOfWeekMonday(date) {
    const d = localDate(date);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  function addDays(date, n) {
    const d = localDate(date);
    d.setDate(d.getDate() + (Number(n) || 0));
    return d;
  }

  function weekdayIndex(isoOrDate) {
    const d = localDate(isoOrDate);
    if (Number.isNaN(d.getTime())) return 0;
    return (d.getDay() + 6) % 7;
  }

  function dayNumber(iso) {
    return localDate(iso).getDate();
  }

  function formatMd(iso, withYear) {
    const d = localDate(iso);
    if (withYear) {
      return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
    }
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function formatWeekRangeLabel(weekStartIso) {
    const start = localDate(weekStartIso);
    const end = addDays(start, 6);
    const crossing = start.getFullYear() !== end.getFullYear();
    return `${formatMd(start, crossing)} (${WEEKDAYS[0]}) - ${formatMd(end, crossing)} (${WEEKDAYS[6]})`;
  }

  function weekDelta(weekStartIso, today) {
    const thisStart = startOfWeekMonday(today || new Date());
    return Math.round((localDate(weekStartIso).getTime() - thisStart.getTime()) / MS_PER_WEEK);
  }

  function relativeWeekBadge(weekStartIso, today) {
    const delta = weekDelta(weekStartIso, today);
    if (delta === 0) return '今週';
    if (delta === 1) return '来週';
    if (delta === -1) return '先週';
    if (delta > 1) return `${delta}週後`;
    return `${Math.abs(delta)}週前`;
  }

  function relativeWeekTitle(weekStartIso, today) {
    return `${relativeWeekBadge(weekStartIso, today)}の朝昼晩＆人数管理`;
  }

  function dayDomId(dateStr) {
    return `week-day-${String(dateStr).replace(/\//g, '-')}`;
  }

  function emptyMeals() {
    return KitchenGit.Meals.emptyMeals();
  }

  function stampDay(weekStartIso, index, extra) {
    const iso = toIsoDate(addDays(weekStartIso, index));
    return Object.assign({
      date: iso,
      day: WEEKDAYS[index],
      tag: '未登録',
      tagColor: 'slate',
      isBusinessTrip: false,
      pfc: null,
      meals: emptyMeals()
    }, extra || {}, { date: iso, day: WEEKDAYS[index] });
  }

  function buildEmptyWeekDays(weekStartIso) {
    return WEEKDAYS.map((_, i) => stampDay(weekStartIso, i));
  }

  function applyTemplateToWeek(weekStartIso, templates) {
    return (templates || []).map((tpl, i) => {
      const copy = clone(tpl);
      if (!copy.meals) copy.meals = emptyMeals();
      return stampDay(weekStartIso, i, copy);
    });
  }

  return {
    WEEKDAYS,
    clone,
    localDate,
    parseIsoDate: localDate,
    toIsoDate,
    startOfWeekMonday,
    addDays,
    weekdayIndex,
    dayNumber,
    formatMd,
    formatWeekRangeLabel,
    weekDelta,
    relativeWeekBadge,
    relativeWeekTitle,
    dayDomId,
    emptyMeals,
    buildEmptyWeekDays,
    applyTemplateToWeek
  };
})();
