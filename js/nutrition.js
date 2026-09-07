window.KitchenGit = window.KitchenGit || {};

// 日本食品標準成分表に近い 100g あたり。単位換算は家庭料理の目安。
KitchenGit.NUTRITION_FOODS = [
  { keys: ['鶏むね', '鶏胸', 'ささみ'], p: 23.3, f: 1.9, c: 0.1, unitGrams: { 切れ: 80 } },
  { keys: ['鶏もも'], p: 16.2, f: 8.2, c: 0.0, unitGrams: { 枚: 120, 本: 120 } },
  { keys: ['豚ヒレ', '豚ひれ'], p: 22.8, f: 1.9, c: 0.2, unitGrams: { 切れ: 80 } },
  { keys: ['合挽き', '合いびき', 'ひき肉', '挽き肉'], p: 17.7, f: 15.1, c: 0.3, unitGrams: {} },
  { keys: ['生鮭', '鮭', 'サーモン'], p: 22.3, f: 4.3, c: 0.1, unitGrams: { 切れ: 80 } },
  { keys: ['秋刀魚', 'さんま'], p: 18.5, f: 23.6, c: 0.1, unitGrams: { 尾: 130, 本: 130 } },
  { keys: ['秋茄子', '茄子', 'なす'], p: 1.1, f: 0.1, c: 5.1, unitGrams: { 本: 80, 個: 80 } },
  { keys: ['玉ねぎ', 'たまねぎ'], p: 1.0, f: 0.1, c: 8.8, unitGrams: { 個: 200, 本: 200 } },
  { keys: ['生姜', 'しょうが'], p: 0.9, f: 0.3, c: 6.6, unitGrams: { かけ: 15, 片: 10 } },
  { keys: ['大葉', 'しそ'], p: 3.9, f: 0.1, c: 7.5, unitGrams: { 枚: 1 } },
  { keys: ['ほうれん草', 'ホウレンソウ'], p: 2.2, f: 0.4, c: 3.1, unitGrams: { 束: 200 } },
  { keys: ['人参', 'にんじん'], p: 0.6, f: 0.1, c: 9.3, unitGrams: { 本: 150, 個: 150 } },
  { keys: ['木綿豆腐', '豆腐'], p: 6.6, f: 4.2, c: 1.6, unitGrams: { 丁: 300, 丁丁: 300 } },
  { keys: ['塩昆布', '塩こんぶ'], p: 16.7, f: 2.5, c: 30.0, unitGrams: {} },
  { keys: ['ポン酢'], p: 1.8, f: 0.0, c: 8.2, tbsp: 15, tsp: 5 },
  { keys: ['しょうゆ', '醤油'], p: 7.7, f: 0.0, c: 7.9, tbsp: 15, tsp: 5 },
  { keys: ['ごま油', '胡麻油'], p: 0.0, f: 100.0, c: 0.0, tbsp: 12, tsp: 4 },
  { keys: ['サラダ油', 'オリーブ油', '油'], p: 0.0, f: 100.0, c: 0.0, tbsp: 12, tsp: 4 },
  { keys: ['酒'], p: 0.4, f: 0.0, c: 5.0, tbsp: 15, tsp: 5 },
  { keys: ['みりん'], p: 0.3, f: 0.0, c: 43.0, tbsp: 15, tsp: 5 },
  { keys: ['砂糖'], p: 0.0, f: 0.0, c: 99.3, tbsp: 9, tsp: 3 },
  { keys: ['片栗粉'], p: 0.1, f: 0.1, c: 81.6, tbsp: 9, tsp: 3 }
];

KitchenGit.Nutrition = (function () {
  function normalizeName(name) {
    return String(name || '')
      .replace(/（.*?）|\(.*?\)/g, '')
      .replace(/\s+/g, '')
      .toLowerCase();
  }

  function matchFood(name) {
    const n = normalizeName(name);
    if (!n) return null;
    let best = null;
    let bestPos = Infinity;
    let bestLen = 0;
    KitchenGit.NUTRITION_FOODS.forEach((food) => {
      food.keys.forEach((key) => {
        const pos = n.indexOf(key);
        if (pos < 0) return;
        // 先頭に近いキーを優先（「ポン酢しょうゆ」が「しょうゆ」に食われないようにする）
        if (pos < bestPos || (pos === bestPos && key.length > bestLen)) {
          best = food;
          bestPos = pos;
          bestLen = key.length;
        }
      });
    });
    return best;
  }

  function gramsOf(ing, food) {
    const amount = Number(ing.baseAmount);
    if (!Number.isFinite(amount) || amount <= 0) return null;
    const unit = String(ing.unit || 'g').trim();
    if (unit === 'g' || unit === 'ml') return amount;
    if (unit === 'kg') return amount * 1000;
    if (unit === '大さじ') return amount * (food.tbsp || 15);
    if (unit === '小さじ') return amount * (food.tsp || 5);
    if (food.unitGrams && food.unitGrams[unit] != null) return amount * food.unitGrams[unit];
    return null;
  }

  function round1(n) {
    return Math.round(n * 10) / 10;
  }

  function computePerServing(ingredients, servingsBase) {
    const base = Number(servingsBase) > 0 ? Number(servingsBase) : 2;
    let p = 0;
    let f = 0;
    let c = 0;
    const unmatched = [];
    (ingredients || []).forEach((ing) => {
      const food = matchFood(ing.name);
      const grams = food ? gramsOf(ing, food) : null;
      if (!food || grams == null) {
        if (ing.name) unmatched.push(ing.name);
        return;
      }
      p += (food.p * grams) / 100;
      f += (food.f * grams) / 100;
      c += (food.c * grams) / 100;
    });
    const kcal = p * 4 + f * 9 + c * 4;
    return {
      p: round1(p / base),
      f: round1(f / base),
      c: round1(c / base),
      kcal: Math.round(kcal / base),
      unmatched
    };
  }

  return { matchFood, computePerServing };
})();
