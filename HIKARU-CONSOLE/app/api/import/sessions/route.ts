import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import {
  requireAdmin,
  writeAuditLog,
  VALID_ENTITY_TYPES,
  VALID_SOURCE_TYPES,
  SESSION_LIST_LIMIT,
} from '@/lib/import/helpers'
import type { ImportEntityType, ImportSourceType } from '@/types/import'

// POST /api/import/sessions
// Import Sessionを新規作成する。
//
// company_id / created_by / status はサーバー側で決定。
// クライアントから受け取る値: entity_type, source_type, label のみ。
export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '認証が必要です' }, { status: 401 })
  }
  if (!(await requireAdmin(auth))) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '管理者権限が必要です' }, { status: 403 })
  }

  let raw: Record<string, unknown>
  try {
    raw = await req.json()
  } catch {
    return NextResponse.json({ code: 'INVALID_REQUEST', message: 'リクエストボディが不正です' }, { status: 400 })
  }

  const entityType = raw.entity_type as ImportEntityType
  if (!entityType || !(VALID_ENTITY_TYPES as readonly string[]).includes(entityType)) {
    return NextResponse.json(
      { code: 'INVALID_ENTITY_TYPE', message: `entity_type は ${VALID_ENTITY_TYPES.join(', ')} のいずれかです` },
      { status: 400 },
    )
  }

  const sourceType = raw.source_type as ImportSourceType
  if (!sourceType || !(VALID_SOURCE_TYPES as readonly string[]).includes(sourceType)) {
    return NextResponse.json(
      { code: 'INVALID_SOURCE_TYPE', message: `source_type は ${VALID_SOURCE_TYPES.join(', ')} のいずれかです` },
      { status: 400 },
    )
  }

  // label: optional, 最大200文字、空文字はNULL
  const label = typeof raw.label === 'string' ? raw.label.trim().slice(0, 200) || null : null

  const { data: session, error } = await auth.adminClient
    .from('import_sessions')
    .insert({
      company_id:  auth.companyId,
      created_by:  auth.userId,
      status:      'created',
      entity_type: entityType,
      source_type: sourceType,
      label,
    } as never)
    .select('id, status, entity_type, source_type, label, scan_status, created_at')
    .single()

  if (error) {
    console.error('[import/sessions POST] DB error:', error.code, error.message)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: 'セッションの作成に失敗しました' }, { status: 500 })
  }

  const s = session as Record<string, unknown>

  writeAuditLog(auth, s.id as string, 'session.created', {
    entity_type: entityType,
    source_type: sourceType,
  })

  return NextResponse.json({ success: true, data: session }, { status: 201 })
}

// GET /api/import/sessions
// 自社のImport Session一覧を返す。
//
// 取得数上限: SESSION_LIST_LIMIT (50件)
// 並び順: created_at DESC
// company_idは必ずAuth Contextから取得 — クエリパラメータは使用しない。
export async function GET(_req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '認証が必要です' }, { status: 401 })
  }
  if (!(await requireAdmin(auth))) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '管理者権限が必要です' }, { status: 403 })
  }

  const { data: sessions, error } = await auth.adminClient
    .from('import_sessions')
    .select('id, status, entity_type, source_type, label, total_rows, valid_rows, invalid_rows, duplicate_rows, scan_status, created_at, updated_at')
    .eq('company_id', auth.companyId)
    .order('created_at', { ascending: false })
    .limit(SESSION_LIST_LIMIT)

  if (error) {
    console.error('[import/sessions GET] DB error:', error.code, error.message)
    return NextResponse.json({ code: 'INTERNAL_ERROR', message: '一覧の取得に失敗しました' }, { status: 500 })
  }

  return NextResponse.json({
    success: true,
    data:    sessions ?? [],
    count:   sessions?.length ?? 0,
  })
}
