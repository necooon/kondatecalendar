window.KitchenGit = window.KitchenGit || {};

/**
 * ImageUtils - 写真のクライアント側リサイズ・HEIC対応・プリセット料理画像提供ユーティリティ
 */
KitchenGit.ImageUtils = (function () {
  // 代表的な家庭料理のプリセット画像集（Unsplashの高解像度・フリー素材）
  const PRESET_RECIPE_IMAGES = [
    { id: 'pork-ginger', title: '生姜焼き・豚肉', url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1' },
    { id: 'chicken-stir', title: '鶏肉・炒め物', url: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c' },
    { id: 'mabo-tofu', title: '麻婆豆腐・中華', url: 'https://images.unsplash.com/photo-1543339308-43e59d6b73a6' },
    { id: 'grilled-salmon', title: '鮭・焼き魚', url: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2' },
    { id: 'egg-soup', title: '卵スープ・汁物', url: 'https://images.unsplash.com/photo-1547592166-23ac45744acd' },
    { id: 'tonjiru', title: '豚汁・煮込み', url: 'https://images.unsplash.com/photo-1541832676-9b763b0239ab' },
    { id: 'pasta', title: 'パスタ・麺類', url: 'https://images.unsplash.com/photo-1621996346565-e3d5d6281295' },
    { id: 'salad', title: 'サラダ・野菜', url: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd' },
    { id: 'curry', title: 'カレー・シチュー', url: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db' },
    { id: 'hamburg', title: 'ハンバーグ・肉料理', url: 'https://images.unsplash.com/photo-1529042410759-befb1204b468' }
  ];

  /**
   * クライアント側でファイルを最適化（最大幅1200px、JPEG 0.85圧縮、HEIC対応、EXIF回転考慮）
   * @param {File|Blob} fileOrBlob 
   * @param {number} maxDimension 
   * @param {number} quality 
   * @returns {Promise<string>} dataUrl (image/jpeg)
   */
  async function processImageFile(fileOrBlob, maxDimension = 1200, quality = 0.85) {
    if (!fileOrBlob) throw new Error('画像ファイルが指定されていません');

    // HEIC/HEIFチェック（iPhoneカメラ写真）
    const isHeic = (fileOrBlob.type && (fileOrBlob.type.toLowerCase().includes('heic') || fileOrBlob.type.toLowerCase().includes('heif'))) ||
      /\.(heic|heif)$/i.test(fileOrBlob.name || '');

    let processedBlob = fileOrBlob;
    if (isHeic && typeof window.heic2any === 'function') {
      try {
        const conv = await window.heic2any({
          blob: fileOrBlob,
          toType: 'image/jpeg',
          quality
        });
        processedBlob = Array.isArray(conv) ? conv[0] : conv;
      } catch (convErr) {
        console.warn('heic2any conversion on client warning:', convErr);
      }
    }

    return new Promise((resolve, reject) => {
      // 1. createImageBitmap による EXIF 回転補正付きデコード
      if (typeof window.createImageBitmap === 'function') {
        const options = { imageOrientation: 'from-image' };
        createImageBitmap(processedBlob, options)
          .catch(() => createImageBitmap(processedBlob))
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
            resolve(dataUrl);
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
      resolve(dataUrl);
    };

    img.onerror = () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      const reader = new FileReader();
      reader.onload = (re) => resolve(re.target.result);
      reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
      reader.readAsDataURL(fileOrBlob);
    };

    if (objectUrl) {
      img.src = objectUrl;
    } else {
      const reader = new FileReader();
      reader.onload = (e) => { img.src = e.target.result; };
      reader.onerror = () => reject(new Error('画像の読み取りに失敗しました'));
      reader.readAsDataURL(fileOrBlob);
    }
  }

  function isValidImageUrl(str) {
    if (!str || typeof str !== 'string') return false;
    const s = str.trim();
    return s.startsWith('http://') || s.startsWith('https://') || s.startsWith('data:image/');
  }

  async function optimizeDataUrl(dataUrl, maxDimension = 1000, quality = 0.8) {
    if (!dataUrl || !dataUrl.startsWith('data:image/')) return dataUrl;
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
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
        const optimized = canvas.toDataURL('image/jpeg', quality);
        resolve(optimized);
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  }

  return {
    PRESET_RECIPE_IMAGES,
    processImageFile,
    isValidImageUrl,
    optimizeDataUrl
  };
})();
