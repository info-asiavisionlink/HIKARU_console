import { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import {
  generateScopedManualQA,
  NO_EVIDENCE_REPLY,
  type ManualItem,
  type ScopedManuals,
} from '@hikaru/lib/manual-ai'

// ============================================================
// POST /api/ai/console-manual-qa — Console Manual QA
// 認証: CONSOLE Admin（getAuthContext）
// HIKARUに登録されたManualを根拠に自然言語質問へ回答する。
// company_idはRequest bodyで受け取らない。Server authから確定。
// Write操作なし。SSEなし。Non-streaming JSON response。
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export const maxDuration = 45

const MANUAL_SELECT = 'id, title, type, content, category, file_url, project_id, order_num' as const

function toManualItems(rows: AnyClient[] | null, scope: ManualItem['scope']): ManualItem[] {
  return (rows ?? []).map((r: AnyClient) => ({
    id:         String(r.id),
    type:       r.type,
    title:      String(r.title ?? ''),
    content:    r.content  ?? null,
    file_url:   r.file_url ?? null,
    category:   r.category ?? null,
    project_id: r.project_id ?? null,
    scope,
  }))
}

export async function POST(req: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────
  const auth = await getAuthContext()
  if (!auth) {
    return Response.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 })
  }
  const { companyId, adminClient } = auth
  const admin = adminClient as AnyClient

  // ── 2. Request parse ─────────────────────────────────────
  let body: { question?: unknown; project_id?: unknown } = {}
  try { body = await req.json() } catch { /* empty body or invalid JSON → treat as empty */ }

  const question  = typeof body.question  === 'string' ? body.question.trim()  : ''
  const projectId = typeof body.project_id === 'string' ? body.project_id.trim() : ''

  if (!question) {
    return Response.json(
      { error: 'questionは必須です。', code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }
  if (question.length > 1000) {
    return Response.json(
      { error: 'questionは1000文字以内にしてください。', code: 'VALIDATION_ERROR' },
      { status: 400 },
    )
  }

  // ── 3. Project ownership check (project_id指定時のみ) ────
  if (projectId) {
    const { data: project, error: projectErr } = await admin
      .from('projects')
      .select('id, company_id')
      .eq('id', projectId)
      .single()

    if (projectErr || !project) {
      return Response.json(
        { error: 'プロジェクトが見つかりませんでした。', code: 'PROJECT_NOT_FOUND' },
        { status: 404 },
      )
    }
    if (project.company_id !== companyId) {
      return Response.json(
        { error: 'この案件へのアクセス権がありません。', code: 'FORBIDDEN' },
        { status: 403 },
      )
    }
  }

  // ── 4. Manual scope load ──────────────────────────────────
  try {
    // Project manuals: project_id指定時のみ取得
    const projectResult: { data: AnyClient[] | null; error: AnyClient } = projectId
      ? await admin
          .from('manuals')
          .select(MANUAL_SELECT)
          .eq('project_id', projectId)
          .order('order_num', { ascending: true })
          .limit(50)
      : { data: [], error: null }

    // Company + Global は常に並列取得
    const [companyResult, globalResult] = await Promise.all([
      admin
        .from('manuals')
        .select(MANUAL_SELECT)
        .eq('company_id', companyId)
        .eq('is_template', true)
        .is('project_id', null)
        .order('order_num', { ascending: true })
        .limit(100),
      admin
        .from('manuals')
        .select(MANUAL_SELECT)
        .is('company_id', null)
        .is('project_id', null)
        .order('order_num', { ascending: true })
        .limit(50),
    ])

    if (projectResult.error || companyResult.error || globalResult.error) {
      console.error('[console-manual-qa] manual load error', {
        pe: projectResult.error?.message,
        ce: companyResult.error?.message,
        ge: globalResult.error?.message,
      })
      return Response.json(
        { error: 'マニュアル情報を取得できませんでした。', code: 'MANUAL_LOAD_ERROR' },
        { status: 500 },
      )
    }

    const scoped: ScopedManuals = {
      project: toManualItems(projectResult.data, 'project'),
      company: toManualItems(companyResult.data, 'company'),
      global:  toManualItems(globalResult.data,  'global'),
    }

    const total = scoped.project.length + scoped.company.length + scoped.global.length

    // ── 5. Manual 0件: LLMを呼ばずに即返す ─────────────────
    if (total === 0) {
      return Response.json(
        { answer: NO_EVIDENCE_REPLY, sources: [], evidence_found: false },
        { status: 200 },
      )
    }

    // ── 6. Shared Core でQA実行 ──────────────────────────────
    const result = await generateScopedManualQA(question, scoped, {
      audience:        'admin',
      maxContentChars: 3000,
    })

    return Response.json(result, { status: 200 })

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[console-manual-qa] error:', msg)
    return Response.json(
      { error: 'AI回答の生成に失敗しました。もう一度お試しください。', code: 'LLM_ERROR' },
      { status: 500 },
    )
  }
}
