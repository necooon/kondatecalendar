window.KitchenGit = window.KitchenGit || {};

/**
 * DB JSONB の正（types/supabase.ts の recipes.Row と対応）:
 * - ingredients: { name, base_amount, unit, note? }[]
 * - steps: { title?, instruction, timer_seconds, uses? }[]
 * - pfc: { p, f, c, kcal } | null
 * - tags: string[]
 * - versions: { [versionKey]: VersionJson }
 * - branch: 作業ブランチ名
 *
 * UI は camelCase（baseAmount / timer / servingsBase / committedAt）。
 *
 * @typedef {object} RecipeIngredient
 * @property {string} name
 * @property {number} baseAmount
 * @property {string} unit
 * @property {string} [note]
 *
 * @typedef {object} RecipeStep
 * @property {string} [title]
 * @property {string} instruction
 * @property {number | null} timer
 * @property {string[]} [uses]
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
 * @property {string} branch
 * @property {string} hash
 * @property {string} author
 * @property {string} committedAt
 * @property {RecipeIngredient[]} ingredients
 * @property {RecipeStep[]} steps
 *
 * @typedef {object} Recipe
 * @property {string} id
 * @property {string} name
 * @property {string} tag
 * @property {string[]} tags
 * @property {string} branch
 * @property {number} servingsBase
 * @property {RecipePfc | null} pfc
 * @property {Object<string, RecipeVersion>} versions
 */

