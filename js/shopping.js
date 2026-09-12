window.KitchenGit = window.KitchenGit || {};

/**
 * Weekly shopping list built from calendar meal slots (recipe ingredients only).
 * Memo / eating-out slots are excluded. Excluded checkmarks persist in localStorage.
 */
KitchenGit.Shopping = (function () {
  const STORAGE_KEY = 'recipeops-shopping-excluded';
  const CATEGORY_ORDER = ['野菜・きのこ', '精肉・鮮魚', '調味料・その他'];

  const MEAT_FISH = /鶏|豚|牛|肉|鮭|さんま|秋刀魚|魚|エビ|いか|タコ|ひき肉|挽き|ソーセージ|ベーコン|ハム|サーモン|刺身|切り身|むね|もも|ヒレ|ささみ|ウィンナー|ハンバーグ|フランク/i;
  const VEG_MUSHROOM = /茄子|なす|玉ねぎ|たまねぎ|生姜|大葉|しそ|ほうれん|人参|きのこ|キャベツ|白菜|きゅうり|トマト|ピーマン|じゃが|もやし|ネギ|レタス|大根|ごぼう|小松菜|水菜|バナナ|りんご|アボカド|レモン|春野菜|枝豆|コーン|パプリカ|ズッキーニ|アスパラ|ブロッコリー|もずく|わかめ|海藻|豆/i;

  function itemKey(name, unit) {
    return `${String(name || '').trim()}\0${String(unit || 'g').trim()}`;
  }

  function categorizeIngredient(name) {
    const n = String(name || '');
    if (MEAT_FISH.test(n)) return '精肉・鮮魚';
    if (VEG_MUSHROOM.test(n)) return '野菜・きのこ';
    return '調味料・その他';
  }

  function loadExcluded() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function saveExcluded(map) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map || {}));
    } catch (e) {
      console.warn('shopping excluded state not saved', e);
    }
  }

  function setExcluded(key, excluded) {
    const map = loadExcluded();
    if (excluded) map[key] = true;
    else delete map[key];
    saveExcluded(map);
  }

  function formatAmount(amount, unit) {
    const n = Number(amount);
    if (!Number.isFinite(n)) return String(amount || '');
    const rounded = Math.round(n * 10) / 10;
    const display = Number.isInteger(rounded) ? String(rounded) : String(rounded);
    const u = String(unit || 'g').trim();
    if (u === 'g' || u === 'ml') return `${display}${u}`;
    return `${display}${u}`;
  }

  function shortUsageLabel(title) {
    const text = String(title || '').trim();
    if (!text) return '';
    if (text.length <= 8) return text;
    return text.slice(0, 8) + '…';
  }

  function buildFromWeek(options) {
    const opts = options || {};
    const calendarDays = opts.calendarDays || [];
    const recipes = opts.recipes || [];
    const Meals = KitchenGit.Meals;
    const RecipeModel = KitchenGit.RecipeModel;
    const merge = new Map();
    const excluded = loadExcluded();

    calendarDays.forEach((dayData) => {
      const dayLabel = (dayData && dayData.day) || '';
      Meals.MEAL_SLOTS.forEach((meta) => {
        const slot = Meals.slotOf(dayData, meta.key);
        if (!slot || Meals.isMemoSlot(slot) || !Meals.isMealFilled(slot)) return;

        const slotServings = Meals.slotServings(slot);
        Meals.mealItems(slot).forEach((item) => {
          const recipe = Meals.findRecipeForItem(recipes, item);
          if (!recipe) return;

          const head = RecipeModel.pickHead(recipe);
          const version = head.version || {};
          const ingredients = version.ingredients || [];
          const servingsBase = Number(recipe.servingsBase) > 0 ? Number(recipe.servingsBase) : 2;
          const usageHint = shortUsageLabel(item.title || recipe.name);
          const usagePart = usageHint ? `${dayLabel}${usageHint}` : dayLabel;

          ingredients.forEach((ing) => {
            const name = String(ing.name || '').trim();
            if (!name) return;
            const unit = String(ing.unit || 'g').trim();
            const scaled = RecipeModel.scaleAmount(ing.baseAmount, slotServings, servingsBase);
            const key = itemKey(name, unit);
            const existing = merge.get(key);
            if (existing) {
              existing.rawAmount += scaled;
              if (usagePart && !existing.usageParts.includes(usagePart)) {
                existing.usageParts.push(usagePart);
              }
            } else {
              merge.set(key, {
                name,
                unit,
                rawAmount: scaled,
                category: categorizeIngredient(name),
                usageParts: usagePart ? [usagePart] : []
              });
            }
          });
        });
      });
    });

    const items = Array.from(merge.values()).map((entry) => {
      const key = itemKey(entry.name, entry.unit);
      return {
        id: key,
        key,
        category: entry.category,
        name: entry.name,
        unit: entry.unit,
        rawAmount: entry.rawAmount,
        amount: formatAmount(entry.rawAmount, entry.unit),
        usage: entry.usageParts.join('・'),
        excluded: !!excluded[key]
      };
    });

    items.sort((a, b) => {
      const catA = CATEGORY_ORDER.indexOf(a.category);
      const catB = CATEGORY_ORDER.indexOf(b.category);
      if (catA !== catB) return (catA < 0 ? 99 : catA) - (catB < 0 ? 99 : catB);
      return a.name.localeCompare(b.name, 'ja');
    });

    return items;
  }

  return {
    STORAGE_KEY,
    CATEGORY_ORDER,
    itemKey,
    categorizeIngredient,
    loadExcluded,
    saveExcluded,
    setExcluded,
    formatAmount,
    buildFromWeek
  };
})();
