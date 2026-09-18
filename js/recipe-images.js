/**
 * recipe-images.js
 * レシピ写真の追加・変更・プレビュー・プリセット選択・ファイル最適化の管理
 */
window.KitchenGit = window.KitchenGit || {};

(function () {
  let modalSelectedImage = null;

  function ImageUtils() {
    return window.KitchenGit.ImageUtils;
  }

  function RecipesDB() {
    return window.KitchenGit.RecipesDB;
  }

  // ==================== 1. レシピ詳細の料理写真モーダル ====================

  function renderRecipeImagePresets() {
    const box = document.getElementById('recipe-image-presets');
    if (!box) return;
    const utils = ImageUtils();
    const presets = (utils && utils.PRESET_RECIPE_IMAGES) || [];
    box.innerHTML = presets.map((p) => `
      <button type="button" onclick="setRecipeImageModalPreview('${p.url}')" class="active-scale group relative rounded-xl overflow-hidden aspect-square border border-slate-200 hover:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all bg-slate-100" title="${escapeAttr(p.title)}">
        <img src="${p.url}" alt="${escapeAttr(p.title)}" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" loading="lazy">
        <span class="absolute inset-x-0 bottom-0 bg-black/60 backdrop-blur-xs text-[8.5px] text-white font-bold py-0.5 px-0.5 truncate text-center block">
          ${escapeAttr(p.title.split('・')[0])}
        </span>
      </button>
    `).join('');
  }

  function openRecipeImageModal() {
    const recipe = typeof window.selectedRecipe === 'function' ? window.selectedRecipe() : null;
    if (!recipe) {
      if (typeof window.showToast === 'function') window.showToast('レシピが選択されていません', 'error');
      return;
    }
    const nameEl = document.getElementById('recipe-image-target-name');
    if (nameEl) nameEl.textContent = recipe.name || '';

    renderRecipeImagePresets();

    modalSelectedImage = recipe.imageUrl || '';
    setRecipeImageModalPreview(modalSelectedImage);

    const urlInput = document.getElementById('recipe-image-url-input');
    if (urlInput) urlInput.value = '';

    const backdrop = document.getElementById('recipe-image-modal-backdrop');
    const modal = document.getElementById('recipe-image-modal');
    if (backdrop) backdrop.classList.remove('hidden');
    if (modal) modal.classList.remove('hidden');
  }

  function closeRecipeImageModal() {
    const backdrop = document.getElementById('recipe-image-modal-backdrop');
    const modal = document.getElementById('recipe-image-modal');
    if (backdrop) backdrop.classList.add('hidden');
    if (modal) modal.classList.add('hidden');
  }

  function setRecipeImageModalPreview(url) {
    modalSelectedImage = (url && String(url).trim()) || null;
    const previewImg = document.getElementById('recipe-image-preview-img');
    const placeholder = document.getElementById('recipe-image-placeholder');
    const clearBtn = document.getElementById('recipe-image-clear-btn');

    if (modalSelectedImage) {
      if (previewImg) {
        previewImg.src = modalSelectedImage;
        previewImg.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (clearBtn) clearBtn.classList.remove('hidden');
    } else {
      if (previewImg) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
      }
      if (placeholder) placeholder.classList.remove('hidden');
      if (clearBtn) clearBtn.classList.add('hidden');
    }
  }

  function clearRecipeImageModalSelection() {
    setRecipeImageModalPreview('');
    const urlInput = document.getElementById('recipe-image-url-input');
    if (urlInput) urlInput.value = '';
  }

  function applyRecipeImageUrlInput() {
    const input = document.getElementById('recipe-image-url-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) {
      if (typeof window.showToast === 'function') window.showToast('URLを入力してください', 'error');
      return;
    }
    setRecipeImageModalPreview(val);
    if (typeof window.showToast === 'function') window.showToast('プレビューに反映しました');
  }

  async function saveRecipeImageModal() {
    const recipe = typeof window.selectedRecipe === 'function' ? window.selectedRecipe() : null;
    if (!recipe) return;

    const saveBtn = document.getElementById('recipe-image-save-btn');
    if (saveBtn) saveBtn.disabled = true;

    try {
      recipe.imageUrl = modalSelectedImage || null;

      if (typeof window.canPersistRecipe === 'function' && window.canPersistRecipe(recipe)) {
        const updated = await window.persistRecipe(recipe);
        if (window.appState && Array.isArray(window.appState.recipes)) {
          const idx = window.appState.recipes.findIndex((r) => r.id === recipe.id);
          if (idx >= 0) window.appState.recipes[idx] = updated;
        }
      } else if (window.appState && Array.isArray(window.appState.recipes)) {
        const idx = window.appState.recipes.findIndex((r) => r.id === recipe.id);
        if (idx >= 0) window.appState.recipes[idx] = { ...recipe };
      }

      closeRecipeImageModal();

      if (typeof window.renderRecipeView === 'function') window.renderRecipeView();
      if (typeof window.renderRecipeList === 'function') window.renderRecipeList();
      if (typeof window.showToast === 'function') {
        window.showToast(recipe.imageUrl ? '料理写真を更新しました！' : '料理写真を削除しました');
      }
    } catch (err) {
      console.error(err);
      const errMsg = err && err.message ? `写真の保存に失敗しました: ${err.message}` : '写真の保存に失敗しました';
      if (typeof window.showToast === 'function') window.showToast(errMsg, 'error');
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  // ==================== 2. レシピ新規登録モーダルの写真ハンドラ ====================

  function setRegImage(url) {
    const input = document.getElementById('reg-image-url');
    const emptyBox = document.getElementById('reg-image-empty-box');
    const previewBox = document.getElementById('reg-image-preview-box');
    const previewImg = document.getElementById('reg-image-preview-img');
    const badge = document.getElementById('reg-image-status-badge');

    const clean = (url && String(url).trim()) || '';
    if (clean) {
      if (input) input.value = clean;
      if (previewImg) previewImg.src = clean;
      if (emptyBox) emptyBox.classList.add('hidden');
      if (previewBox) previewBox.classList.remove('hidden');
      if (badge) {
        badge.textContent = '設定済';
        badge.className = 'text-[10px] font-bold text-emerald-600';
      }
    } else {
      if (input) input.value = '';
      if (previewImg) previewImg.src = '';
      if (emptyBox) emptyBox.classList.remove('hidden');
      if (previewBox) previewBox.classList.add('hidden');
      if (badge) {
        badge.textContent = '未設定';
        badge.className = 'text-[10px] font-bold text-slate-400';
      }
    }
  }

  function clearRegImage() {
    setRegImage('');
    const urlInput = document.getElementById('reg-image-url-input');
    if (urlInput) urlInput.value = '';
    const urlWrap = document.getElementById('reg-image-url-wrap');
    if (urlWrap) urlWrap.classList.add('hidden');
  }

  function toggleRegUrlInput() {
    const wrap = document.getElementById('reg-image-url-wrap');
    if (wrap) wrap.classList.toggle('hidden');
  }

  function applyRegImageUrlInput() {
    const input = document.getElementById('reg-image-url-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    setRegImage(val);
    if (typeof window.showToast === 'function') window.showToast('写真URLを設定しました');
  }

  // ==================== 3. レシピ編集 (commit-modal) の写真ハンドラ ====================

  function setEditImage(url) {
    const input = document.getElementById('edit-image-url');
    const emptyBox = document.getElementById('edit-image-empty-box');
    const previewBox = document.getElementById('edit-image-preview-box');
    const previewImg = document.getElementById('edit-image-preview-img');
    const badge = document.getElementById('edit-image-status-badge');

    const clean = (url && String(url).trim()) || '';
    if (clean) {
      if (input) input.value = clean;
      if (previewImg) previewImg.src = clean;
      if (emptyBox) emptyBox.classList.add('hidden');
      if (previewBox) previewBox.classList.remove('hidden');
      if (badge) {
        badge.textContent = '設定済';
        badge.className = 'text-[10px] font-bold text-emerald-600';
      }
    } else {
      if (input) input.value = '';
      if (previewImg) previewImg.src = '';
      if (emptyBox) emptyBox.classList.remove('hidden');
      if (previewBox) previewBox.classList.add('hidden');
      if (badge) {
        badge.textContent = '未設定';
        badge.className = 'text-[10px] font-bold text-slate-400';
      }
    }
  }

  function clearEditImage() {
    setEditImage('');
    const urlInput = document.getElementById('edit-image-url-input');
    if (urlInput) urlInput.value = '';
    const urlWrap = document.getElementById('edit-image-url-wrap');
    if (urlWrap) urlWrap.classList.add('hidden');
  }

  function toggleEditUrlInput() {
    const wrap = document.getElementById('edit-image-url-wrap');
    if (wrap) wrap.classList.toggle('hidden');
  }

  function applyEditImageUrlInput() {
    const input = document.getElementById('edit-image-url-input');
    if (!input) return;
    const val = input.value.trim();
    if (!val) return;
    setEditImage(val);
    if (typeof window.showToast === 'function') window.showToast('写真URLを設定しました');
  }

  // ==================== 4. ファイル・カメラ入力バインド ====================

  function bindFileInput(elementId, onDataUrlReady) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.addEventListener('change', async function () {
      if (!this.files || !this.files[0]) return;
      const file = this.files[0];
      try {
        const utils = ImageUtils();
        if (utils && typeof utils.processImageFile === 'function') {
          const dataUrl = await utils.processImageFile(file);
          onDataUrlReady(dataUrl);
        } else {
          const reader = new FileReader();
          reader.onload = (e) => onDataUrlReady(e.target.result);
          reader.readAsDataURL(file);
        }
      } catch (err) {
        console.error('Image processing failed:', err);
        if (typeof window.showToast === 'function') window.showToast('画像の読み込みに失敗しました', 'error');
      }
      this.value = '';
    });
  }

  function initRecipeImagePickers() {
    // 1. Recipe Detail Modal
    bindFileInput('recipe-image-camera-input', (dataUrl) => setRecipeImageModalPreview(dataUrl));
    bindFileInput('recipe-image-file-input', (dataUrl) => setRecipeImageModalPreview(dataUrl));

    // 2. Register Form Modal
    bindFileInput('reg-image-camera-input', (dataUrl) => setRegImage(dataUrl));
    bindFileInput('reg-image-file-input', (dataUrl) => setRegImage(dataUrl));

    // 3. Edit Form Modal
    bindFileInput('edit-image-camera-input', (dataUrl) => setEditImage(dataUrl));
    bindFileInput('edit-image-file-input', (dataUrl) => setEditImage(dataUrl));
  }

  // ==================== 5. AI料理画像自動生成機能 ====================

  async function generateAiRecipeImage(recipeName, ingredients, onImageReady) {
    if (!recipeName || !String(recipeName).trim()) {
      if (typeof window.showToast === 'function') window.showToast('料理名を入力してください', 'error');
      return;
    }

    if (typeof window.showToast === 'function') window.showToast('AIが料理画像を生成中... (約10〜20秒)');

    try {
      const res = await fetch('/api/gemini/generate-recipe-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipeName, ingredients })
      });
      const data = await res.json();
      if (!data.ok || !data.imageUrl) {
        throw new Error(data.error || '画像生成に失敗しました');
      }

      let finalImageUrl = data.imageUrl;
      const utils = ImageUtils();
      if (utils && typeof utils.optimizeDataUrl === 'function') {
        try {
          finalImageUrl = await utils.optimizeDataUrl(data.imageUrl);
        } catch (optErr) {
          console.warn('Image optimization warning:', optErr);
        }
      }

      onImageReady(finalImageUrl);
      if (typeof window.showToast === 'function') window.showToast('AI料理画像を生成しました！');
    } catch (err) {
      console.error('AI image generation failed:', err);
      if (typeof window.showToast === 'function') window.showToast(err.message || 'AI画像生成に失敗しました', 'error');
    }
  }

  function generateAiRecipeImageForDetail() {
    const recipe = typeof window.selectedRecipe === 'function' ? window.selectedRecipe() : null;
    if (!recipe) {
      if (typeof window.showToast === 'function') window.showToast('レシピが選択されていません', 'error');
      return;
    }
    const activeVersion = window.appState ? window.appState.activeVersion : 'v1.0';
    const versionObj = (recipe.versions && recipe.versions[activeVersion]) || {};
    const ingredients = versionObj.ingredients || [];
    generateAiRecipeImage(recipe.name, ingredients, (dataUrl) => {
      setRecipeImageModalPreview(dataUrl);
    });
  }

  function generateAiRecipeImageForRegister() {
    const nameEl = document.getElementById('reg-name');
    const recipeName = nameEl ? nameEl.value.trim() : '';
    if (!recipeName) {
      if (typeof window.showToast === 'function') window.showToast('先に料理名を入力してください', 'error');
      if (nameEl) nameEl.focus();
      return;
    }
    let ingredients = [];
    if (typeof window.collectIngredientRows === 'function') {
      ingredients = window.collectIngredientRows('reg-ingredients');
    }
    generateAiRecipeImage(recipeName, ingredients, (dataUrl) => {
      setRegImage(dataUrl);
    });
  }

  function generateAiRecipeImageForEdit() {
    const nameEl = document.getElementById('edit-name');
    const recipeName = nameEl ? nameEl.value.trim() : '';
    if (!recipeName) {
      if (typeof window.showToast === 'function') window.showToast('先に料理名を入力してください', 'error');
      if (nameEl) nameEl.focus();
      return;
    }
    let ingredients = [];
    if (typeof window.collectIngredientRows === 'function') {
      ingredients = window.collectIngredientRows('edit-ingredients');
    }
    generateAiRecipeImage(recipeName, ingredients, (dataUrl) => {
      setEditImage(dataUrl);
    });
  }

  function escapeAttr(str) {
    if (!str) return '';
    return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // Auto initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initRecipeImagePickers);
  } else {
    initRecipeImagePickers();
  }

  // Expose to window & KitchenGit
  window.openRecipeImageModal = openRecipeImageModal;
  window.closeRecipeImageModal = closeRecipeImageModal;
  window.setRecipeImageModalPreview = setRecipeImageModalPreview;
  window.clearRecipeImageModalSelection = clearRecipeImageModalSelection;
  window.applyRecipeImageUrlInput = applyRecipeImageUrlInput;
  window.saveRecipeImageModal = saveRecipeImageModal;
  window.generateAiRecipeImageForDetail = generateAiRecipeImageForDetail;

  window.setRegImage = setRegImage;
  window.clearRegImage = clearRegImage;
  window.toggleRegUrlInput = toggleRegUrlInput;
  window.applyRegImageUrlInput = applyRegImageUrlInput;
  window.generateAiRecipeImageForRegister = generateAiRecipeImageForRegister;

  window.setEditImage = setEditImage;
  window.clearEditImage = clearEditImage;
  window.toggleEditUrlInput = toggleEditUrlInput;
  window.applyEditImageUrlInput = applyEditImageUrlInput;
  window.generateAiRecipeImageForEdit = generateAiRecipeImageForEdit;

  window.initRecipeImagePickers = initRecipeImagePickers;

  window.KitchenGit.RecipeImages = {
    openRecipeImageModal,
    closeRecipeImageModal,
    setRecipeImageModalPreview,
    clearRecipeImageModalSelection,
    applyRecipeImageUrlInput,
    saveRecipeImageModal,
    generateAiRecipeImageForDetail,
    setRegImage,
    clearRegImage,
    generateAiRecipeImageForRegister,
    setEditImage,
    clearEditImage,
    generateAiRecipeImageForEdit,
    initRecipeImagePickers
  };
})();
