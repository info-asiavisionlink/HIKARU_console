import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { calcInvoice, buildItemsFromProjectPrice } from '@/lib/billing/calculator'
import { getJstDateString, getJstYear, getJstMonth } from '@/lib/billing/date-utils'

// POST /api/projects/[id]/quote
// 案件詳細画面から見積書 draft を自動生成する。
// project_id はURLパスから取得し、client_id / company_id / 金額は
// すべてサーバー側DB から取得（ブラウザからの送信値を信用しない）。
//
// IDOR対策:
//   - projects.company_id = 認証管理者の companyId を必須確認
//   - client_id / project_prices は projects.id からサーバー側で取得
//
// レスポンス:
//   { existing: true,  quote: { id, invoice_number, ... } }  既存draft
//   { existing: false, quote: { id, invoice_number, ... } }  新規作成
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // ── 1. project取得・company_id確認（IDOR対策） ──────────────────
    const { data: project, error: projErr } = await auth.adminClient
      .from('projects')
      .select('id, name, project_type, client_id, company_id')
      .eq('id', projectId)
      .eq('company_id', auth.companyId)
      .single()

    if (projErr || !project) {
      return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
    }

    // ── 2. 顧客確認（client_id が未設定の案件は見積書作成不可） ──
    if (!project.client_id) {
      return NextResponse.json({
        error: 'この案件には顧客が設定されていません。顧客を設定してから見積書を作成してください。',
      }, { status: 400 })
    }

    // ── 3. 既存draft見積確認（同一案件のdraftが既にある場合は返す） ──
    const { data: existingDrafts } = await auth.adminClient
      .from('invoices')
      .select('id, invoice_number, status, title, created_at')
      .eq('project_id', projectId)
      .eq('company_id', auth.companyId)
      .eq('invoice_type', 'quote')
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingDrafts && existingDrafts.length > 0) {
      return NextResponse.json({
        existing: true,
        quote:    existingDrafts[0],
        message:  'この案件には作成途中の見積書があります',
      })
    }

    // ── 4. project_prices取得（サーバー側で取得・ブラウザ値不使用） ──
    const { data: prices } = await auth.adminClient
      .from('project_prices')
      .select('id, project_id, period_month, amount_ex_tax, tax_rate, unit_price, quantity')
      .eq('project_id', projectId)
      .order('period_month', { ascending: true, nullsFirst: true })

    if (!prices || prices.length === 0) {
      return NextResponse.json({
        error: 'この案件には料金情報が登録されていないため、見積書を作成できません。先に案件の料金情報を設定してください。',
      }, { status: 400 })
    }

    // ── 5. 使用する単価レコードを選択 ───────────────────────────────
    // spot / hotel : period_month IS NULL の 1件を使用
    // recurring    : 当月分があれば優先、なければ最初のレコードを使用
    const projectType = project.project_type as 'spot' | 'recurring' | 'hotel'
    const issueDate    = getJstDateString()
    const year         = getJstYear()
    const currentMonth = getJstMonth()

    let selectedPrice   = prices[0]
    let periodMonth: number | null = null
    let periodLabel     = ''

    if (projectType === 'recurring') {
      const monthPrice  = prices.find(p => p.period_month === currentMonth)
      selectedPrice     = monthPrice ?? prices[0]
      periodMonth       = selectedPrice.period_month ?? currentMonth
      periodLabel       = `${year}年${periodMonth}月分`
    }

    // ── 6. 明細自動生成（既存 buildItemsFromProjectPrice を再利用） ──
    const lineItems = buildItemsFromProjectPrice(
      selectedPrice,
      projectType,
      periodLabel,
      project.name,
    )

    // ── 7. 金額計算（サーバー側 calcInvoice・ブラウザ値不使用） ─────
    const taxRate = Number(selectedPrice.tax_rate) || 0.10
    const calc    = calcInvoice(lineItems, taxRate, 'floor')

    // ── 8. 見積書番号発行（DB関数で重複防止） ────────────────────────
    const { data: numData } = await auth.adminClient
      .rpc('next_invoice_number', {
        p_company_id:   auth.companyId,
        p_invoice_type: 'quote',
        p_year:         year,
      })

    if (!numData) {
      return NextResponse.json({ error: '見積書番号の発行に失敗しました' }, { status: 500 })
    }

    // ── 9. タイトル自動生成 ──────────────────────────────────────────
    const title = projectType === 'recurring'
      ? `清掃サービス ${periodLabel}`
      : `清掃サービス見積書`

    // ── 10. invoices INSERT ──────────────────────────────────────────
    const { data: invoice, error: invErr } = await auth.adminClient
      .from('invoices')
      .insert({
        company_id:      auth.companyId,
        client_id:       project.client_id,    // DBから取得（ブラウザ値不使用）
        project_id:      projectId,
        invoice_type:    'quote',
        invoice_number:  numData,
        issue_date:      issueDate,
        period_month:    periodMonth,
        subtotal:        calc.subtotal,
        tax_rate:        calc.tax_rate,
        tax_amount:      calc.tax_amount,
        total_amount:    calc.total_amount,
        rounding_method: 'floor',
        title,
        status:          'draft',
        created_by:      auth.userId,
      })
      .select()
      .single()

    if (invErr || !invoice) {
      return NextResponse.json({ error: invErr?.message ?? '見積書の作成に失敗しました' }, { status: 500 })
    }

    // ── 11. invoice_items INSERT ─────────────────────────────────────
    if (calc.items.length > 0) {
      const itemRows = calc.items.map((item, i) => ({
        invoice_id:  invoice.id,
        order_num:   item.order_num ?? i,
        description: item.description,
        quantity:    item.quantity,
        unit:        item.unit || null,
        unit_price:  item.unit_price,
        amount:      item.amount,
        tax_rate:    item.tax_rate ?? taxRate,
        source_type: item.source_type || 'project_price',
        source_id:   item.source_id   || null,
      }))

      const { error: itemErr } = await auth.adminClient
        .from('invoice_items').insert(itemRows)

      if (itemErr) {
        // 明細INSERT失敗 → invoiceをベストエフォートで削除してrollback
        await auth.adminClient.from('invoices').delete().eq('id', invoice.id)
        return NextResponse.json({ error: `明細の保存に失敗しました: ${itemErr.message}` }, { status: 500 })
      }
    }

    return NextResponse.json({ existing: false, quote: invoice }, { status: 201 })

  } catch (e) {
    console.error('[api/projects/[id]/quote] unexpected error:', e)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
