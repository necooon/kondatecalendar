window.KitchenGit = window.KitchenGit || {};

/**
 * DB JSONB の正（types/supabase.ts の recipes.Row と対応）:
 * - ingredients: { name: string, base_amount: number, unit: string, note?: string }[]
 * - steps: { instruction: string, timer_seconds: number | null }[]
 * - pfc: { p: number, f: number, c: number, kcal: number } | null
 *
 * UI は camelCase（baseAmount / timer / servingsBase）と versions マップを使う。
 * クラウドは材料・手順の最新スナップショットのみ保持する（味バージョン履歴は後続）。
 *
 * @typedef {object} RecipeIngredient
 * @property {string} name
 * @property {number} baseAmount
 * @property {string} unit
 * @property {string} [note]
 *
 * @typedef {object} RecipeStep
 * @property {string} instruction
 * @property {number | null} timer
 *
 * @typedef {object} RecipePfc
 * @property {number} p
 * @property {number} f
 * @property {number} c
 * @property {number} kcal
 *
 * @typedef {object} RecipeVersion
 * @property {string} title
 * @property {string} rating
 * @property {string} message
 * @property {string} note
 * @property {number} sortOrder
 * @property {RecipeIngredient[]} ingredients
 * @property {RecipeStep[]} steps
 *
 * @typedef {object} Recipe
 * @property {string} id
 * @property {string} name
 * @property {string} tag
 * @property {number} servingsBase
 * @property {RecipePfc | null} pfc
 * @property {Object<string, RecipeVersion>} versions
 */

KitchenGit.demoRecipes = function demoRecipes() {
  const chickenSteps = [
    { instruction: '鶏むね肉は一口大の削ぎ切りにし、酒小さじ1・片栗粉小さじ1を揉み込んでおきます。', timer: null },
    { instruction: 'フライパンにごま油小さじ1を中火で熱し、鶏むね肉を焼き色がつくまで約3分焼きます。', timer: 180 },
    { instruction: '乱切りにした秋茄子と千切り生姜を加え、茄子がしんなりするまで約2分炒め合わせます。', timer: 120 },
    { instruction: '火を止める直前にポン酢を回し入れ、強火でサッと絡めます。器に盛り千切り大葉を散らして完成！', timer: null }
  ];
  return [
    {
      id: 'demo-chicken',
      name: '鶏むね肉と秋茄子のさっぱり炒め',
      tag: '定番 #02',
      servingsBase: 2,
      pfc: { p: 36.4, f: 5.0, c: 6.8, kcal: 217 },
      versions: {
        'v1.2': {
          title: 'v1.2 (最新: 生姜増量・大葉)',
          rating: '★4.9',
          message: '生姜増量・大葉',
          note: '',
          sortOrder: 2,
          steps: chickenSteps,
          ingredients: [
            { name: '鶏むね肉 (皮なし)', baseAmount: 300, unit: 'g', note: '削ぎ切り' },
            { name: '秋茄子', baseAmount: 2, unit: '本', note: '乱切り' },
            { name: '生姜 (千切り)', baseAmount: 15, unit: 'g', note: '' },
            { name: '大葉', baseAmount: 5, unit: '枚', note: '仕上げにトッピング' },
            { name: 'ポン酢しょうゆ', baseAmount: 3, unit: '大さじ', note: '' },
            { name: 'ごま油', baseAmount: 1, unit: '小さじ', note: '炒め油' }
          ]
        },
        'v1.1': {
          title: 'v1.1 (大葉追加)',
          rating: '★4.5',
          message: '大葉追加',
          note: '',
          sortOrder: 1,
          steps: chickenSteps,
          ingredients: [
            { name: '鶏むね肉 (皮なし)', baseAmount: 300, unit: 'g', note: '' },
            { name: '秋茄子', baseAmount: 2, unit: '本', note: '' },
            { name: '生姜 (すりおろし)', baseAmount: 5, unit: 'g', note: '' },
            { name: '大葉', baseAmount: 5, unit: '枚', note: 'さっぱり感をプラス' },
            { name: 'ポン酢しょうゆ', baseAmount: 2, unit: '大さじ', note: '' },
            { name: 'ごま油', baseAmount: 1, unit: '小さじ', note: '' }
          ]
        },
        'v1.0': {
          title: 'v1.0 (初回作成)',
          rating: '★4.0',
          message: '初回作成',
          note: '',
          sortOrder: 0,
          steps: chickenSteps,
          ingredients: [
            { name: '鶏むね肉 (皮なし)', baseAmount: 300, unit: 'g', note: '' },
            { name: '秋茄子', baseAmount: 2, unit: '本', note: '' },
            { name: '生姜 (すりおろし)', baseAmount: 5, unit: 'g', note: '' },
            { name: 'ポン酢しょうゆ', baseAmount: 2, unit: '大さじ', note: '' },
            { name: 'ごま油', baseAmount: 1, unit: '小さじ', note: '' }
          ]
        }
      }
    }
  ];
};

