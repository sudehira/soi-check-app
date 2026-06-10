# SOI Check App — 公開手順

## 所要時間：約20分

---

## STEP 1：Supabase セットアップ（DB作成）

1. https://supabase.com にアクセス → **Start your project**
2. GitHubアカウントでサインイン（無料）
3. **New Project** → プロジェクト名を入力（例: `soi-check`）→ パスワード設定 → Create
4. 左メニュー **SQL Editor** → `supabase_setup.sql` の中身を貼り付けて **Run**
5. 左メニュー **Project Settings > API** を開く
   - `Project URL` をコピー → `.env` の `REACT_APP_SUPABASE_URL` に貼る
   - `anon public` キーをコピー → `.env` の `REACT_APP_SUPABASE_ANON_KEY` に貼る

---

## STEP 2：GitHub にコードをアップロード

1. https://github.com にアクセス → サインイン（無料）
2. **New repository** → 名前: `soi-check-app` → Create
3. ローカルでターミナルを開く：
   ```bash
   cd soi-app
   git init
   git add .
   git commit -m "initial commit"
   git branch -M main
   git remote add origin https://github.com/あなたのユーザー名/soi-check-app.git
   git push -u origin main
   ```

---

## STEP 3：Vercel でデプロイ

1. https://vercel.com にアクセス → **Continue with GitHub** でサインイン
2. **Add New Project** → `soi-check-app` リポジトリを選択 → Import
3. **Environment Variables** セクションで2つ追加：
   ```
   REACT_APP_SUPABASE_URL      = https://xxxxxx.supabase.co
   REACT_APP_SUPABASE_ANON_KEY = eyJxxxxxxxx...
   ```
4. **Deploy** ボタンを押す → 2〜3分でデプロイ完了
5. `https://soi-check-app.vercel.app` のようなURLが発行される

---

## STEP 4：社内共有

- 発行されたURLをZaloグループや社内チャットで共有するだけ
- スマホのブラウザで開けばすぐ使える（アプリインストール不要）
- ホーム画面に追加すればアプリのように使用可能

---

## データの確認方法

- アプリ内 **Dashboard** → リアルタイムで全員の入力が集計される
- Supabase Dashboard > **Table Editor** → `soi_checks` テーブルで生データ確認
- CSVエクスポートも可能（Table Editor > Export）

---

## トラブルシューティング

| 症状 | 対処 |
|------|------|
| 保存できない | Supabase の URL / Key が正しいか確認 |
| データが見えない | SQL Editor で RLS ポリシーが作成されているか確認 |
| Vercelビルドエラー | Environment Variables が設定されているか確認 |
