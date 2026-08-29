import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import {
  requireAdmin,
  getOwnedSession,
  writeAuditLog,
  UPLOAD_ALLOWED_STATES,
} from '@/lib/import/helpers'
import {
  validateImportFile,
  buildImportStoragePath,
  getExtension,
} from '@/lib/import/file-security'
import type { AllowedExtension } from '@/lib/import/file-security'

const BUCKET = 'hikaru-imports'

// POST /api/import/sessions/[id]/files
// セキュアファイルアップロード。
//
// 検証順序:
//   1. Authentication
//   2. Admin authorization
//   3. Session ownership (id + company_id)
//   4. Session status validation
//   5. File existence
//   6-12. lib/import/file-security.ts による全検証
//       (size / path-traversal / extension / MIME / magic-bytes / XLSM / EXE spoof)
//   13. Formula Risk Detection (audit/warning専用、raw value不変)
//
// Storage path: {company_id}/{session_id}/{uuid}.{ext}  — オリジナルファイル名を使わない
//
// Compensation:
//   DB insert失敗時はStorage Objectを削除してセッションをcreatedに戻す。
//
// SHA-256 hash:
//   import_filesスキーマに hash column が存在しないため今回は未実装。
//   Migration 049の次バージョンで追加が必要。
//
// OpenAI/AI calls: 0
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: sessionId } = await params

  // 1. Authentication
  const auth = await getAuthContext()
  if (!auth) {
    return NextResponse.json({ code: 'UNAUTHORIZED', message: '認証が必要です' }, { status: 401 })
  }

  // 2. Admin authorization
  if (!(await requireAdmin(auth))) {
    return NextResponse.json({ code: 'FORBIDDEN', message: '管理者権限が必要です' }, { status: 403 })
  }

  // 3. Session ownership (id + company_id の両方)
  const session = await getOwnedSession(auth, sessionId)
  if (!session) {
    return NextResponse.json(
      { code: 'IMPORT_SESSION_NOT_FOUND', message: 'インポートセッションが見つかりません' },
      { status: 404 },
    )
  }

  // 4. Session status validation
  if (!(UPLOAD_ALLOWED_STATES as readonly string[]).includes(session.status as string)) {
    return NextResponse.json(
      {
        code:    'INVALID_SESSION_STATE',
        message: `このセッション状態 (${session.status}) ではファイルをアップロードできません`,
      },
      { status: 409 },
    )
  }

  // 5. FormData / File existence
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json(
      { code: 'INVALID_REQUEST', message: 'マルチパートデータの解析に失敗しました' },
      { status: 400 },
    )
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json(
      { code: 'INVALID_FILE', message: 'fileフィールドが必要です' },
      { status: 400 },
    )
  }

  // 6-12. File security validation (lib/import/file-security.ts を再利用)
  const validation = await validateImportFile(file)
  if (!validation.valid) {
    const msg = validation.errors[0] ?? 'ファイルの検証に失敗しました'

    if (msg.includes('上限')) {
      return NextResponse.json({ code: 'FILE_TOO_LARGE', message: msg }, { status: 413 })
    }
    if (
      msg.includes('許可されていない') ||
      msg.includes('マクロ') ||
      msg.includes('ELF') ||
      msg.includes('PE') ||
      msg.includes('ZIP') ||
      msg.includes('ZIPヘッダー')
    ) {
      return NextResponse.json({ code: 'UNSUPPORTED_FILE_TYPE', message: msg }, { status: 415 })
    }
    return NextResponse.json({ code: 'INVALID_FILE', message: msg }, { status: 400 })
  }

  // 13. Formula Risk Detection — warning/audit専用、raw value は変更しない
  // CSV/XLSXの行レベルスキャンは将来のParser実装フェーズで行う。
  // ここでは validation.warnings に含まれる場合のみ記録。

  // Storage path: UUID使用、オリジナルファイル名を経路に含めない
  const ext      = getExtension(file.name) as AllowedExtension
  const fileUuid = crypto.randomUUID()
  const storagePath = buildImportStoragePath(auth.companyId, sessionId, fileUuid, ext)

  // Session status: created → uploading
  await auth.adminClient
    .from('import_sessions')
    .update({ status: 'uploading', updated_at: new Date().toISOString() } as never)
    .eq('id', sessionId)
    .eq('company_id', auth.companyId)

  // Storage upload
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await auth.adminClient.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType:  file.type || 'application/octet-stream',
      cacheControl: '3600',
      upsert:       false,
    })

  if (uploadError) {
    // Upload失敗: sessionをcreatedへ戻す
    console.error('[import/files POST] Storage upload failed:', uploadError.message)
    await auth.adminClient
      .from('import_sessions')
      .update({ status: 'created', error_message: 'Storage upload failed', updated_at: new Date().toISOString() } as never)
      .eq('id', sessionId)
      .eq('company_id', auth.companyId)

    writeAuditLog(auth, sessionId, 'session.failed', {
      reason: 'storage_upload_failed',
      error:  uploadError.message,
    })
    return NextResponse.json({ code: 'UPLOAD_FAILED', message: 'ファイルのアップロードに失敗しました' }, { status: 500 })
  }

  // DB insert: import_files
  const { data: fileRecord, error: insertError } = await auth.adminClient
    .from('import_files')
    .insert({
      session_id:        sessionId,
      company_id:        auth.companyId,
      original_filename: file.name,
      storage_path:      storagePath,
      mime_type:         file.type || 'application/octet-stream',
      file_size_bytes:   file.size,
      validation_status: 'valid',
      validation_errors: validation.warnings.length > 0
        ? { warnings: validation.warnings }
        : null,
    } as never)
    .select('id, original_filename, mime_type, file_size_bytes, validation_status, created_at')
    .single()

  if (insertError) {
    // Compensation: DB失敗時はStorageをロールバック
    console.error('[import/files POST] DB insert failed, rolling back storage:', insertError.message)
    await auth.adminClient.storage.from(BUCKET).remove([storagePath])
    await auth.adminClient
      .from('import_sessions')
      .update({ status: 'created', error_message: 'DB insert failed', updated_at: new Date().toISOString() } as never)
      .eq('id', sessionId)
      .eq('company_id', auth.companyId)

    writeAuditLog(auth, sessionId, 'session.failed', { reason: 'db_insert_failed' })
    return NextResponse.json({ code: 'UPLOAD_FAILED', message: 'ファイル情報の保存に失敗しました' }, { status: 500 })
  }

  // Session status: uploading → uploaded
  await auth.adminClient
    .from('import_sessions')
    .update({ status: 'uploaded', updated_at: new Date().toISOString() } as never)
    .eq('id', sessionId)
    .eq('company_id', auth.companyId)

  const fr = fileRecord as Record<string, unknown>

  // Non-blocking audit log (ファイル内容は保存しない)
  writeAuditLog(auth, sessionId, 'file.uploaded', {
    file_id:          fr.id,
    file_size_bytes:  file.size,
    mime_type:        file.type,
    ext,
    has_warnings:     validation.warnings.length > 0,
  })

  return NextResponse.json(
    {
      success: true,
      data: {
        file:    fileRecord,
        session: { id: sessionId, status: 'uploaded' },
        warnings: validation.warnings,
      },
    },
    { status: 201 },
  )
}