KitchenGit.RecipesDB = (function () {
  let client = null;

  function throwIfError(error) {
    if (error) throw error;
  }

  function init() {
    const cfg = KitchenGit.SUPABASE_CONFIG;
    if (typeof supabase === 'undefined' || !supabase.createClient || !cfg) {
      client = null;
      return false;
    }
    try {
      client = supabase.createClient(cfg.url, cfg.anonKey);
      return true;
    } catch (e) {
      console.error('Supabase init failed', e);
      client = null;
      return false;
    }
  }

  function isReady() {
    return !!client;
  }

  function pickPersistedVersion(recipe) {
    const versions = recipe.versions || {};
    const entries = Object.keys(versions).map((key) => ({ key, v: versions[key] }));
    if (!entries.length) {
      return { ingredients: [], steps: [] };
    }
    entries.sort((a, b) => (b.v.sortOrder || 0) - (a.v.sortOrder || 0));
    return entries[0].v;
  }

  function ingredientsToDb(ingredients) {
    return (ingredients || []).map((ing) => ({
      name: ing.name,
      base_amount: ing.baseAmount,
      unit: ing.unit,
      note: ing.note || ''
    }));
  }

  function stepsToDb(steps) {
    return (steps || []).map((step) => ({
      instruction: step.instruction,
      timer_seconds: step.timer == null ? null : step.timer
    }));
  }

  function mapRow(row) {
    const ingredients = (Array.isArray(row.ingredients) ? row.ingredients : []).map((i) => ({
      name: i.name,
      baseAmount: Number(i.base_amount),
      unit: i.unit,
      note: i.note || ''
    }));
    const steps = (Array.isArray(row.steps) ? row.steps : []).map((s) => ({
      instruction: s.instruction,
      timer: s.timer_seconds == null ? null : Number(s.timer_seconds)
    }));
    return {
      id: row.id,
      name: row.name,
      tag: row.tag || '',
      servingsBase: row.servings_base || 2,
      pfc: row.pfc || null,
      versions: {
        'v1.0': {
          title: 'v1.0 (初回作成)',
          rating: '★4.0',
          message: '初回作成',
          note: '',
          sortOrder: 0,
          ingredients,
          steps
        }
      }
    };
  }

  async function fetchAll() {
    if (!client) throw new Error('cloud-not-ready');
    const { data, error } = await client
      .from('recipes')
      .select('*')
      .order('created_at', { ascending: false });
    throwIfError(error);
    return (data || []).map(mapRow);
  }

  async function insertRecipe(recipe) {
    if (!client) throw new Error('cloud-not-ready');
    const persisted = pickPersistedVersion(recipe);
    const { data: recipeRow, error: recipeErr } = await client
      .from('recipes')
      .insert({
        name: recipe.name,
        tag: recipe.tag || '',
        servings_base: recipe.servingsBase || 2,
        pfc: recipe.pfc || null,
        ingredients: ingredientsToDb(persisted.ingredients),
        steps: stepsToDb(persisted.steps)
      })
      .select()
      .single();
    throwIfError(recipeErr);
    return mapRow(recipeRow);
  }

  async function insertVersion(_recipeId, _versionKey, _version) {
    // 味バージョン履歴は未永続化（材料・手順 JSONB のみ）。メモリ上のコミットは呼び出し側で残る。
    return null;
  }

  async function seedIfEmpty() {
    const existing = await fetchAll();
    if (existing.length) return existing;
    const seeded = [];
    for (const demo of KitchenGit.demoRecipes()) {
      const { id, ...rest } = demo;
      seeded.push(await insertRecipe(rest));
    }
    return seeded;
  }

  return { init, isReady, fetchAll, insertRecipe, insertVersion, seedIfEmpty };
})();
