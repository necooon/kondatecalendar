window.KitchenGit = window.KitchenGit || {};

KitchenGit.ImageScanner = (function () {
  let appState = null;
  let hooks = {};
  let currentScannedRecipe = null;
  let currentImageDataUrl = null;
  let isScanning = false;
  let abortController = null;

  // Pre-configured structured data for sample recipe OCR demo
  const SAMPLE_RECIPE_DATA = {
    name: '豚バラとキャベツの甘辛味噌炒め',
    servingsBase: 2,
    tag: 'おすすめ定番 #主菜',
    note: 'キャベツは強火で手早く炒めると水分が出ずシャキッと仕上がります。お好みで一味唐辛子を振っても美味しく召し上がれます。',
    ingredients: [
      { name: '豚バラ薄切り肉', baseAmount: 200, unit: 'g', note: '4cm幅にカット' },
      { name: 'キャベツ', baseAmount: 0.25, unit: '個', note: 'ざく切り (約200g)' },
      { name: '長ねぎ', baseAmount: 0.5, unit: '本', note: '斜め薄切り' },
      { name: 'ごま油', baseAmount: 1, unit: '大さじ', note: '炒め用' },
      { name: 'みそ', baseAmount: 2, unit: '大さじ', note: '合わせ調味料' },
      { name: 'みりん', baseAmount: 1, unit: '大さじ', note: '合わせ調味料' },
      { name: 'しょうゆ', baseAmount: 1, unit: '小さじ', note: '合わせ調味料' },
      { name: 'おろしにんにく', baseAmount: 0.5, unit: '小さじ', note: '合わせ調味料' }
    ],
    steps: [
      { title: '下準備', instruction: '豚肉は4cm幅に切り、キャベツはざく切り、長ねぎは斜め薄切りにする。', timerSeconds: 0 },
      { title: '炒める', instruction: 'フライパンにごま油を中火で熱し、豚肉を色が変わるまで約2分炒める。', timerSeconds: 120 },
      { title: '野菜を加える', instruction: 'キャベツと長ねぎを加え、強火で全体がしんなりするまで約3分炒め合わせる。', timerSeconds: 180 },
      { title: '仕上げ', instruction: 'みそ、みりん、しょうゆ、にんにくを合わせた調味料を回し入れ、強火で一気に炒め絡める。', timerSeconds: 0 }
    ]
  };

  function init(state, options = {}) {
    appState = state;
    hooks = options;
    bindEvents();
  }

  let lastProcessedFile = null;

  // Client-side image resize & natural compression for optimal transmission
  async function resizeImage(fileOrBlob, maxDimension = 1100, quality = 0.85) {
    // Check if the input is HEIC/HEIF
    const isHeic = (fileOrBlob.type && (fileOrBlob.type.toLowerCase().includes('heic') || fileOrBlob.type.toLowerCase().includes('heif'))) ||
      /\.(heic|heif)$/i.test(fileOrBlob.name || '');

    // If HEIC, try client-side conversion via heic2any first
    let processedBlob = fileOrBlob;
    if (isHeic && typeof window.heic2any === 'function') {
      try {
        updateProgressStatus('iPhone写真 (HEIC) を標準画像に変換中...', 20);
        const conv = await window.heic2any({
          blob: fileOrBlob,
          toType: 'image/jpeg',
          quality: 0.85
        });
        processedBlob = Array.isArray(conv) ? conv[0] : conv;
      } catch (convErr) {
        console.warn('heic2any conversion on client warning:', convErr);
      }
    }

    return new Promise((resolve, reject) => {
      // 1. Try createImageBitmap with imageOrientation: 'from-image' (crucial for mobile cameras / EXIF rotation)
      if (typeof window.createImageBitmap === 'function') {
        const options = { imageOrientation: 'from-image' };
        createImageBitmap(processedBlob, options)
          .catch(() => createImageBitmap(processedBlob)) // Fallback if imageOrientation option is unsupported
          .then((bitmap) => {
            if (!bitmap || !bitmap.width || !bitmap.height) {
              fallbackResize(processedBlob, maxDimension, quality, resolve, reject);
              return;
            }
            let width = bitmap.width;
            let height = bitmap.height;
            if (width > maxDimension || height > maxDimension) {
              if (width > height) {
                height = Math.round((height * maxDimension) / width);
                width = maxDimension;
              } else {
                width = Math.round((width * maxDimension) / height);
                height = maxDimension;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, width);
            canvas.height = Math.max(1, height);
            const ctx = canvas.getContext('2d');
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            if (typeof bitmap.close === 'function') bitmap.close();

            const dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve({
              dataUrl,
              width: canvas.width,
              height: canvas.height,
              mimeType: 'image/jpeg'
            });
          })
          .catch(() => {
            fallbackResize(processedBlob, maxDimension, quality, resolve, reject);
          });
        return;
      }

      fallbackResize(processedBlob, maxDimension, quality, resolve, reject);
    });
  }

  function fallbackResize(fileOrBlob, maxDimension, quality, resolve, reject) {
    let objectUrl = null;
    try {
      objectUrl = URL.createObjectURL(fileOrBlob);
    } catch (_) {}

    const img = new Image();
    img.onload = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, width);
      canvas.height = Math.max(1, height);
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      resolve({
        dataUrl,
        width: canvas.width,
        height: canvas.height,
        mimeType: 'image/jpeg'
      });
    };
    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = (re) => {
        resolve({
          dataUrl: re.target.result,
          width: 0,
          height: 0,
          mimeType: fileOrBlob.type || 'image/jpeg'
        });
      };
      reader.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
      reader.readAsDataURL(fileOrBlob);
    };

    if (objectUrl) {
      img.src = objectUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = () => reject(new Error('画像の読み取りに失敗しました。'));
      reader.readAsDataURL(fileOrBlob);
    }
  }

  function openModal(options = {}) {
    resetScannerUI();
    const backdrop = document.getElementById('image-scanner-backdrop');
    const modal = document.getElementById('image-scanner-modal');
    if (backdrop) backdrop.classList.remove('hidden');
    if (modal) modal.classList.remove('hidden');
  }

  function closeModal() {
    if (isScanning && abortController) {
      abortController.abort();
    }
    isScanning = false;
    const backdrop = document.getElementById('image-scanner-backdrop');
    const modal = document.getElementById('image-scanner-modal');
    if (backdrop) backdrop.classList.add('hidden');
    if (modal) modal.classList.add('hidden');
  }

  function resetScannerUI() {
    isScanning = false;
    currentScannedRecipe = null;
    currentImageDataUrl = null;

    const uploadArea = document.getElementById('scanner-upload-area');
    const progressArea = document.getElementById('scanner-progress-area');
    const resultArea = document.getElementById('scanner-result-area');
    const errorArea = document.getElementById('scanner-error-area');

    if (uploadArea) uploadArea.classList.remove('hidden');
    if (progressArea) progressArea.classList.add('hidden');
    if (resultArea) resultArea.classList.add('hidden');
    if (errorArea) errorArea.classList.add('hidden');

    const fileInput = document.getElementById('scanner-file-input');
    const cameraInput = document.getElementById('scanner-camera-input');
    if (fileInput) fileInput.value = '';
    if (cameraInput) cameraInput.value = '';
  }

  function setScanningState(dataUrl) {
    isScanning = true;
    currentImageDataUrl = dataUrl;

    const uploadArea = document.getElementById('scanner-upload-area');
    const progressArea = document.getElementById('scanner-progress-area');
    const resultArea = document.getElementById('scanner-result-area');
    const errorArea = document.getElementById('scanner-error-area');

    if (uploadArea) uploadArea.classList.add('hidden');
    if (progressArea) progressArea.classList.remove('hidden');
    if (resultArea) resultArea.classList.add('hidden');
    if (errorArea) errorArea.classList.add('hidden');

    const thumb = document.getElementById('scanner-preview-thumb');
    if (thumb) thumb.src = dataUrl;

    updateProgressStatus('画像を最適化してGemini AIに送信中...', 30);
  }

  function updateProgressStatus(text, percent) {
    const statusText = document.getElementById('scanner-progress-text');
    const progressBar = document.getElementById('scanner-progress-bar');
    if (statusText) statusText.textContent = text;
    if (progressBar) progressBar.style.width = `${percent}%`;
  }

  function setErrorState(message) {
    isScanning = false;
    const uploadArea = document.getElementById('scanner-upload-area');
    const progressArea = document.getElementById('scanner-progress-area');
    const resultArea = document.getElementById('scanner-result-area');
    const errorArea = document.getElementById('scanner-error-area');

    if (uploadArea) uploadArea.classList.add('hidden');
    if (progressArea) progressArea.classList.add('hidden');
    if (resultArea) resultArea.classList.add('hidden');
    if (errorArea) {
      errorArea.classList.remove('hidden');
      const errEl = document.getElementById('scanner-error-message');
      if (errEl) errEl.textContent = message;
    }
  }

  function setResultState(recipe) {
    isScanning = false;
    currentScannedRecipe = recipe;

    const uploadArea = document.getElementById('scanner-upload-area');
    const progressArea = document.getElementById('scanner-progress-area');
    const resultArea = document.getElementById('scanner-result-area');
    const errorArea = document.getElementById('scanner-error-area');

    if (uploadArea) uploadArea.classList.add('hidden');
    if (progressArea) progressArea.classList.add('hidden');
    if (resultArea) resultArea.classList.remove('hidden');
    if (errorArea) errorArea.classList.add('hidden');

    // Populate result preview
    const titleInput = document.getElementById('scanner-result-title');
    if (titleInput) titleInput.value = recipe.name || '';

    const tagBadge = document.getElementById('scanner-result-tag');
    if (tagBadge) {
      tagBadge.textContent = recipe.tag || '画像から登録';
    }

    const servingsEl = document.getElementById('scanner-result-servings');
    if (servingsEl) {
      servingsEl.textContent = `${recipe.servingsBase || 2}人分`;
    }

    const ingCount = (recipe.ingredients || []).length;
    const stepCount = (recipe.steps || []).length;
    const summaryBadge = document.getElementById('scanner-result-summary');
    if (summaryBadge) {
      summaryBadge.textContent = `材料 ${ingCount}品 • 手順 ${stepCount}工程`;
    }

    // Render list of ingredients
    const ingList = document.getElementById('scanner-result-ingredients');
    if (ingList) {
      ingList.innerHTML = (recipe.ingredients || []).map((ing) => {
        const qty = ing.baseAmount > 0 ? `${ing.baseAmount}${ing.unit || ''}` : (ing.unit || '適量');
        const note = ing.note ? `<span class="text-[10px] text-slate-400 ml-1">(${ing.note})</span>` : '';
        return `
          <div class="flex items-center justify-between text-xs py-1 border-b border-slate-100 last:border-0">
            <span class="font-medium text-slate-800">${ing.name}${note}</span>
            <span class="font-mono font-bold text-emerald-700">${qty}</span>
          </div>
        `;
      }).join('');
    }

    // Render list of steps
    const stepList = document.getElementById('scanner-result-steps');
    if (stepList) {
      stepList.innerHTML = (recipe.steps || []).map((st, idx) => {
        const timerMinutes = st.timerSeconds ? Math.round(st.timerSeconds / 60) : (st.timer ? Math.round(st.timer / 60) : 0);
        const timerBadge = timerMinutes > 0
          ? `<span class="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 font-bold px-1.5 py-0.5 rounded-md border border-amber-200 shrink-0"><i class="fa-regular fa-clock"></i>${timerMinutes}分</span>`
          : '';
        return `
          <div class="space-y-0.5 py-1.5 border-b border-slate-100 last:border-0">
            <div class="flex items-center justify-between gap-1">
              <span class="text-[11px] font-bold text-emerald-700 font-mono">Step ${idx + 1}${st.title ? ` : ${st.title}` : ''}</span>
              ${timerBadge}
            </div>
            <p class="text-xs text-slate-700 leading-relaxed">${st.instruction}</p>
          </div>
        `;
      }).join('');
    }

    // Memo / note
    const noteCard = document.getElementById('scanner-result-note-wrap');
    const noteText = document.getElementById('scanner-result-note');
    if (noteCard && noteText) {
      if (recipe.note) {
        noteText.textContent = recipe.note;
        noteCard.classList.remove('hidden');
      } else {
        noteCard.classList.add('hidden');
      }
    }
  }

  async function processFile(file) {
    if (!file) return;
    lastProcessedFile = file;

    // Allow any image type or files with common image extensions even if MIME is generic (e.g. on mobile / HEIC)
    const isImage = (file.type && file.type.startsWith('image/')) ||
      /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(file.name || '');
    if (!isImage) {
      setErrorState('画像ファイル（JPEG, PNG, WebPなど）を選択してください。');
      return;
    }

    let timedOut = false;
    let timeoutId = null;
    let elapsedInterval = null;

    try {
      updateProgressStatus('画像を最適化中...', 25);
      const resized = await resizeImage(file, 1100, 0.85);
      setScanningState(resized.dataUrl);

      abortController = new AbortController();
      const signal = abortController.signal;

      let elapsed = 0;
      updateProgressStatus('Gemini AIが文字・材料・分量を読み取り中...', 40);

      elapsedInterval = setInterval(() => {
        if (!isScanning) return;
        elapsed += 1;
        if (elapsed <= 3) {
          updateProgressStatus(`Gemini AIが文字・材料・分量を解析中... (${elapsed}秒)`, 40 + elapsed * 10);
        } else if (elapsed <= 7) {
          updateProgressStatus(`調理手順とタイマー時間を抽出中... (${elapsed}秒)`, 70 + (elapsed - 3) * 5);
        } else {
          updateProgressStatus(`AIがレシピ情報を整理中... (${elapsed}秒)`, 90);
        }
      }, 1000);

      // Client-side 50s timeout
      timeoutId = setTimeout(() => {
        timedOut = true;
        if (abortController) {
          abortController.abort();
        }
        setErrorState('AI解析がタイムアウトしました。通信環境の良い場所でもう一度お試しください。');
      }, 50000);

      let response;
      try {
        response = await fetch('/api/gemini/extract-recipe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            image: resized.dataUrl,
            mimeType: resized.mimeType
          }),
          signal
        });
      } catch (fetchErr) {
        if (timedOut) return;
        if (fetchErr.name === 'AbortError' || signal.aborted) return;
        throw new Error('サーバーに接続できませんでした。通信環境をご確認の上、もう一度お試しください。');
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        if (elapsedInterval) clearInterval(elapsedInterval);
      }

      let rawText = '';
      try {
        rawText = await response.text();
      } catch (readErr) {
        if (timedOut) return;
        if (readErr.name === 'AbortError' || signal.aborted) return;
        console.warn('Response text read failed:', readErr);
        if (response && response.status === 504) {
          throw new Error('サーバー通信がタイムアウトしました。もう一度お試しください。');
        } else if (response && response.status === 503) {
          throw new Error('AIサービスが混雑しています。数秒待ってから再度お試しください。');
        } else if (response && response.status === 413) {
          throw new Error('画像の容量が大きすぎます。別の画像を選択するか、小さめの解像度でお試しください。');
        }
        throw new Error('サーバーからの応答の読み込みに失敗しました。電波状況をご確認の上、もう一度お試しください。');
      }

      let result = null;
      if (rawText) {
        try {
          result = JSON.parse(rawText);
        } catch (jsonErr) {
          // If response is HTML or text error
          if (response.status === 504 || rawText.includes('504') || /gateway\s*time-?out/i.test(rawText)) {
            throw new Error('サーバー通信がタイムアウトしました。もう一度お試しください。');
          } else if (response.status === 503 || rawText.includes('503') || /service\s*unavailable/i.test(rawText) || /high\s*demand/i.test(rawText)) {
            throw new Error('AIサービスが一時的に混雑しています。数秒待ってから再度お試しください。');
          } else if (response.status === 502 || rawText.includes('502') || /bad\s*gateway/i.test(rawText)) {
            throw new Error('サーバー接続が一時的に切断されました。もう一度お試しください。');
          } else if (response.status === 413 || rawText.includes('413') || /too\s*large/i.test(rawText)) {
            throw new Error('画像の容量が大きすぎます。別の画像を選択するか、小さめの解像度でお試しください。');
          }
          throw new Error('サーバーからの応答の解析に失敗しました。もう一度お試しください。');
        }
      }

      if (!response.ok || !result || !result.ok) {
        let errorMsg = (result && result.error) ? result.error : `サーバーエラー (${response.status})`;
        try {
          const parsed = JSON.parse(errorMsg);
          if (parsed && parsed.error && parsed.error.message) {
            errorMsg = parsed.error.message;
          }
        } catch (_) {}
        if (errorMsg.includes('503') || errorMsg.includes('high demand') || errorMsg.includes('UNAVAILABLE')) {
          errorMsg = 'AIサービスが混雑しています。少し待ってから再度お試しください。';
        } else if (errorMsg.includes('INVALID_ARGUMENT') || errorMsg.includes('Unable to process input image')) {
          errorMsg = '画像の形式またはサイズに対応できませんでした。別の画像でお試しください。';
        }
        throw new Error(errorMsg);
      }

      updateProgressStatus('解析完了！データを反映しています...', 100);

      // Format ingredients and steps into RecipeOps structure
      const parsedRecipe = normalizeRecipeData(result.recipe);
      setResultState(parsedRecipe);
    } catch (err) {
      if (timedOut) return;
      if (err.name === 'AbortError' || abortController?.signal?.aborted) return;
      console.error('Image scanning failed:', err);
      const friendlyMessage = err.message || '画像の解析に失敗しました。もう一度試すか、手動で入力してください。';
      setErrorState(friendlyMessage);
    }
  }

  function retryLast() {
    if (lastProcessedFile) {
      processFile(lastProcessedFile);
    } else {
      resetScannerUI();
    }
  }

  function normalizeRecipeData(raw) {
    const name = (raw.name || '新しいレシピ').trim();
    const servingsBase = Math.max(1, Number(raw.servingsBase) || 2);
    const tag = (raw.tag || '画像読取').trim();
    const note = (raw.note || '').trim();

    const ingredients = (raw.ingredients || []).map((ing) => {
      return {
        name: (ing.name || '').trim(),
        baseAmount: Number(ing.baseAmount) || 0,
        unit: (ing.unit || 'g').trim(),
        note: (ing.note || '').trim()
      };
    }).filter((ing) => ing.name);

    const steps = (raw.steps || []).map((step, idx) => {
      const timerSec = step.timerSeconds != null ? Number(step.timerSeconds) : null;
      return {
        title: (step.title || `手順 ${idx + 1}`).trim(),
        instruction: (step.instruction || '').trim(),
        timer: timerSec && timerSec > 0 ? timerSec : null,
        uses: (window.KitchenGit && KitchenGit.RecipeModel && KitchenGit.RecipeModel.inferUses)
          ? KitchenGit.RecipeModel.inferUses(step.instruction || '', ingredients)
          : []
      };
    }).filter((step) => step.instruction);

    return {
      name,
      servingsBase,
      tag,
      note,
      ingredients: ingredients.length ? ingredients : [{ name: '', baseAmount: 0, unit: 'g' }],
      steps: steps.length ? steps : [{ title: '手順 1', instruction: '', timer: null }]
    };
  }

  function applyToRegisterForm() {
    if (!currentScannedRecipe) return;

    // Use current edited title if user touched it in result preview
    const titleInput = document.getElementById('scanner-result-title');
    if (titleInput && titleInput.value.trim()) {
      currentScannedRecipe.name = titleInput.value.trim();
    }

    const regName = document.getElementById('reg-name');
    const regTag = document.getElementById('reg-tag');
    const regServings = document.getElementById('reg-servings');

    if (regName) regName.value = currentScannedRecipe.name;
    if (regTag) regTag.value = currentScannedRecipe.tag || '';
    if (regServings) regServings.value = String(currentScannedRecipe.servingsBase || 2);

    if (typeof window.fillIngredientRows === 'function') {
      window.fillIngredientRows('reg-ingredients', currentScannedRecipe.ingredients);
    }
    if (typeof window.fillStepRows === 'function') {
      window.fillStepRows('reg-steps', currentScannedRecipe.steps);
    }

    closeModal();
    if (typeof window.openRegisterModal === 'function') {
      // Open register modal with values intact
      document.getElementById('register-error').classList.add('hidden');
      document.getElementById('register-modal-backdrop').classList.remove('hidden');
      document.getElementById('register-modal').classList.remove('hidden');
    }

    if (hooks.showToast) {
      hooks.showToast(`「${currentScannedRecipe.name}」をフォームに展開しました`);
    }
  }

  async function directSaveRecipe() {
    if (!currentScannedRecipe) return;

    const titleInput = document.getElementById('scanner-result-title');
    if (titleInput && titleInput.value.trim()) {
      currentScannedRecipe.name = titleInput.value.trim();
    }

    const name = currentScannedRecipe.name;
    const tag = currentScannedRecipe.tag;
    const tags = tag ? tag.split(/[#＃,\s]+/).map((t) => t.trim()).filter(Boolean) : [];
    const servingsBase = currentScannedRecipe.servingsBase || 2;
    const ingredients = currentScannedRecipe.ingredients;
    const steps = currentScannedRecipe.steps;
    const note = currentScannedRecipe.note || '';

    const n = window.KitchenGit && KitchenGit.Nutrition;
    const computed = n ? n.computePerServing(ingredients, servingsBase) : { p: 0, f: 0, c: 0, kcal: 0 };
    const pfc = { p: computed.p, f: computed.f, c: computed.c, kcal: computed.kcal };
    const now = new Date().toISOString();

    const payload = {
      name,
      tag,
      tags,
      branch: 'main',
      servingsBase,
      pfc,
      versions: {
        'v1.0': {
          title: 'v1.0',
          note,
          sortOrder: 0,
          branch: 'main',
          hash: (window.KitchenGit && KitchenGit.RecipeModel) ? KitchenGit.RecipeModel.shortHash(name + now) : 'init',
          author: 'You (画像読取)',
          committedAt: now,
          ingredients,
          steps
        }
      }
    };

    const saveBtn = document.getElementById('scanner-direct-save-btn');
    if (saveBtn) saveBtn.disabled = true;

    try {
      let saved = null;
      if (window.KitchenGit && KitchenGit.RecipesDB && KitchenGit.RecipesDB.isReady()) {
        saved = await KitchenGit.RecipesDB.insertRecipe(payload);
        const all = await KitchenGit.RecipesDB.fetchAll();
        if (appState) appState.recipes = all;
        if (typeof window.setCloudStatus === 'function') window.setCloudStatus('クラウド同期', true);
      } else {
        saved = { ...payload, id: 'local-' + Date.now() };
        if (appState) appState.recipes = [saved, ...(appState.recipes || [])];
        if (typeof window.setCloudStatus === 'function') window.setCloudStatus('オフライン', false);
      }

      closeModal();
      if (typeof window.showRecipeDetail === 'function') {
        window.showRecipeDetail(saved.id);
      }
      if (typeof window.switchTab === 'function') {
        window.switchTab('recipe');
      }
      if (typeof window.renderRecipeList === 'function') {
        window.renderRecipeList();
      }
      if (hooks.onRecipeAdded) {
        try { hooks.onRecipeAdded(saved); } catch (e) { console.error(e); }
      }
      if (hooks.showToast) {
        hooks.showToast(`「${name}」をレシピに追加しました！`);
      }
    } catch (err) {
      console.error('Save failed:', err);
      // Fallback to local save
      const saved = { ...payload, id: 'local-' + Date.now() };
      if (appState) appState.recipes = [saved, ...(appState.recipes || [])];
      closeModal();
      if (typeof window.showRecipeDetail === 'function') {
        window.showRecipeDetail(saved.id);
      }
      if (typeof window.switchTab === 'function') {
        window.switchTab('recipe');
      }
      if (typeof window.renderRecipeList === 'function') {
        window.renderRecipeList();
      }
      if (hooks.onRecipeAdded) {
        try { hooks.onRecipeAdded(saved); } catch (e) { console.error(e); }
      }
      if (hooks.showToast) {
        hooks.showToast(`「${name}」を追加しました`);
      }
    } finally {
      if (saveBtn) saveBtn.disabled = false;
    }
  }

  // Generate a sample recipe card on a canvas to test OCR without requiring immediate camera upload
  function loadSampleRecipeImage() {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1100;
    const ctx = canvas.getContext('2d');

    // Background - warm cookbook style
    ctx.fillStyle = '#FFFDF9';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Border line
    ctx.strokeStyle = '#E2DDD3';
    ctx.lineWidth = 4;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Badge
    ctx.fillStyle = '#10B981';
    ctx.fillRect(50, 50, 140, 36);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('おすすめ定番', 65, 76);

    // Title
    ctx.fillStyle = '#1E293B';
    ctx.font = 'bold 42px sans-serif';
    ctx.fillText('豚バラとキャベツの甘辛味噌炒め', 50, 145);

    // Servings
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('【材料】（2人分）', 50, 210);

    // Ingredients list
    const sampleIngs = [
      ['豚バラ薄切り肉', '200g'],
      ['キャベツ', '1/4個 (約200g)'],
      ['長ねぎ', '1/2本'],
      ['ごま油', '大さじ1'],
      ['みそ', '大さじ2'],
      ['みりん', '大さじ1'],
      ['しょうゆ', '小さじ1'],
      ['おろしにんにく', '小さじ1/2']
    ];

    ctx.fillStyle = '#334155';
    ctx.font = '22px sans-serif';
    let y = 260;
    sampleIngs.forEach(([name, qty]) => {
      ctx.fillText(`・${name}`, 70, y);
      ctx.fillText(qty, 420, y);
      y += 38;
    });

    // Steps
    y += 20;
    ctx.fillStyle = '#64748B';
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText('【作り方】', 50, y);
    y += 45;

    const sampleSteps = [
      '1. 下準備：豚肉は4cm幅に切り、キャベツはざく切り、長ねぎは斜め薄切りにする。',
      '2. 炒める：フライパンにごま油を中火で熱し、豚肉を色が変わるまで約2分炒める。',
      '3. 野菜を加える：キャベツと長ねぎを加え、強火で全体がしんなりするまで約3分炒め合わせる。',
      '4. 仕上げ：みそ、みりん、しょうゆ、にんにくを合わせた調味料を回し入れ、強火で一気に炒め絡める。'
    ];

    ctx.fillStyle = '#1E293B';
    ctx.font = '21px sans-serif';
    sampleSteps.forEach((st) => {
      // simple word wrap for canvas
      if (st.length > 32) {
        ctx.fillText(st.slice(0, 32), 60, y);
        y += 30;
        ctx.fillText('   ' + st.slice(32), 60, y);
      } else {
        ctx.fillText(st, 60, y);
      }
      y += 45;
    });

    // Note / Point
    y += 10;
    ctx.fillStyle = '#F59E0B';
    ctx.fillRect(50, y, canvas.width - 100, 75);
    ctx.fillStyle = '#78350F';
    ctx.font = 'bold 20px sans-serif';
    ctx.fillText('★ 美味しさのコツ：', 70, y + 32);
    ctx.font = '19px sans-serif';
    ctx.fillText('キャベツは強火で手早く炒めると水分が出ずシャキッと仕上がります。', 70, y + 60);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

    // Run the generated sample recipe image through the exact same processing pipeline as camera photos
    if (typeof canvas.toBlob === 'function') {
      canvas.toBlob((blob) => {
        if (blob) {
          processFile(blob);
        } else {
          setScanningState(dataUrl);
          setTimeout(() => setResultState(normalizeRecipeData(SAMPLE_RECIPE_DATA)), 600);
        }
      }, 'image/jpeg', 0.85);
    } else {
      setScanningState(dataUrl);
      setTimeout(() => setResultState(normalizeRecipeData(SAMPLE_RECIPE_DATA)), 600);
    }
  }

  function bindEvents() {
    // Hidden inputs
    const fileInput = document.getElementById('scanner-file-input');
    const cameraInput = document.getElementById('scanner-camera-input');

    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        if (this.files && this.files[0]) {
          const file = this.files[0];
          this.value = ''; // Reset input to allow selecting same file again if desired
          processFile(file);
        }
      });
    }

    if (cameraInput) {
      cameraInput.addEventListener('change', function (e) {
        if (this.files && this.files[0]) {
          const file = this.files[0];
          this.value = ''; // Reset input to allow retaking photo without change event blocking
          processFile(file);
        }
      });
    }

    // Drag & Drop
    const dropzone = document.getElementById('scanner-dropzone');
    if (dropzone) {
      ['dragenter', 'dragover'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.add('border-emerald-500', 'bg-emerald-50/50');
        });
      });

      ['dragleave', 'drop'].forEach((eventName) => {
        dropzone.addEventListener(eventName, (e) => {
          e.preventDefault();
          e.stopPropagation();
          dropzone.classList.remove('border-emerald-500', 'bg-emerald-50/50');
        });
      });

      dropzone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        if (dt && dt.files && dt.files[0]) {
          processFile(dt.files[0]);
        }
      });
    }

    // Paste event support (e.g. copied screenshots)
    document.addEventListener('paste', (e) => {
      const modal = document.getElementById('image-scanner-modal');
      // Only trigger if scanner modal is open or register modal is open
      if (!modal || modal.classList.contains('hidden')) return;

      const items = (e.clipboardData || window.clipboardData).items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const blob = items[i].getAsFile();
          if (blob) {
            e.preventDefault();
            processFile(blob);
            break;
          }
        }
      }
    });
  }

  return {
    init,
    open: openModal,
    close: closeModal,
    reset: resetScannerUI,
    processFile,
    retryLast,
    applyToRegisterForm,
    directSaveRecipe,
    loadSampleRecipeImage
  };
})();
