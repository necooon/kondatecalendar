window.KitchenGit = window.KitchenGit || {};

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
      pfc: { p: 38.4, f: 7.8, c: 42.0, kcal: 392 },
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

  function mapRow(row) {
    const versions = {};
    const versionRows = (row.recipe_versions || []).slice().sort((a, b) => (b.sort_order || 0) - (a.sort_order || 0));
    versionRows.forEach((v) => {
      const ings = (v.recipe_ingredients || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const steps = (v.recipe_steps || []).slice().sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      versions[v.version_key] = {
        id: v.id,
        title: v.title,
        rating: v.rating,
        message: v.message || '',
        note: v.note || '',
        sortOrder: v.sort_order || 0,
        ingredients: ings.map((i) => ({
          name: i.name,
          baseAmount: Number(i.base_amount),
          unit: i.unit,
          note: i.note || ''
        })),
        steps: steps.map((s) => ({
          instruction: s.instruction,
          timer: s.timer_seconds == null ? null : Number(s.timer_seconds)
        }))
      };
    });
    return {
      id: row.id,
      name: row.name,
      tag: row.tag || '',
      servingsBase: row.servings_base || 2,
      pfc: row.pfc || null,
      versions
    };
  }

  async function fetchAll() {
    if (!client) throw new Error('cloud-not-ready');
    const { data, error } = await client
      .from('recipes')
      .select('*, recipe_versions(*, recipe_ingredients(*), recipe_steps(*))')
      .order('created_at', { ascending: false });
    throwIfError(error);
    return (data || []).map(mapRow);
  }

  async function insertIngredientsAndSteps(versionId, version) {
    const ings = (version.ingredients || []).map((ing, idx) => ({
      version_id: versionId,
      name: ing.name,
      base_amount: ing.baseAmount,
      unit: ing.unit,
      note: ing.note || '',
      sort_order: idx
    }));
    if (ings.length) {
      const { error } = await client.from('recipe_ingredients').insert(ings);
      throwIfError(error);
    }
    const steps = (version.steps || []).map((step, idx) => ({
      version_id: versionId,
      instruction: step.instruction,
      timer_seconds: step.timer == null ? null : step.timer,
      sort_order: idx
    }));
    if (steps.length) {
      const { error } = await client.from('recipe_steps').insert(steps);
      throwIfError(error);
    }
  }

  async function insertRecipe(recipe) {
    if (!client) throw new Error('cloud-not-ready');
    const { data: recipeRow, error: recipeErr } = await client
      .from('recipes')
      .insert({
        name: recipe.name,
        tag: recipe.tag || '',
        servings_base: recipe.servingsBase || 2,
        pfc: recipe.pfc || null
      })
      .select()
      .single();
    throwIfError(recipeErr);

    const versionEntries = Object.keys(recipe.versions || {}).map((key) => ({ key, v: recipe.versions[key] }));
    versionEntries.sort((a, b) => (a.v.sortOrder || 0) - (b.v.sortOrder || 0));
    if (!versionEntries.length) {
      versionEntries.push({
        key: 'v1.0',
        v: {
          title: 'v1.0 (初回作成)',
          rating: '★4.0',
          message: '初回作成',
          note: '',
          sortOrder: 0,
          ingredients: [],
          steps: []
        }
      });
    }

    for (const { key, v } of versionEntries) {
      const { data: verRow, error: verErr } = await client
        .from('recipe_versions')
        .insert({
          recipe_id: recipeRow.id,
          version_key: key,
          title: v.title || key,
          rating: v.rating || '★4.0',
          message: v.message || '',
          note: v.note || '',
          sort_order: v.sortOrder || 0
        })
        .select()
        .single();
      throwIfError(verErr);
      await insertIngredientsAndSteps(verRow.id, v);
    }

    const all = await fetchAll();
    return all.find((r) => r.id === recipeRow.id) || mapRow({ ...recipeRow, recipe_versions: [] });
  }

  async function insertVersion(recipeId, versionKey, version) {
    if (!client) throw new Error('cloud-not-ready');
    const { data: verRow, error: verErr } = await client
      .from('recipe_versions')
      .insert({
        recipe_id: recipeId,
        version_key: versionKey,
        title: version.title || versionKey,
        rating: version.rating || '★4.0',
        message: version.message || '',
        note: version.note || '',
        sort_order: version.sortOrder || 0
      })
      .select()
      .single();
    throwIfError(verErr);
    await insertIngredientsAndSteps(verRow.id, version);
    return verRow.id;
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
