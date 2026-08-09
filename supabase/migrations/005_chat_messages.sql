-- ============================================================
-- HIKARU: チャット履歴テーブル
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID        NOT NULL REFERENCES public.projects(id)  ON DELETE CASCADE,
  worker_id   UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  job_id      UUID        REFERENCES public.jobs(id) ON DELETE SET NULL,
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT        NOT NULL,
  sources     TEXT[],     -- 参照したマニュアルタイトル一覧（assistantのみ）
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX chat_messages_project_id_idx ON public.chat_messages(project_id);
CREATE INDEX chat_messages_worker_id_idx  ON public.chat_messages(worker_id);
CREATE INDEX chat_messages_created_at_idx ON public.chat_messages(project_id, created_at DESC);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- 作業者は自分のチャット履歴のみ参照・作成
CREATE POLICY "chat_messages: worker own"
  ON public.chat_messages FOR ALL TO authenticated
  USING  (worker_id = auth.uid())
  WITH CHECK (worker_id = auth.uid());

-- 管理者は同一会社のチャット履歴を参照
CREATE POLICY "chat_messages: admin read company"
  ON public.chat_messages FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT id FROM public.projects WHERE public.is_admin_of(company_id)
    )
  );
