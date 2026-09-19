window.KitchenGit = window.KitchenGit || {};

KitchenGit.ChatRecipe = (function () {
  let appState = null;
  let hooks = {};
  let messages = [];
  let isSending = false;

  function init(state, options = {}) {
    appState = state;
    hooks = options;
  }

  function open() {
    const backdrop = document.getElementById('chat-recipe-backdrop');
    const modal = document.getElementById('chat-recipe-modal');
    if (backdrop) backdrop.classList.remove('hidden');
    if (modal) modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // If messages are empty, initialize with welcoming assistant message
    if (messages.length === 0) {
      messages.push({
        role: 'model',
        content: 'こんにちは！AIレシピ作成アシスタントです。\n「冷蔵庫の食材で何か作りたい」「子供が喜ぶおかずを教えて」「10分でできるパスタ」など、何でもお気軽にご相談ください！一緒に美味しいレシピを作りましょう✨',
        recipe: null
      });
    }
    renderMessages();
  }

  function close() {
    const backdrop = document.getElementById('chat-recipe-backdrop');
    const modal = document.getElementById('chat-recipe-modal');
    if (backdrop) backdrop.classList.add('hidden');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
  }

  function renderMessages() {
    const container = document.getElementById('chat-messages-container');
    if (!container) return;

    container.innerHTML = messages.map((m, index) => {
      const isUser = m.role === 'user';
      const bubbleClass = isUser
        ? 'bg-slate-900 text-white rounded-2xl rounded-tr-xs px-4 py-3 text-xs leading-relaxed max-w-[85%] ml-auto shadow-sm whitespace-pre-wrap'
        : 'bg-slate-100 text-slate-800 rounded-2xl rounded-tl-xs px-4 py-3 text-xs leading-relaxed max-w-[90%] mr-auto border border-slate-200/80 shadow-xs whitespace-pre-wrap';

      let recipeHtml = '';
      if (m.recipe) {
        const r = m.recipe;
        const ingSummary = (r.ingredients || []).slice(0, 5).map(i => `${i.name} ${i.baseAmount || ''}${i.unit || ''}`).join('、');
        const stepCount = (r.steps || []).length;
        recipeHtml = `
          <div class="mt-3 bg-white rounded-2xl border border-slate-800 p-3.5 space-y-2.5 shadow-sm">
            <div class="flex items-center justify-between">
              <span class="bg-slate-800 text-slate-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-slate-800">AI提案レシピ</span>
              <span class="text-[10px] text-slate-400 font-mono">${r.servingsBase || 2}人分 • 工程${stepCount}</span>
            </div>
            <h4 class="text-sm font-bold text-slate-900">${escapeHtml(r.name)}</h4>
            ${r.tag ? `<p class="text-[11px] text-slate-900 font-bold">🏷️ ${escapeHtml(r.tag)}</p>` : ''}
            <p class="text-[11px] text-slate-600"><strong>主な材料:</strong> ${escapeHtml(ingSummary)}${(r.ingredients || []).length > 5 ? '…他' : ''}</p>
            ${r.note ? `<p class="text-[10px] text-slate-500 italic bg-slate-50 p-2 rounded-xl">💡 ${escapeHtml(r.note)}</p>` : ''}
            <button type="button" onclick="KitchenGit.ChatRecipe.registerRecipeFromChat(${index})" class="active-scale w-full bg-gradient-to-r from-slate-800 to-purple-600 hover:from-slate-800 hover:to-purple-700 text-white font-bold text-xs py-2.5 px-3 rounded-xl shadow-md shadow-slate-800/20 flex items-center justify-center gap-1.5">
              <i class="fa-solid fa-bookmark"></i>
              <span>このレシピをレシピ帳に登録する</span>
            </button>
          </div>
        `;
      }

      return `
        <div class="flex flex-col gap-1">
          <div class="flex items-start gap-2 ${isUser ? 'flex-row-reverse' : ''}">
            <div class="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-xs font-bold ${isUser ? 'bg-slate-800 text-white' : 'bg-gradient-to-tr from-slate-800 to-purple-600 text-white'}">
              <i class="fa-solid ${isUser ? 'fa-user' : 'fa-wand-magic-sparkles'} text-[10px]"></i>
            </div>
            <div class="${bubbleClass}">
              <div>${escapeHtml(m.content)}</div>
              ${recipeHtml}
            </div>
          </div>
        </div>
      `;
    }).join('');

    container.scrollTop = container.scrollHeight;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async function sendMessage(textToSend) {
    const input = document.getElementById('chat-input-field');
    const text = (textToSend != null ? textToSend : (input ? input.value : '')).trim();
    if (!text || isSending) return;

    if (input && textToSend == null) input.value = '';

    messages.push({ role: 'user', content: text, recipe: null });
    renderMessages();

    isSending = true;
    const sendBtn = document.getElementById('chat-send-btn');
    if (sendBtn) sendBtn.disabled = true;

    // Add temporary loading indicator message
    const loadingIdx = messages.length;
    messages.push({ role: 'model', content: 'AIがレシピを考えています…', recipe: null });
    renderMessages();

    try {
      const payloadMessages = messages.slice(0, loadingIdx).map(m => ({
        role: m.role,
        content: m.content
      }));

      const res = await fetch('/api/gemini/chat-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: payloadMessages })
      });
      const data = await res.json();

      messages.splice(loadingIdx, 1); // remove loading message

      if (data.ok && data.reply) {
        messages.push({
          role: 'model',
          content: data.reply,
          recipe: data.recipe || null
        });
      } else {
        messages.push({
          role: 'model',
          content: '申し訳ありません。応答の生成中にエラーが発生しました。もう一度お試しください。',
          recipe: null
        });
      }
    } catch (err) {
      console.error(err);
      messages.splice(loadingIdx, 1);
      messages.push({
        role: 'model',
        content: '通信エラーが発生しました。ネットワーク接続をご確認ください。',
        recipe: null
      });
    } finally {
      isSending = false;
      if (sendBtn) sendBtn.disabled = false;
      renderMessages();
    }
  }

  async function registerRecipeFromChat(messageIndex) {
    const m = messages[messageIndex];
    if (!m || !m.recipe) return;
    const r = m.recipe;

    const n = window.KitchenGit && KitchenGit.Nutrition;
    const servingsBase = Number(r.servingsBase) || 2;
    const ingredients = (r.ingredients || []).map(i => ({
      name: i.name,
      baseAmount: Number(i.baseAmount) || 0,
      unit: i.unit || 'g',
      note: i.note || ''
    }));
    const steps = (r.steps || []).map(s => ({
      title: s.title || '',
      instruction: s.instruction || '',
      timer: s.timerSeconds != null ? Number(s.timerSeconds) : null,
      uses: []
    }));

    const computed = n ? n.computePerServing(ingredients, servingsBase) : { p: 0, f: 0, c: 0, kcal: 0 };
    const pfc = { p: computed.p, f: computed.f, c: computed.c, kcal: computed.kcal };
    const tag = r.tag || 'AIチャット作成';
    const tags = tag ? tag.split(/[#＃,\s]+/).map(t => t.trim()).filter(Boolean) : [];
    const now = new Date().toISOString();

    const payload = {
      name: r.name || 'AI作成レシピ',
      tag,
      tags,
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c',
      branch: 'main',
      servingsBase,
      intervalDays: 0,
      pfc,
      versions: {
        'v1.0': {
          title: 'v1.0',
          note: r.note || 'AIチャットにより作成されたレシピ',
          sortOrder: 0,
          branch: 'main',
          hash: KitchenGit.RecipeModel.shortHash((r.name || '') + now),
          author: 'You',
          committedAt: now,
          ingredients,
          steps
        }
      }
    };

    try {
      let saved;
      if (window.KitchenGit && KitchenGit.RecipesDB && KitchenGit.RecipesDB.isReady()) {
        saved = await KitchenGit.RecipesDB.insertRecipe(payload);
        const all = await KitchenGit.RecipesDB.fetchAll();
        appState.recipes = all;
      } else {
        saved = { ...payload, id: 'local-' + Date.now() };
        appState.recipes = [saved, ...appState.recipes];
      }

      close();
      if (typeof window.showToast === 'function') {
        window.showToast(`「${r.name}」をレシピ帳に登録しました！`);
      }
      if (typeof window.showRecipeDetail === 'function') {
        window.showRecipeDetail(saved.id);
      }
      if (typeof window.switchTab === 'function') {
        window.switchTab('recipe');
      }
      if (hooks.onRecipeAdded) {
        hooks.onRecipeAdded(saved);
      }
    } catch (e) {
      console.error(e);
      if (typeof window.showToast === 'function') {
        window.showToast('レシピの登録に失敗しました', 'error');
      }
    }
  }

  return {
    init,
    open,
    close,
    sendMessage,
    registerRecipeFromChat
  };
})();
