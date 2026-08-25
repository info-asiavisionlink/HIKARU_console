import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { getEmailConfig } from '@/lib/email/config'
import { buildReportEmail } from '@/lib/email/document-template'
import {
  hasSentDocument,
  createPendingLog,
  markSent,
  markFailed,
  isValidEmailAddress,
  type EmailLog,
} from '@/lib/email/log'
import { sendEmail } from '@/lib/email/resend'

// Invoice route と同一: "Name <email>" 形式からアドレス部分を抽出
function extractEmailAddress(from: string): string {
  const m = from.match(/<([^>]+)>/)
  return m ? m[1].trim() : from.trim()
}

// ─────────────────────────────────────────────────────────────────
// GET /api/reports/[id]/email
// 作業完了報告書メール送信プレビュー情報を返す。
// 実際のメール送信は行わない。
//
// 送信先: reports → projects.client_id → clients.email
//         invoice_email は使わない（報告書は請求書専用アドレス不使用）
//
// レスポンス:
//   configured     boolean     Resend設定が完了しているか
//   to_email       string|null 送信先
//   subject        string      メール件名
//   body_text      string      メール本文
//   pdf_available  boolean     PDFが生成・保存済みか
//   pdf_filename   string|null PDFファイル名
//   can_send       boolean     現時点で送信可能かどうか
//   reason         string|null 送信不可の理由
//   is_resend      boolean     過去に同report_idで送信済みか
// ─────────────────────────────────────────────────────────────────
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 1. report取得・ownership確認 ─────────────────────────────
  const { data: report } = await auth.adminClient
    .from('reports')
    .select(`
      id, version, pdf_url, created_at,
      content,
      projects:project_id (
        name, client_id,
        clients:client_id (name, email)
      )
    `)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()

  if (!report) return NextResponse.json({ error: '報告書が見つかりません' }, { status: 404 })

  const project = report.projects  as any
  const client  = project?.clients as any

  // ── 2. 自社名取得 ─────────────────────────────────────────────
  const { data: company } = await auth.adminClient
    .from('companies')
    .select('name')
    .eq('id', auth.companyId)
    .single()

  const companyName = company?.name ?? 'HIKARU'

  // ── 3. 送信先決定（サーバー側確定・ブラウザ値不使用）──────────
  // 作業完了報告書は clients.email を使用（invoice_email は請求書専用）
  const toEmail = client?.email?.trim() || null

  // ── 4. メール設定確認 ─────────────────────────────────────────
  const emailConfig = getEmailConfig()

  // ── 5. 件名・本文生成 ─────────────────────────────────────────
  const content  = report.content as any
  const workDate = content?.job?.work_date
    ? new Date(content.job.work_date).toLocaleDateString('ja-JP')
    : '—'

  const { subject, bodyText } = buildReportEmail({
    clientName:  client?.name  ?? '顧客',
    companyName,
    projectName: project?.name ?? '—',
    workDate,
  })

  // ── 6. PDF確認 ────────────────────────────────────────────────
  const pdfAvailable = Boolean(report.pdf_url)
  const pdfFilename  = pdfAvailable
    ? `作業完了報告書_No${String(report.version).padStart(3, '0')}.pdf`
    : null

  // ── 7. 送信可否判定 ───────────────────────────────────────────
  let canSend = true
  let reason: string | null = null

  if (!project?.client_id) {
    canSend = false
    reason  = 'この案件には顧客が設定されていません。案件管理から顧客を設定してください。'
  } else if (!toEmail) {
    canSend = false
    reason  = '顧客のメールアドレスが設定されていません。顧客管理から設定してください。'
  } else if (!pdfAvailable) {
    canSend = false
    reason  = '報告書PDFがまだ生成されていません。先にPDFを生成してください。'
  } else if (!emailConfig.configured) {
    canSend = false
    reason  = 'メール送信設定が完了していません。管理者にお問い合わせください。'
  }

  // ── 8. 再送判定 ───────────────────────────────────────────────
  const isResend = await hasSentDocument(auth.adminClient, auth.companyId, { reportId: id })

  return NextResponse.json({
    configured:    emailConfig.configured,
    to_email:      toEmail,
    subject,
    body_text:     bodyText,
    pdf_available: pdfAvailable,
    pdf_filename:  pdfFilename,
    can_send:      canSend,
    reason,
    is_resend:     isResend,
  })
}

