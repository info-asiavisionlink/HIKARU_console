-- ============================================================
-- HIKARU: コンソール管理テーブル
-- 案件・店舗・顧客・作業場所・撮影箇所・マニュアル
-- ============================================================

-- ---- Enums ----
CREATE TYPE public.project_status AS ENUM ('active', 'paused', 'completed', 'cancelled');
CREATE TYPE public.manual_type    AS ENUM ('pdf', 'image', 'video', 'text', 'faq', 'note');

-- ============================================================
-- clients（顧客企業）
-- ============================================================
CREATE TABLE public.clients (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id   UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name         TEXT        NOT NULL,
  code         TEXT,
  email        TEXT,
  phone        TEXT,
  address      TEXT,
  contact_name TEXT,
  notes        TEXT,
  is_active    BOOLEAN     NOT NULL DEFAULT true,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX clients_company_id_idx ON public.clients(company_id);
CREATE INDEX clients_code_idx       ON public.clients(code) WHERE code IS NOT NULL;
CREATE INDEX clients_is_active_idx  ON public.clients(is_active);

-- ============================================================
-- stores（店舗）
-- ============================================================
CREATE TABLE public.stores (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         UUID        NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  company_id        UUID        NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  code              TEXT,
  address           TEXT,
  phone             TEXT,
  business_hours    TEXT,
  manager_name      TEXT,
  emergency_contact TEXT,
  contract_info     TEXT,
  notes             TEXT,
  is_active         BOOLEAN     NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX stores_client_id_idx  ON public.stores(client_id);
CREATE INDEX stores_company_id_idx ON public.stores(company_id);
CREATE INDEX stores_code_idx       ON public.stores(code) WHERE code IS NOT NULL;
CREATE INDEX stores_is_active_idx  ON public.stores(is_active);

-- ============================================================
-- locations（作業場所 – 店舗ごと）
-- ============================================================
CREATE TABLE public.locations (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id   UUID        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name       TEXT        NOT NULL,
  order_num  INT         NOT NULL DEFAULT 0,
  is_active  BOOLEAN     NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX locations_store_id_idx ON public.locations(store_id);

-- ============================================================
-- photo_spots（撮影箇所 – 店舗ごと）
-- ============================================================
CREATE TABLE public.photo_spots (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id      UUID        NOT NULL REFERENCES public.stores(id) ON DELETE CASCADE,
  name          TEXT        NOT NULL,
  description   TEXT,
  order_num     INT         NOT NULL DEFAULT 0,
  is_required   BOOLEAN     NOT NULL DEFAULT true,
  ref_image_url TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX photo_spots_store_id_idx ON public.photo_spots(store_id);

-- ============================================================
-- projects（案件）
-- ============================================================
CREATE TABLE public.projects (
  id            UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id    UUID                  NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  store_id      UUID                  NOT NULL REFERENCES public.stores(id) ON DELETE RESTRICT,
  name          TEXT                  NOT NULL,
  code          TEXT,
  status        public.project_status NOT NULL DEFAULT 'active',
  start_date    DATE,
  end_date      DATE,
  contract_info TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX projects_company_id_idx ON public.projects(company_id);
CREATE INDEX projects_store_id_idx   ON public.projects(store_id);
CREATE INDEX projects_status_idx     ON public.projects(status);
CREATE INDEX projects_code_idx       ON public.projects(code) WHERE code IS NOT NULL;

-- ============================================================
-- project_workers（案件担当作業者）
-- ============================================================
CREATE TABLE public.project_workers (
  project_id  UUID        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  worker_id   UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, worker_id)
);

CREATE INDEX project_workers_worker_id_idx ON public.project_workers(worker_id);

-- ============================================================
-- manuals（マニュアル・資料）
-- ============================================================
CREATE TABLE public.manuals (
  id         UUID               PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID               NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  type       public.manual_type NOT NULL DEFAULT 'text',
  title      TEXT               NOT NULL,
  content    TEXT,
  file_url   TEXT,
  order_num  INT                NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ        NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ        NOT NULL DEFAULT NOW()
);

CREATE INDEX manuals_project_id_idx ON public.manuals(project_id);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE public.clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_spots   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manuals       ENABLE ROW LEVEL SECURITY;

-- Helper: 同一会社の管理者かどうか
CREATE OR REPLACE FUNCTION public.is_admin_of(target_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin' AND company_id = target_company_id
  )
$$;

-- Helper: 同一会社メンバーかどうか
CREATE OR REPLACE FUNCTION public.is_member_of(target_company_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND company_id = target_company_id
  )
$$;

-- clients
CREATE POLICY "clients: admin CRUD"
  ON public.clients FOR ALL TO authenticated
  USING (public.is_admin_of(company_id));
CREATE POLICY "clients: members read"
  ON public.clients FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

-- stores
CREATE POLICY "stores: admin CRUD"
  ON public.stores FOR ALL TO authenticated
  USING (public.is_admin_of(company_id));
CREATE POLICY "stores: members read"
  ON public.stores FOR SELECT TO authenticated
  USING (public.is_member_of(company_id));

-- locations
CREATE POLICY "locations: admin CRUD"
  ON public.locations FOR ALL TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE public.is_admin_of(company_id)));
CREATE POLICY "locations: members read"
  ON public.locations FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE public.is_member_of(company_id)));

-- photo_spots
CREATE POLICY "photo_spots: admin CRUD"
  ON public.photo_spots FOR ALL TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE public.is_admin_of(company_id)));
CREATE POLICY "photo_spots: members read"
  ON public.photo_spots FOR SELECT TO authenticated
  USING (store_id IN (SELECT id FROM public.stores WHERE public.is_member_of(company_id)));

-- projects
CREATE POLICY "projects: admin CRUD"
  ON public.projects FOR ALL TO authenticated
  USING (public.is_admin_of(company_id));
CREATE POLICY "projects: assigned workers read"
  ON public.projects FOR SELECT TO authenticated
  USING (id IN (SELECT project_id FROM public.project_workers WHERE worker_id = auth.uid()));

-- project_workers
CREATE POLICY "project_workers: admin CRUD"
  ON public.project_workers FOR ALL TO authenticated
  USING (project_id IN (
    SELECT id FROM public.projects WHERE public.is_admin_of(company_id)
  ));

-- manuals
CREATE POLICY "manuals: admin CRUD"
  ON public.manuals FOR ALL TO authenticated
  USING (project_id IN (
    SELECT id FROM public.projects WHERE public.is_admin_of(company_id)
  ));
CREATE POLICY "manuals: assigned workers read"
  ON public.manuals FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT project_id FROM public.project_workers WHERE worker_id = auth.uid()
  ));

-- ============================================================
-- Updated_at トリガー（001 で作成済みの関数を再利用）
-- ============================================================
CREATE TRIGGER clients_updated_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER stores_updated_at
  BEFORE UPDATE ON public.stores
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER photo_spots_updated_at
  BEFORE UPDATE ON public.photo_spots
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER manuals_updated_at
  BEFORE UPDATE ON public.manuals
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
