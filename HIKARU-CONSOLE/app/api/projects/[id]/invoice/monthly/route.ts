import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { calcInvoice, buildItemsFromProjectPrice } from '@/lib/billing/calculator'
import { calcDueDate } from '@/lib/billing/due-date'
import { getJstDateString, getJstYear, getMonthLastDay } from '@/lib/billing/date-utils'

// POST /api/projects/[id]/invoice/monthly
// 定期案件（recurring）の月次請求書 draft を生成する。
//
// IDOR対策:
//   - projects.company_id = auth.companyId をサーバー側で確認
//   - client_id / project_prices / jobs はすべてDBから取得（ブラウザ値不使用）
//
// 同月重複防止:
//   - 同一 project_id × period_month で non-cancelled invoice が存在する場合は既存を返す
//
// 二重請求防止:
//   - completed jobs のうち invoice_job_links に未存在のものだけを対象
//   - invoice_job_links UNIQUE(job_id) が最終防御
//
// 入力（Body）:
//   { period_month: '2026-08' }  ← YYYY-MM 形式のみ受け付ける
//
// レスポンス:
//   201: { existing: false, invoice: {...} }  新規作成
//   200: { existing: true,  invoice: {...}, message }  既存 draft/issued 誘導
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    // ── 0. 入力検証（YYYY-MM 形式） ────────────────────────────────────
    const body = await req.json()
    const periodStr: string = body?.period_month ?? ''
    const match = periodStr.match(/^(\d{4})-(\d{2})$/)
    if (!match) {
      return NextResponse.json({
        error: '対象月は YYYY-MM 形式で指定してください（例: 2026-08）',
      }, { status: 400 })
    }
    const targetYear  = parseInt(match[1], 10)
    const targetMonth = parseInt(match[2], 10)  // 1-12
    if (targetMonth < 1 || targetMonth > 12) {
      return NextResponse.json({ error: '月は 01〜12 で指定してください' }, { status: 400 })
    }

    // billing_period_from/to を計算
    const billingFrom = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
    const billingTo   = getMonthLastDay(targetYear, targetMonth)

    // ── 1. project取得・company_id確認（IDOR対策） ──────────────────
    const { data: project } = await auth.adminClient
      .from('projects')
      .select('id, name, project_type, client_id, company_id')
      .eq('id', projectId)
      .eq('company_id', auth.companyId)
      .single()

    if (!project) {
      return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
    }

    // ── 2. recurring案件のみ（このAPIはrecurring専用） ───────────────
    if (project.project_type !== 'recurring') {
      return NextResponse.json({
        error: 'このAPIは定期案件専用です。単発案件は /api/projects/[id]/invoice を使用してください。',
      }, { status: 400 })
    }

    // ── 3. 顧客確認 ──────────────────────────────────────────────────
    if (!project.client_id) {
      return NextResponse.json({
        error: 'この案件には顧客が設定されていません。顧客を設定してから請求書を作成してください。',
      }, { status: 400 })
    }

    // ── 3b. 顧客の支払条件取得（due_date 計算用、company_id でIDOR対策） ──
    // 取得失敗・NULL の場合は calcDueDate の fallback（issue_date + 30日）が機能するため
    // エラーは返さず請求生成を続行する。
    const { data: client } = await auth.adminClient
      .from('clients')
      .select('closing_day, payment_month_offset, payment_day')
      .eq('id', project.client_id)
      .eq('company_id', auth.companyId)
      .single()

    // ── 4. 同月 non-cancelled invoice 存在チェック（重複防止） ─────────
    const { data: existingInvoices } = await auth.adminClient
      .from('invoices')
      .select('id, invoice_number, status, created_at')
      .eq('project_id', projectId)
      .eq('company_id', auth.companyId)
      .eq('invoice_type', 'invoice')
      .eq('period_month', targetMonth)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingInvoices && existingInvoices.length > 0) {
      const inv = existingInvoices[0]
      const yearStr = String(targetYear)
      return NextResponse.json({
        existing: true,
        invoice:  inv,
        message:  `${yearStr}年${targetMonth}月分の請求書（${inv.invoice_number}）がすでに存在します`,
      }, { status: 200 })
    }

    // ── 5. 対象月の料金取得（period_month完全一致を優先） ─────────────
    const { data: monthlyPrice } = await auth.adminClient
      .from('project_prices')
      .select('id, amount_ex_tax, tax_rate, tax_amount, amount_inc_tax, unit_price, quantity, period_month')
      .eq('project_id', projectId)
      .eq('period_month', targetMonth)
      .limit(1)

    // fallback: period_month IS NULL（標準料金）
    const { data: standardPrice } = !monthlyPrice?.length
      ? await auth.adminClient
          .from('project_prices')
          .select('id, amount_ex_tax, tax_rate, tax_amount, amount_inc_tax, unit_price, quantity, period_month')
          .eq('project_id', projectId)
          .is('period_month', null)
          .limit(1)
      : { data: null }

    const price = monthlyPrice?.[0] ?? standardPrice?.[0] ?? null
    if (!price) {
      return NextResponse.json({
        error: `${targetYear}年${targetMonth}月の料金情報が登録されていないため請求書を作成できません。料金情報を設定してから再度お試しください。`,
      }, { status: 400 })
    }

    // ── 6. 対象月のcompleted jobs取得 ─────────────────────────────────
    const { data: completedJobs } = await auth.adminClient
      .from('jobs')
      .select('id, work_date, status')
      .eq('project_id', projectId)
      .eq('company_id', auth.companyId)
      .eq('status', 'completed')
      .gte('work_date', billingFrom)
      .lte('work_date', billingTo)
      .order('work_date', { ascending: true })

    // jobが0件でも月額固定なら請求書生成可能。ただし0件は警告としない（月額契約のため）

    // ── 7. 未請求job分類 ─────────────────────────────────────────────
    const allJobIds = (completedJobs ?? []).map((j) => j.id)
    let unbilledJobs: typeof completedJobs = completedJobs ?? []

    if (allJobIds.length > 0) {
      const { data: existingLinks } = await auth.adminClient
        .from('invoice_job_links')
        .select('job_id')
        .in('job_id', allJobIds)

      const billedJobIds = new Set((existingLinks ?? []).map((l) => l.job_id as string))
      unbilledJobs = (completedJobs ?? []).filter((j) => !billedJobIds.has(j.id))
    }

    // ── 8. 請求書番号発行 ─────────────────────────────────────────────
    const issueDate = getJstDateString()
    const year      = getJstYear()

    const { data: numData } = await auth.adminClient.rpc('next_invoice_number', {
      p_company_id:   auth.companyId,
      p_invoice_type: 'invoice',
      p_year:         year,
    })

    if (!numData) {
      return NextResponse.json({ error: '請求書番号の発行に失敗しました' }, { status: 500 })
    }

    // ── 9. 明細・金額計算（月額固定） ────────────────────────────────
    const periodLabel = `${targetYear}年${targetMonth}月分`
    const lineItems   = buildItemsFromProjectPrice(price, 'recurring', periodLabel, project.name)
    const calc        = calcInvoice(lineItems, Number(price.tax_rate) || 0.10, 'floor')

    type ItemRow = {
      order_num: number; description: string; quantity: number
      unit: string | null; unit_price: number; amount: number
      tax_rate: number; source_type: string | null; source_id: string | null
    }
    const lineItemRows: ItemRow[] = calc.items.map((item, i) => ({
      order_num:   item.order_num  ?? i,
      description: item.description,
      quantity:    item.quantity,
      unit:        item.unit       ?? null,
      unit_price:  item.unit_price,
      amount:      item.amount,
      tax_rate:    item.tax_rate   ?? calc.tax_rate,
      source_type: item.source_type ?? 'project_price',
      source_id:   item.source_id  ?? price.id,
    }))

    // ── 10. invoice INSERT ────────────────────────────────────────────
    const { data: invoice, error: invErr } = await auth.adminClient
      .from('invoices')
      .insert({
        company_id:         auth.companyId,
        client_id:          project.client_id,
        project_id:         projectId,
        invoice_type:       'invoice',
        invoice_number:     numData,
        issue_date:         issueDate,
        due_date:           calcDueDate({
          issueDate,
          billingPeriodTo:    billingTo,
          closingDay:         client?.closing_day           ?? null,
          paymentMonthOffset: client?.payment_month_offset  ?? null,
          paymentDay:         client?.payment_day           ?? null,
        }),
        period_month:       targetMonth,
        billing_period_from: billingFrom,
        billing_period_to:   billingTo,
        subtotal:           calc.subtotal,
        tax_rate:           calc.tax_rate,
        tax_amount:         calc.tax_amount,
        total_amount:       calc.total_amount,
        rounding_method:    'floor',
        title:              `定期清掃 ${targetYear}年${targetMonth}月分 請求書`,
        status:             'draft',
        created_by:         auth.userId,
      })
      .select()
      .single()

    if (invErr || !invoice) {
      return NextResponse.json({
        error: invErr?.message ?? '請求書の作成に失敗しました',
      }, { status: 500 })
    }

    // ── 11. invoice_items INSERT ──────────────────────────────────────
    if (lineItemRows.length > 0) {
      const { error: itemErr } = await auth.adminClient
        .from('invoice_items')
        .insert(lineItemRows.map((item) => ({ invoice_id: invoice.id, ...item })))

      if (itemErr) {
        await auth.adminClient.from('invoices').delete().eq('id', invoice.id)
        return NextResponse.json({
          error: `明細の保存に失敗しました: ${itemErr.message}`,
        }, { status: 500 })
      }
    }

    // ── 12. invoice_job_links INSERT（未請求jobのみ） ─────────────────
    if (unbilledJobs.length > 0) {
      const linkRows = unbilledJobs.map((job) => ({
        invoice_id: invoice.id,
        job_id:     job.id,
        company_id: auth.companyId,
      }))

      const { error: linkErr } = await auth.adminClient
        .from('invoice_job_links')
        .insert(linkRows)

      if (linkErr) {
        await auth.adminClient.from('invoice_items').delete().eq('invoice_id', invoice.id)
        await auth.adminClient.from('invoices').delete().eq('id', invoice.id)

        if (linkErr.code === '23505') {
          return NextResponse.json({
            error: 'この月の一部の作業はすでに別の請求書に含まれています。ページを再読み込みして再度お試しください。',
            code:  'JOB_ALREADY_BILLED',
          }, { status: 409 })
        }

        return NextResponse.json({
          error: `作業の紐付けに失敗しました: ${linkErr.message}`,
        }, { status: 500 })
      }
    }

    return NextResponse.json({ existing: false, invoice }, { status: 201 })

  } catch (e) {
    console.error('[api/projects/[id]/invoice/monthly] unexpected error:', e)
    return NextResponse.json({
      error: '請求書の生成に失敗しました。しばらく時間をおいて再度お試しください。',
    }, { status: 500 })
  }
}


