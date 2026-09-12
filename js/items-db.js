window.KitchenGit = window.KitchenGit || {};

/**
 * @typedef {object} FoodItem
 * @property {string} id
 * @property {string} name
 * @property {string} category
 * @property {string} unit
 */

KitchenGit.ItemsDB = (function () {
  const FOOD_CATEGORIES = ['食品・調味料', '水・コーヒー・お茶・飲料'];
  const DEFAULT_CATEGORY = '食品・調味料';

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
      console.error('Supabase items init failed', e);
      client = null;
      return false;
    }
  }

  function isReady() {
    return !!client;
  }

  function normalizeName(name) {
    return String(name || '').trim();
  }

  function namesMatch(a, b) {
    const left = normalizeName(a);
    const right = normalizeName(b);
    if (!left || !right) return false;
    return left.toLowerCase() === right.toLowerCase();
  }

  function mapRow(row) {
    return {
      id: row.id,
      name: row.name || '',
      category: row.category || '',
      unit: row.unit || ''
    };
  }

  function isFoodCategory(category) {
    return FOOD_CATEGORIES.includes(category || '');
  }

  function sortByName(items) {
    return (items || []).slice().sort((a, b) => {
      return String(a.name || '').localeCompare(String(b.name || ''), 'ja');
    });
  }

  function findByNameInList(items, name) {
    const q = normalizeName(name);
    if (!q) return null;
    return (items || []).find((item) => namesMatch(item.name, q)) || null;
  }

  async function fetchFoodItems() {
    if (!client) throw new Error('cloud-not-ready');
    const { data, error } = await client
      .from('items')
      .select('id, name, category, unit')
      .in('category', FOOD_CATEGORIES)
      .order('name', { ascending: true });
    throwIfError(error);
    return sortByName((data || []).map(mapRow));
  }

  async function findByName(name) {
    const items = await fetchFoodItems();
    return findByNameInList(items, name);
  }

  async function insertFoodByName(name) {
    const trimmed = normalizeName(name);
    if (!trimmed) throw new Error('材料名を入力してください');

    const existing = await findByName(trimmed);
    if (existing) return existing;

    if (!client) throw new Error('cloud-not-ready');
    const { data, error } = await client
      .from('items')
      .insert({
        name: trimmed,
        category: DEFAULT_CATEGORY,
        unit: '個',
        count: 0,
        target_qty: 0,
        order_threshold: 0,
        entered: false,
        purchase_destinations: []
      })
      .select('id, name, category, unit')
      .single();
    throwIfError(error);
    return mapRow(data);
  }

  return {
    FOOD_CATEGORIES,
    DEFAULT_CATEGORY,
    init,
    isReady,
    normalizeName,
    namesMatch,
    isFoodCategory,
    sortByName,
    findByNameInList,
    fetchFoodItems,
    findByName,
    insertFoodByName,
    mapRow
  };
})();
