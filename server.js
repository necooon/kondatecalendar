const express = require('express');
const path = require('path');
const { GoogleGenAI, Type } = require('@google/genai');

const app = express();
const PORT = 3000;
const HOST = '0.0.0.0';

// Allow image uploads up to 20MB in JSON base64
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Serve static assets from the project root directory
app.use(express.static(path.join(__dirname)));

// Lazy-initialized GoogleGenAI client (never crashes on startup if GEMINI_API_KEY is missing)
let aiClient = null;
function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY が設定されていません。AI Studioの画面右上 Settings > Secrets で GEMINI_API_KEY を設定してください。');
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
  }
  return aiClient;
}

// Check if Gemini API is configured
app.get('/api/gemini/status', (req, res) => {
  const configured = Boolean(process.env.GEMINI_API_KEY);
  res.json({ ok: true, configured });
});

// Extract structured recipe data from an image using multimodal Gemini 3.8 Flash
app.post('/api/gemini/extract-recipe', async (req, res) => {
  try {
    const { image, mimeType } = req.body;
    if (!image) {
      return res.status(400).json({ ok: false, error: '画像データが提供されていません。' });
    }

    let base64Data = image;
    let detectedMimeType = mimeType || 'image/jpeg';

    if (typeof image === 'string') {
      const commaIdx = image.indexOf(',');
      if (image.startsWith('data:') && commaIdx !== -1) {
        const meta = image.slice(5, commaIdx);
        const [typePart] = meta.split(';');
        if (typePart) detectedMimeType = typePart.trim();
        base64Data = image.slice(commaIdx + 1);
      }
    }

    // Strip newlines/whitespace from base64 data
    base64Data = String(base64Data).replace(/\s+/g, '');

    const ai = getGenAI();

    const imagePart = {
      inlineData: {
        mimeType: detectedMimeType,
        data: base64Data
      }
    };

    const textPart = {
      text: `あなたはプロの料理研究家および高精度なレシピOCR解析エキスパートです。
提供された画像（料理本、レシピカード、手書きメモ、WebやSNSのレシピ画面スクリーンショット、または料理の写真）から、レシピの各項目を正確に読み取り、指定のJSON形式で返してください。

【抽出ルール】
1. 料理名 (name):
   - 画像に記載されている料理名を正確に抽出してください。料理写真の場合は適切な料理名を特定してください。
2. 人数 (servingsBase):
   - 「2人分」「4人分」等の記載があれば数値を半角整数で抽出してください。記載がない場合は 2 をデフォルトにしてください。
3. タグ (tag):
   - 料理の主材料やジャンル・特徴を表す短いタグ（例: "定番 #01"、"主菜"、"鶏肉料理"、"時短"、"作り置き" など）。
4. メモ (note):
   - レシピに書かれているコツ、火加減の注意、味変ポイント、保存期間の目安などがあれば簡潔にまとめてください。なければ空文字にしてください。
5. 材料 (ingredients):
   - 調味料・食材を1行ずつ分割してください。
   - name: 食材・調味料の名称（例: "鶏むね肉", "玉ねぎ", "醤油", "酒", "ごま油"）
   - baseAmount: 分量の数値。分数（1/2など）は小数（0.5）に変換してください。「適量」「少々」などで数値が特定できない場合は 0 にしてください。
   - unit: 単位（"g", "ml", "大さじ", "小さじ", "個", "本", "枚", "丁", "束", "片", "かけ", "切れ", "尾", "適量", "少々" 等、日本語の一般的な料理単位）。
   - note: 補足（例: "乱切り", "1cm幅にスライス", "すりおろし" など）。
6. 調理手順 (steps):
   - 料理の手順を1ステップずつ順番に記述してください。
   - title: 手順の短い見出し（例: "下準備", "炒める", "味付け", "煮込む", "盛り付け" 等）。
   - instruction: 手順の具体的な説明。
   - timerSeconds: 手順中に「〇分加熱する」「約〇分置く」などの具体的なタイマー時間が書かれている場合は秒数（3分なら 180）で抽出。タイマー不要なら 0 または null。

文字が一部不鮮明な場合でも、料理の文脈からもっとも自然で美味しい手順・材料となるよう補正してください。`
    };

    const config = {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: '料理名' },
          servingsBase: { type: Type.INTEGER, description: '何人分の分量か（通常2など）' },
          tag: { type: Type.STRING, description: '料理のタグや分類' },
          note: { type: Type.STRING, description: '調理のコツやメモ' },
          ingredients: {
            type: Type.ARRAY,
            description: '材料一覧',
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING, description: '材料名' },
                baseAmount: { type: Type.NUMBER, description: '分量の数値（適量・少々は0）' },
                unit: { type: Type.STRING, description: '単位（g, ml, 大さじ, 小さじ, 個, 本等）' },
                note: { type: Type.STRING, description: '備考（切り方等）' }
              },
              required: ['name', 'unit']
            }
          },
          steps: {
            type: Type.ARRAY,
            description: '調理手順一覧',
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: '手順見出し' },
                instruction: { type: Type.STRING, description: '手順の具体的な説明' },
                timerSeconds: { type: Type.INTEGER, description: 'タイマー秒数（例: 180）' }
              },
              required: ['instruction']
            }
          }
        },
        required: ['name', 'servingsBase', 'ingredients', 'steps']
      }
    };

    const modelsToTry = ['gemini-3.6-flash', 'gemini-3.8-flash'];
    let lastError = null;
    let response = null;

    for (const modelName of modelsToTry) {
      try {
        response = await ai.models.generateContent({
          model: modelName,
          contents: {
            parts: [imagePart, textPart]
          },
          config
        });
        if (response && response.text) {
          break;
        }
      } catch (e) {
        console.warn(`Attempt with ${modelName} failed:`, e.message || e);
        lastError = e;
      }
    }

    if (!response || !response.text) {
      throw lastError || new Error('Geminiモデルから応答を取得できませんでした。');
    }

    let outputText = (response.text || '').trim();
    if (!outputText) {
      throw new Error('Geminiモデルから応答が空でした。');
    }

    // Strip markdown fences if present
    if (outputText.startsWith('```')) {
      outputText = outputText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    }

    let recipeData;
    try {
      recipeData = JSON.parse(outputText);
    } catch (parseErr) {
      // Attempt substring JSON extraction if extra characters exist
      const firstBrace = outputText.indexOf('{');
      const lastBrace = outputText.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace > firstBrace) {
        recipeData = JSON.parse(outputText.slice(firstBrace, lastBrace + 1));
      } else {
        throw new Error(`AIの応答をJSONとして解析できませんでした: ${parseErr.message}`);
      }
    }

    return res.json({ ok: true, recipe: recipeData });
  } catch (err) {
    console.error('Gemini recipe extraction error:', err);
    const message = err.message || 'レシピの画像解析中にエラーが発生しました。';
    return res.status(500).json({ ok: false, error: message });
  }
});

// Fallback to index.html for SPA/client-side routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`RecipeOps server running at http://${HOST}:${PORT}`);
});