KitchenGit.RecipeModel = (function () {
  function shortHash(seed) {
    const s = String(seed || '');
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16).padStart(8, '0').slice(0, 7);
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function ingredientsToDb(ingredients) {
    return (ingredients || []).map((ing) => ({
      name: ing.name,
      base_amount: ing.baseAmount,
      unit: ing.unit,
      note: ing.note || ''
    }));
  }

  function ingredientsFromDb(raw) {
    return (Array.isArray(raw) ? raw : []).map((i) => ({
      name: i.name,
      baseAmount: Number(i.base_amount != null ? i.base_amount : i.baseAmount),
      unit: i.unit,
      note: i.note || ''
    }));
  }

  function stepsToDb(steps) {
    return (steps || []).map((step) => ({
      title: step.title || '',
      instruction: step.instruction,
      timer_seconds: step.timer == null ? null : step.timer,
      uses: Array.isArray(step.uses) ? step.uses : []
    }));
  }

  function stepsFromDb(raw) {
    return (Array.isArray(raw) ? raw : []).map((s) => ({
      title: s.title || '',
      instruction: s.instruction,
      timer: s.timer_seconds == null && s.timer == null ? null : Number(s.timer_seconds != null ? s.timer_seconds : s.timer),
      uses: Array.isArray(s.uses) ? s.uses : []
    }));
  }

  function versionToDb(version) {
    if (!version) return null;
    return {
      title: version.title || '',
      rating: version.rating || '★4.0',
      message: version.message || '',
      note: version.note || '',
      sort_order: version.sortOrder || 0,
      branch: version.branch || 'main',
      hash: version.hash || shortHash(version.title + version.message),
      author: version.author || 'You',
      committed_at: version.committedAt || new Date().toISOString(),
      ingredients: ingredientsToDb(version.ingredients),
      steps: stepsToDb(version.steps)
    };
  }

  function versionFromDb(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      title: raw.title || '',
      rating: raw.rating || '★4.0',
      message: raw.message || '',
      note: raw.note || '',
      sortOrder: raw.sort_order != null ? raw.sort_order : (raw.sortOrder || 0),
      branch: raw.branch || 'main',
      hash: raw.hash || shortHash(raw.title + (raw.committed_at || raw.committedAt || '')),
      author: raw.author || 'You',
      committedAt: raw.committed_at || raw.committedAt || new Date().toISOString(),
      ingredients: ingredientsFromDb(raw.ingredients),
      steps: stepsFromDb(raw.steps)
    };
  }

  function versionsToDb(versions) {
    const out = {};
    Object.keys(versions || {}).forEach((key) => {
      out[key] = versionToDb(versions[key]);
    });
    return out;
  }

  function versionsFromDb(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
    const out = {};
    Object.keys(raw).forEach((key) => {
      const v = versionFromDb(raw[key]);
      if (v) out[key] = v;
    });
    return out;
  }

  function versionKeysNewestFirst(versions) {
    return Object.keys(versions || {}).sort((a, b) => (versions[b].sortOrder || 0) - (versions[a].sortOrder || 0));
  }

  function pickHead(recipe, branch) {
    const versions = (recipe && recipe.versions) || {};
    const wanted = branch || (recipe && recipe.branch) || 'main';
    const keys = versionKeysNewestFirst(versions);
    const onBranch = keys.filter((k) => (versions[k].branch || 'main') === wanted);
    const key = (onBranch[0] || keys[0]);
    if (!key) return { key: 'v1.0', version: { ingredients: [], steps: [] } };
    return { key, version: versions[key] };
  }

  function branchesOf(recipe) {
    const versions = (recipe && recipe.versions) || {};
    const set = new Set();
    Object.keys(versions).forEach((k) => set.add(versions[k].branch || 'main'));
    if (recipe && recipe.branch) set.add(recipe.branch);
    if (!set.size) set.add('main');
    return Array.from(set);
  }

  function versionsOnBranch(versions, branch) {
    const wanted = branch || 'main';
    const out = {};
    Object.keys(versions || {}).forEach((key) => {
      if ((versions[key].branch || 'main') === wanted) out[key] = versions[key];
    });
    return out;
  }

  function inferUses(instruction, ingredients) {
    const text = String(instruction || '');
    return (ingredients || []).filter((ing) => {
      const name = String(ing.name || '').replace(/（.*?）|\(.*?\)/g, '').trim();
      if (!name) return false;
      if (text.includes(ing.name) || text.includes(name)) return true;
      const token = name.split(/[\s・]/)[0];
      return token.length >= 2 && text.includes(token);
    }).map((ing) => ing.name);
  }

  function scaleAmount(baseAmount, servings, servingsBase) {
    const base = Number(servingsBase) > 0 ? Number(servingsBase) : 2;
    const scale = Number(servings) / base;
    return Math.round(Number(baseAmount) * scale * 10) / 10;
  }

  function formatTimerLabel(seconds) {
    if (seconds == null || !Number.isFinite(Number(seconds)) || Number(seconds) <= 0) return '';
    const sec = Number(seconds);
    if (sec < 60) return `約${sec}秒`;
    const mins = Math.round(sec / 60);
    return `約${mins}分`;
  }

  function formatCommittedAt(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${y}/${m}/${day} ${hh}:${mm}`;
  }

  function fallbackVersion(row, ingredients, steps) {
    const created = row.created_at || new Date().toISOString();
    return {
      title: 'v1.0 (初回作成)',
      rating: '★4.0',
      message: '初回作成',
      note: '',
      sortOrder: 0,
      branch: row.branch || 'main',
      hash: shortHash((row.id || '') + 'v1.0' + created),
      author: 'You',
      committedAt: created,
      ingredients,
      steps
    };
  }

  return {
    shortHash,
    clone,
    ingredientsToDb,
    ingredientsFromDb,
    stepsToDb,
    stepsFromDb,
    versionsToDb,
    versionsFromDb,
    versionKeysNewestFirst,
    pickHead,
    branchesOf,
    versionsOnBranch,
    inferUses,
    scaleAmount,
    formatTimerLabel,
    formatCommittedAt,
    fallbackVersion
  };
})();

KitchenGit.demoRecipes = function demoRecipes() {
  const M = KitchenGit.RecipeModel;
  const stepsV12 = [
    { title: '下味', instruction: '鶏むね肉は一口大の削ぎ切りにし、酒小さじ1・片栗粉小さじ1を揉み込んでおきます。', timer: null, uses: ['鶏むね肉 (皮なし)'] },
    { title: '焼く', instruction: 'フライパンにごま油小さじ1を中火で熱し、鶏むね肉を焼き色がつくまで約3分焼きます。', timer: 180, uses: ['ごま油', '鶏むね肉 (皮なし)'] },
    { title: '炒める', instruction: '乱切りにした秋茄子と千切り生姜を加え、茄子がしんなりするまで約2分炒め合わせます。', timer: 120, uses: ['秋茄子', '生姜 (千切り)'] },
    { title: '仕上げ', instruction: '火を止める直前にポン酢を回し入れ、強火でサッと絡めます。器に盛り千切り大葉を散らして完成！', timer: null, uses: ['ポン酢しょうゆ', '大葉'] }
  ];
  const stepsV11 = [
    { title: '下味', instruction: '鶏むね肉は一口大の削ぎ切りにし、酒小さじ1・片栗粉小さじ1を揉み込んでおきます。', timer: null, uses: ['鶏むね肉 (皮なし)'] },
    { title: '焼く', instruction: 'フライパンにごま油小さじ1を中火で熱し、鶏むね肉を焼き色がつくまで約3分焼きます。', timer: 180, uses: ['ごま油', '鶏むね肉 (皮なし)'] },
    { title: '炒める', instruction: '乱切りにした秋茄子とすりおろし生姜を加え、茄子がしんなりするまで約2分炒め合わせます。', timer: 120, uses: ['秋茄子', '生姜 (すりおろし)'] },
    { title: '仕上げ', instruction: '火を止める直前にポン酢を回し入れ、器に盛り大葉を散らして完成。', timer: null, uses: ['ポン酢しょうゆ', '大葉'] }
  ];
  const stepsV10 = [
    { title: '下味', instruction: '鶏むね肉は一口大の削ぎ切りにし、酒小さじ1・片栗粉小さじ1を揉み込んでおきます。', timer: null, uses: ['鶏むね肉 (皮なし)'] },
    { title: '焼く', instruction: 'フライパンにごま油小さじ1を中火で熱し、鶏むね肉を焼き色がつくまで約3分焼きます。', timer: 180, uses: ['ごま油', '鶏むね肉 (皮なし)'] },
    { title: '炒める', instruction: '乱切りにした秋茄子とすりおろし生姜を加え、茄子がしんなりするまで約2分炒め合わせます。', timer: 120, uses: ['秋茄子', '生姜 (すりおろし)'] },
    { title: '仕上げ', instruction: '火を止める直前にポン酢を回し入れ、強火でサッと絡めて完成。', timer: null, uses: ['ポン酢しょうゆ'] }
  ];
  return [
    {
      id: 'demo-chicken',
      name: '鶏むね肉と秋茄子のさっぱり炒め',
      tag: '定番 #02',
      tags: ['鶏肉', '炒め物', 'さっぱり'],
      branch: 'main',
      servingsBase: 2,
      pfc: { p: 36.4, f: 5.0, c: 6.8, kcal: 217 },
      versions: {
        'v1.2': {
          title: 'v1.2 (最新: 生姜増量・大葉)',
          rating: '★4.9',
          message: '生姜増量・大葉',
          note: '',
          sortOrder: 2,
          branch: 'main',
          hash: 'f48b9c2',
          author: 'You',
          committedAt: '2026-09-08T12:40:00+09:00',
          steps: stepsV12,
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
          branch: 'main',
          hash: M.shortHash('demo-chicken|v1.1'),
          author: 'You',
          committedAt: '2026-09-05T19:10:00+09:00',
          steps: stepsV11,
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
          branch: 'main',
          hash: M.shortHash('demo-chicken|v1.0'),
          author: 'You',
          committedAt: '2026-09-01T18:00:00+09:00',
          steps: stepsV10,
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
  const M = () => KitchenGit.RecipeModel;

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

  function snapshotPayload(recipe) {
    const model = M();
    const head = model.pickHead(recipe);
    const v = head.version || {};
    return {
      name: recipe.name,
      tag: recipe.tag || '',
      tags: Array.isArray(recipe.tags) ? recipe.tags : [],
      branch: recipe.branch || 'main',
      servings_base: recipe.servingsBase || 2,
      pfc: recipe.pfc || null,
      ingredients: model.ingredientsToDb(v.ingredients),
      steps: model.stepsToDb(v.steps),
      versions: model.versionsToDb(recipe.versions)
    };
  }

  function mapRow(row) {
    const model = M();
    const ingredients = model.ingredientsFromDb(row.ingredients);
    const steps = model.stepsFromDb(row.steps);
    let versions = model.versionsFromDb(row.versions);
    if (!Object.keys(versions).length) {
      versions = { 'v1.0': model.fallbackVersion(row, ingredients, steps) };
    }
    const tags = Array.isArray(row.tags) ? row.tags.slice() : [];
    return {
      id: row.id,
      name: row.name,
      tag: row.tag || '',
      tags,
      branch: row.branch || 'main',
      servingsBase: row.servings_base || 2,
      pfc: row.pfc || null,
      versions
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
    const { data: recipeRow, error: recipeErr } = await client
      .from('recipes')
      .insert(snapshotPayload(recipe))
      .select()
      .single();
    throwIfError(recipeErr);
    return mapRow(recipeRow);
  }

  async function updateRecipe(recipe) {
    if (!client) throw new Error('cloud-not-ready');
    if (!recipe || !recipe.id) throw new Error('missing-id');
    const { data, error } = await client
      .from('recipes')
      .update(snapshotPayload(recipe))
      .eq('id', recipe.id)
      .select()
      .single();
    throwIfError(error);
    return mapRow(data);
  }

  async function insertVersion(recipeId, versionKey, version) {
    if (!client) throw new Error('cloud-not-ready');
    const { data: row, error } = await client
      .from('recipes')
      .select('*')
      .eq('id', recipeId)
      .single();
    throwIfError(error);
    const mapped = mapRow(row);
    mapped.versions = mapped.versions || {};
    mapped.versions[versionKey] = version;
    mapped.branch = version.branch || mapped.branch || 'main';
    return updateRecipe(mapped);
  }

  async function hydrateLegacy(recipes) {
    const model = M();
    const demoByName = {};
    KitchenGit.demoRecipes().forEach((demo) => {
      demoByName[demo.name] = demo;
    });
    const result = [];
    for (const recipe of recipes) {
      const demo = demoByName[recipe.name];
      const keys = Object.keys(recipe.versions || {});
      const inferred = keys.length === 1 && keys[0] === 'v1.0' && recipe.versions['v1.0'].message === '初回作成';
      if (!demo || !inferred) {
        result.push(recipe);
        continue;
      }
      recipe.tags = (demo.tags || []).slice();
      recipe.branch = demo.branch || 'main';
      recipe.pfc = demo.pfc || recipe.pfc;
      recipe.versions = model.clone(demo.versions);
      try {
        result.push(await updateRecipe(recipe));
      } catch (e) {
        console.error('version hydrate failed', e);
        result.push(recipe);
      }
    }
    return result;
  }

  async function seedIfEmpty() {
    const existing = await fetchAll();
    if (existing.length) return hydrateLegacy(existing);
    const seeded = [];
    for (const demo of KitchenGit.demoRecipes()) {
      const { id, ...rest } = demo;
      seeded.push(await insertRecipe(rest));
    }
    return seeded;
  }

  return { init, isReady, fetchAll, insertRecipe, insertVersion, updateRecipe, seedIfEmpty, mapRow };
})();
