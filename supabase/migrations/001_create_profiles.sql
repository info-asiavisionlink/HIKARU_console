-- ============================================================
-- HIKARU: ユーザープロフィール・権限管理
-- ============================================================

-- ---- ユーザー権限 Enum ----
-- 将来的に role を追加する場合はここに追加
-- 例: 'area_manager', 'auditor' など
CREATE TYPE public.user_role AS ENUM ('admin', 'worker', 'client');

-- ---- 会社（組織）テーブル ----
-- 清掃会社が使用するテナント単位
CREATE TABLE public.companies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL,
  logo_url    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ---- ユーザープロフィールテーブル ----
-- auth.users を拡張してビジネス情報を保持
CREATE TABLE public.profiles (
  id              UUID           PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT           NOT NULL,
  name            TEXT           NOT NULL DEFAULT '',
  role            public.user_role NOT NULL DEFAULT 'worker',
  company_id      UUID           REFERENCES public.companies(id) ON DELETE SET NULL,
  phone           TEXT,
  avatar_url      TEXT,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ---- インデックス ----
CREATE INDEX profiles_role_idx       ON public.profiles(role);
CREATE INDEX profiles_company_id_idx ON public.profiles(company_id);
CREATE INDEX profiles_email_idx      ON public.profiles(email);

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles  ENABLE ROW LEVEL SECURITY;

-- ---- companies RLS ----
-- 管理者は自社のみ参照
CREATE POLICY "companies: members read own"
  ON public.companies FOR SELECT
  TO authenticated
  USING (
    id IN (
      SELECT company_id FROM public.profiles
      WHERE id = auth.uid()
    )
  );

-- ---- profiles RLS ----

-- 自分のプロフィールは常に参照可能
CREATE POLICY "profiles: read own"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

-- 同一会社の全プロフィールを管理者が参照可能
CREATE POLICY "profiles: admin read same company"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.company_id = profiles.company_id
    )
  );

-- 自分のプロフィールを更新可能（roleとcompany_idは除く）
CREATE POLICY "profiles: update own non-sensitive"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- NOTE: role, company_id の変更はアプリケーション層で管理者のみ許可
  );

-- 管理者は同一会社のプロフィールを更新可能
CREATE POLICY "profiles: admin update same company"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.role = 'admin'
        AND p.company_id = profiles.company_id
    )
  );

-- ============================================================
-- トリガー関数
-- ============================================================

-- auth.users に新規登録時、profiles を自動作成
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'name',
      split_part(NEW.email, '@', 1)
    ),
    COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.user_role,
      'worker'
    )
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 初期データ: 開発用デフォルト会社
-- ============================================================

-- 開発・テスト用の会社レコード（本番では削除または変更）
INSERT INTO public.companies (id, name)
VALUES ('00000000-0000-0000-0000-000000000001', 'HIKARU開発環境')
ON CONFLICT DO NOTHING;
