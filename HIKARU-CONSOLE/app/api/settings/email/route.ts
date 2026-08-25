import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { isValidEmailAddress } from '@/lib/email/log'

// ─────────────────────────────────────────────────────────────────
// GET /api/settings/email
// メール設定取得。返却値は mail_reply_to / invoice_auto_send / report_auto_send のみ。
// ─────────────────────────────────────────────────────────────────
export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { data } = await auth.adminClient
    .from('companies')
    .select('mail_reply_to, invoice_auto_send, report_auto_send')
    .eq('id', auth.companyId)
    .single()

  if (!data) return NextResponse.json({ error: '設定が見つかりません' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any
  return NextResponse.json({
    mail_reply_to:     d.mail_reply_to     ?? null,
    invoice_auto_send: d.invoice_auto_send ?? false,
    report_auto_send:  d.report_auto_send  ?? false,
  })
}

// ─────────────────────────────────────────────────────────────────
// PATCH /api/settings/email
// メール設定保存。allowlist: mail_reply_to / invoice_auto_send / report_auto_send のみ。
// auth.companyId で更新対象を固定し、cross-company 更新を防止する。
// ─────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { mail_reply_to, invoice_auto_send, report_auto_send } = body

  // ── mail_reply_to バリデーション ──────────────────────────────
  const replyTo = typeof mail_reply_to === 'string'
    ? mail_reply_to.trim() || null
    : null

  if (replyTo !== null && !isValidEmailAddress(replyTo)) {
    return NextResponse.json(
      { error: '返信先メールアドレスの形式が正しくありません' },
      { status: 400 }
    )
  }

  // ── invoice_auto_send バリデーション ──────────────────────────
  if (invoice_auto_send !== undefined && typeof invoice_auto_send !== 'boolean') {
    return NextResponse.json(
      { error: 'invoice_auto_send は true/false で指定してください' },
      { status: 400 }
    )
  }

  // ── report_auto_send バリデーション ───────────────────────────
  if (report_auto_send !== undefined && typeof report_auto_send !== 'boolean') {
    return NextResponse.json(
      { error: 'report_auto_send は true/false で指定してください' },
      { status: 400 }
    )
  }

  // ── DB更新（allowlist: 3列のみ）────────────────────────────────
  const updates: Record<string, unknown> = { mail_reply_to: replyTo }
  if (typeof invoice_auto_send === 'boolean') updates.invoice_auto_send = invoice_auto_send
  if (typeof report_auto_send  === 'boolean') updates.report_auto_send  = report_auto_send

  const { data, error } = await auth.adminClient
    .from('companies')
    .update(updates as never)
    .eq('id', auth.companyId)
    .select('mail_reply_to, invoice_auto_send, report_auto_send')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any
  return NextResponse.json({
    mail_reply_to:     d.mail_reply_to     ?? null,
    invoice_auto_send: d.invoice_auto_send ?? false,
    report_auto_send:  d.report_auto_send  ?? false,
  })
}
