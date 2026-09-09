window.KitchenGit = window.KitchenGit || {};

/**
 * Monday-start week helpers (local timezone).
 * Internal calendar keys are ISO `YYYY-MM-DD`.
 */
KitchenGit.Week = (function () {
  const WEEKDAYS = ['月', '火', '水', '木', '金', '土', '日'];
  const MS_PER_DAY = 24 * 60 * 60 * 1000;

  function pad2(n) {
    return String(n).padStart(2, '0');
  }

  function parseIsoDate(iso) {
    if (iso instanceof Date) {
      return new Date(iso.getFullYear(), iso.getMonth(), iso.getDate());
    }
    const parts = String(iso || '').split('-').map(Number);
    const y = parts[0];
    const m = parts[1];
    const d = parts[2];
    if (!y || !m || !d) return new Date(NaN);
    return new Date(y, m - 1, d);
  }

  function toIsoDate(date) {
    const d = date instanceof Date ? date : parseIsoDate(date);
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  }

  function startOfWeekMonday(date) {
    const d = date instanceof Date
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate())
      : parseIsoDate(date);
    const offset = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - offset);
    return d;
  }

  function addDays(date, n) {
    const d = date instanceof Date
      ? new Date(date.getFullYear(), date.getMonth(), date.getDate())
      : parseIsoDate(date);
    d.setDate(d.getDate() + Number(n) || 0);
    return d;
  }

  function weekdayIndex(isoOrDate) {
    const d = isoOrDate instanceof Date ? isoOrDate : parseIsoDate(isoOrDate);
    if (Number.isNaN(d.getTime())) return 0;
    return (d.getDay() + 6) % 7;
  }

  function formatMd(iso, withYear) {
    const d = parseIsoDate(iso);
    if (withYear) {
      return `${d.getFullYear()}/${pad2(d.getMonth() + 1)}/${pad2(d.getDate())}`;
    }
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function formatWeekRangeLabel(weekStartIso) {
    const start = parseIsoDate(weekStartIso);
    const end = addDays(start, 6);
    const startIso = toIsoDate(start);
    const endIso = toIsoDate(end);
    const startDow = WEEKDAYS[0];
    const endDow = WEEKDAYS[6];
    if (start.getFullYear() !== end.getFullYear()) {
      return `${formatMd(startIso, true)} (${startDow}) - ${formatMd(endIso, true)} (${endDow})`;
    }
    return `${formatMd(startIso)} (${startDow}) - ${formatMd(endIso)} (${endDow})`;
  }

  function weekDelta(weekStartIso, today) {
    const thisStart = startOfWeekMonday(today || new Date());
    const shown = parseIsoDate(weekStartIso);
    return Math.round((shown.getTime() - thisStart.getTime()) / (7 * MS_PER_DAY));
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
    const badge = relativeWeekBadge(weekStartIso, today);
    if (badge === '今週') return '今週の朝昼晩＆人数管理';
    if (badge === '来週') return '来週の朝昼晩＆人数管理';
    if (badge === '先週') return '先週の朝昼晩＆人数管理';
    return `${badge}の朝昼晩＆人数管理`;
  }

  function emptyMeals() {
    return { breakfast: { title: '' }, lunch: { title: '' }, dinner: { title: '' } };
  }

  function buildEmptyWeekDays(weekStartIso) {
    const start = parseIsoDate(weekStartIso);
    return WEEKDAYS.map((day, i) => {
      const iso = toIsoDate(addDays(start, i));
      return {
        date: iso,
        displayDate: formatMd(iso),
        day,
        tag: '未登録',
        tagColor: 'slate',
        servings: 2,
        isBusinessTrip: false,
        pfc: null,
        meals: emptyMeals()
      };
    });
  }

  function applyTemplateToWeek(weekStartIso, templates) {
    const start = parseIsoDate(weekStartIso);
    return (templates || []).map((tpl, i) => {
      const iso = toIsoDate(addDays(start, i));
      const copy = JSON.parse(JSON.stringify(tpl));
      copy.date = iso;
      copy.displayDate = formatMd(iso);
      copy.day = WEEKDAYS[i];
      if (!copy.meals) copy.meals = emptyMeals();
      return copy;
    });
  }

  return {
    WEEKDAYS,
    parseIsoDate,
    toIsoDate,
    startOfWeekMonday,
    addDays,
    weekdayIndex,
    formatMd,
    formatWeekRangeLabel,
    weekDelta,
    relativeWeekBadge,
    relativeWeekTitle,
    emptyMeals,
    buildEmptyWeekDays,
    applyTemplateToWeek
  };
})();
