# RecipeOps

iPhone向けの献立・買い物・レシピ管理アプリです。レシピの味変を Git のコミットのように残し、人数（1人/2人）や作り置き、買い物リストを1画面で扱います。

公開 URL: https://necooon.github.io/kondatecalendar/

ビルドは不要です。`index.html` をブラウザで開くか、上の GitHub Pages を使ってください。

## 画面

| タブ | できること |
|------|------------|
| 献立 | 日付ピッカーで朝・昼・晩のメニュー確認、人数トグル、土曜の空き枠への AI 提案、日曜作り置きストック |
| 買い物 | 売り場カテゴリ別リスト。家にある食材をタップすると打ち消し線＋「ストック有」になり、タブの件数バッジが減る。スーパーモードで文字を大きくする |
| レシピ管理 | レシピ一覧・新規登録、GitHub風のブランチ/コミット切替、人数（1〜12）に応じた分量とPFC、調理手順、レシピ編集（バージョン自動採番） |

調理モードは手順を大きく表示し、進捗バー・タイマー（開始/一時停止/リセット）と Screen Wake Lock（対応ブラウザ）で画面を消灯しにくくします。最後のステップ完了後にレシピ編集モーダルが開き、保存時はバージョンが自動で進みます。

## クラウド（レシピ・献立）

専用の Supabase プロジェクト（kondatecalendar）にレシピと献立を保存します。`public.recipes` は材料・手順の HEAD スナップショットに加え、`versions` JSONB で味コミット履歴を持ちます。`public.meal_days` は日付ごとの朝・昼・晩（`meals` JSONB）と人数・PFC を持ちます。初回だけ SQL Editor でスキーマを実行してください。

1. [Supabase SQL Editor](https://supabase.com/dashboard/project/aqrlponulqzjmfisvhlu/sql) を開く
2. [`supabase/recipes.sql`](supabase/recipes.sql) の内容を実行する
3. [`supabase/meals.sql`](supabase/meals.sql) の内容を実行する

レシピが空のときはデモの「鶏むね肉と秋茄子のさっぱり炒め」をシードします。献立が空のときは今週のデモ献立をシードします。テーブルがまだ無い場合はオフラインのデモ表示になり、登録内容はこの画面にだけ残ります。

TypeScript の Database 型は [`types/supabase.ts`](types/supabase.ts) です（ランタイムはバニラ JS）。

## iPhone で使う

1. Safari でこのページを開く
2. 共有 → **ホーム画面に追加**
3. スタンドアロンの PWA として起動する（ノッチ／ホームバーはセーフエリア対応）

GitHub Pages は `main` への push で自動デプロイされます。

## 技術

静的 HTML / Tailwind CSS（CDN）/ バニラ JavaScript / Supabase です。
