-- =============================================
-- SOI Check App — Supabase テーブル設定
-- Supabase Dashboard > SQL Editor で実行する
-- =============================================

-- 1. テーブル作成
CREATE TABLE IF NOT EXISTS public.soi_checks (
  id         BIGSERIAL PRIMARY KEY,
  soi        TEXT NOT NULL,
  store_id   TEXT NOT NULL,
  date       DATE NOT NULL,
  checks     JSONB NOT NULL DEFAULT '{}',
  notes      JSONB NOT NULL DEFAULT '{}',
  saved_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (soi, store_id, date)
);

-- 2. インデックス（日付・店舗での絞り込みを高速化）
CREATE INDEX IF NOT EXISTS idx_soi_checks_date     ON public.soi_checks (date DESC);
CREATE INDEX IF NOT EXISTS idx_soi_checks_store    ON public.soi_checks (store_id);
CREATE INDEX IF NOT EXISTS idx_soi_checks_soi      ON public.soi_checks (soi);

-- 3. Row Level Security（全員読み書き可）
ALTER TABLE public.soi_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_read"  ON public.soi_checks FOR SELECT USING (true);
CREATE POLICY "allow_all_write" ON public.soi_checks FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_all_update"ON public.soi_checks FOR UPDATE USING (true);

-- 4. Realtime 有効化
ALTER PUBLICATION supabase_realtime ADD TABLE public.soi_checks;