// ─────────────────────────────────────────────────────────────────
// POST /api/reports/[id]/email
// 作業完了報告書メール送信エンドポイント（骨格）。
//
// ※ 現フェーズでは実送信を行わない。
//    resend.emails.send() は呼ばない。
// ─────────────────────────────────────────────────────────────────
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 0. subject / body_text 受け取り・バリデーション ────────────
  let subject = ''
  let bodyText = ''
  try {
    const body = await req.json()
    subject  = typeof body.subject   === 'string' ? body.subject.trim()   : ''
    bodyText = typeof body.body_text === 'string' ? body.body_text.trim() : ''
  } catch {
    // body なし or JSON不正 → 後続validation で弾く
  }
  if (!subject)  return NextResponse.json({ error: '件名を入力してください' },  { status: 400 })
  if (!bodyText) return NextResponse.json({ error: '本文を入力してください' },  { status: 400 })

  // ── 1. report取得・ownership確認 ─────────────────────────────
  const { data: report } = await auth.adminClient
    .from('reports')
    .select(`
      id, pdf_url, version, project_id,
      projects:project_id (
        client_id,
        clients:client_id (email)
      )
    `)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()

  if (!report) return NextResponse.json({ error: '報告書が見つかりません' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rep     = report as any
  const project = rep.projects as any
  const client  = project?.clients as any

  // ── 2. PDF確認 ────────────────────────────────────────────────
  if (!rep.pdf_url) {
    return NextResponse.json(
      { error: '報告書PDFがまだ生成されていません。先にPDFを生成してください。' },
      { status: 400 }
    )
  }

  // ── 3. 送信先確認（サーバー側確定） ──────────────────────────
  const toEmail = client?.email?.trim() || null
  if (!toEmail) {
    return NextResponse.json(
      { error: '顧客のメールアドレスが設定されていません。顧客管理から設定してください。' },
      { status: 400 }
    )
  }

  // ── 4. メール設定確認 ─────────────────────────────────────────
  const emailConfig = getEmailConfig()
  if (!emailConfig.configured) {
    return NextResponse.json(
      { error: 'メール送信設定が完了していません。RESEND_API_KEY と EMAIL_FROM を設定してください。' },
      { status: 503 }
    )
  }

  // ── 4b. 会社設定取得（FROM表示名 / Reply-To）─────────────────
  const { data: company } = await auth.adminClient
    .from('companies')
    .select('name, email, mail_reply_to')
    .eq('id', auth.companyId)
    .single()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const co = company as any

  const fromName    = co?.name?.trim() || 'HIKARU'
  const fromAddress = extractEmailAddress(emailConfig.from!)
  const fromFull    = `${fromName} <${fromAddress}>`

  const rawReplyTo  = co?.mail_reply_to?.trim() || null
  const fallbackRTO = co?.email?.trim()          || null

  let replyTo: string | undefined
  if (rawReplyTo) {
    if (!isValidEmailAddress(rawReplyTo)) {
      return NextResponse.json(
        { error: 'メール設定の返信先アドレスが不正です。設定画面から確認してください。' },
        { status: 400 }
      )
    }
    replyTo = rawReplyTo
  } else if (fallbackRTO && isValidEmailAddress(fallbackRTO)) {
    replyTo = fallbackRTO
  }

  // ── 5. 送信先メールアドレス形式確認 ──────────────────────────
  if (!isValidEmailAddress(toEmail)) {
    return NextResponse.json(
      { error: '送信先メールアドレスの形式が正しくありません。顧客情報を確認してください。' },
      { status: 400 }
    )
  }

  // ── 6. 重複送信確認（sent済みなら409） ───────────────────────
  const alreadySent = await hasSentDocument(auth.adminClient, auth.companyId, { reportId: id })
  if (alreadySent) {
    return NextResponse.json(
      { error: '既にこの報告書は送信済みです。再送が必要な場合はサポートにお問い合わせください。' },
      { status: 409 }
    )
  }

  // ── 7. PDFをStorageから取得 ───────────────────────────────────
  const { data: pdfBlob, error: pdfErr } = await auth.adminClient
    .storage
    .from('documents')
    .download(rep.pdf_url)

  if (pdfErr || !pdfBlob) {
    return NextResponse.json(
      { error: 'PDFの取得に失敗しました。先にPDFを生成し直してください。' },
      { status: 409 }
    )
  }

  const pdfBuffer   = Buffer.from(await pdfBlob.arrayBuffer())
  const pdfFilename = `作業完了報告書_No${String(rep.version).padStart(3, '0')}.pdf`

  // ── 8. pending log作成（DBレベル Race condition 防止） ─────────
  let pendingLog: EmailLog
  try {
    pendingLog = await createPendingLog(auth.adminClient, auth.companyId, {
      reportId:        id,
      projectId:       rep.project_id,
      clientId:        project?.client_id,
      toEmail,
      subject,
      bodyText,
      attachedPdfPath: rep.pdf_url,
      sentBy:          auth.userId,
      isResend:        false,
      fromEmail:       fromAddress,
      fromName,
      replyTo,
    })
  } catch {
    return NextResponse.json(
      { error: '送信処理中または送信済みです。しばらく待ってから再度お試しください。' },
      { status: 409 }
    )
  }

  // ── 9. Resend送信 ────────────────────────────────────────────
  try {
    const { messageId } = await sendEmail({
      from:    fromFull,
      to:      toEmail,
      subject,
      text:    bodyText,
      replyTo,
      attachments: [{ filename: pdfFilename, content: pdfBuffer }],
    })
    await markSent(auth.adminClient, pendingLog.id, auth.companyId, messageId)
    return NextResponse.json({ success: true, message: '報告書を送信しました。' })
  } catch (err) {
    const raw     = err instanceof Error ? err.message : '不明なエラー'
    const safeMsg = raw === 'EMAIL_PROVIDER_NOT_CONFIGURED'
      ? 'メール送信設定が完了していません。'
      : 'メール送信に失敗しました。時間をおいて再度お試しください。'
    await markFailed(auth.adminClient, pendingLog.id, auth.companyId, safeMsg).catch(() => {})
    return NextResponse.json({ error: safeMsg }, { status: 502 })
  }
}
