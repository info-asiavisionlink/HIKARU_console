import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { calcInvoice, buildItemsFromProjectPrice } from '@/lib/billing/calculator'
import { calcDueDate } from '@/lib/billing/due-date'
import { getJstDateString, getJstYear, getMonthLastDay } from '@/lib/billing/date-utils'

// POST /api/projects/[id]/invoice/hotel-monthly
// 日常案件（project_type='hotel'）の月次請求書 draft を生成する。
//
// IDOR対策:
//   - projects.company_id = auth.companyId をサーバー側で確認
//   - projects.project_type = 'hotel' をサーバー側で確認
//   - client_id / project_prices / jobs はすべてDBから取得（ブラウザ値不使用）
//
// 同月重複防止:
//   - billing_period_from = 対象月1日 の non-cancelled invoice が存在する場合は既存を返す
//   - 日常案件は period_month IS NULL のため billing_period_from で月を識別する
//
// jobs=0確認フロー:
//   - 初回: completed jobs=0 の場合 { requires_confirmation: true } を返す
//   - 管理者が確認後: body に confirm_no_jobs=true を付けて再送
//   - サーバー側で jobs=0 + confirm_no_jobs=true の両方を確認
//
// 二重請求防止:
//   - invoice_job_links UNIQUE(job_id) が最終防御
//
// 入力（Body）:
//   { period_month: '2026-08', confirm_no_jobs?: true }
//
// レスポンス:
//   201: { existing: false, invoice: {...} }                 新規作成
//   200: { existing: true,  invoice: {...}, message }        既存誘導
//   200: { requires_confirmation: true, reason, message }    jobs=0確認要求
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
    const periodStr: string    = body?.period_month  ?? ''
    const confirmNoJobs: boolean = !!body?.confirm_no_jobs

    const match = periodStr.match(/^(\d{4})-(\d{2})$/)
    if (!match) {
      return NextResponse.json({
        error: '対象月は YYYY-MM 形式で指定してください（例: 2026-08）',
      }, { status: 400 })
    }
    const targetYear  = parseInt(match[1], 10)
    const targetMonth = parseInt(match[2], 10)
    if (targetMonth < 1 || targetMonth > 12) {
      return NextResponse.json({ error: '月は 01〜12 で指定してください' }, { status: 400 })
    }

    const billingFrom = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`
    const billingTo   = getMonthLastDay(targetYear, targetMonth)

    // ── 1. project取得・company_id / project_type 確認（IDOR対策） ─────
    const { data: project } = await auth.adminClient
      .from('projects')
      .select('id, name, project_type, client_id, company_id')
      .eq('id', projectId)
      .eq('company_id', auth.companyId)
      .single()

    if (!project) {
      return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
    }

    // 日常案件（project_type='hotel'）専用チェック
    if (project.project_type !== 'hotel') {
      return NextResponse.json({
        error: 'このAPIは日常案件専用です。',
      }, { status: 400 })
    }

    // ── 2. 顧客確認 ──────────────────────────────────────────────────
    if (!project.client_id) {
      return NextResponse.json({
        error: 'この案件には顧客が設定されていません。顧客を設定してから請求書を作成してください。',
      }, { status: 400 })
    }

    // ── 2b. 顧客の支払条件取得（due_date 計算用、company_id でIDOR対策） ──
    // 取得失敗・NULL の場合は calcDueDate の fallback（issue_date + 30日）が機能するため
    // エラーは返さず請求生成を続行する。
    const { data: client } = await auth.adminClient
      .from('clients')
      .select('closing_day, payment_month_offset, payment_day')
      .eq('id', project.client_id)
      .eq('company_id', auth.companyId)
      .single()

    // ── 3. 同月 non-cancelled invoice 存在チェック ─────────────────────
    // 日常案件は period_month=NULL なので billing_period_from で月を識別
    const { data: existingInvoices } = await auth.adminClient
      .from('invoices')
      .select('id, invoice_number, status, created_at')
      .eq('project_id', projectId)
      .eq('company_id', auth.companyId)
      .eq('invoice_type', 'invoice')
      .eq('billing_period_from', billingFrom)
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false })
      .limit(1)

    if (existingInvoices && existingInvoices.length > 0) {
      const inv = existingInvoices[0]
      return NextResponse.json({
        existing: true,
        invoice:  inv,
        message:  `${targetYear}年${targetMonth}月分の月次請求書（${inv.invoice_number}）がすでに存在します`,
      }, { status: 200 })
    }

    // ── 4. 対象月の completed jobs 取得 ───────────────────────────────
    const { data: completedJobs } = await auth.adminClient
      .from('jobs')
      .select('id, work_date, status')
      .eq('project_id', projectId)
      .eq('company_id', auth.companyId)
      .eq('status', 'completed')
      .gte('work_date', billingFrom)
      .lte('work_date', billingTo)
      .order('work_date', { ascending: true })

    const hasJobs = (completedJobs ?? []).length > 0

    // ── 5. jobs=0 の確認フロー ────────────────────────────────────────
    // 初回呼び出し（confirmNoJobs=false）かつ jobs=0 → 確認要求
    if (!hasJobs && !confirmNoJobs) {
      return NextResponse.json({
        requires_confirmation: true,
        reason:  'no_completed_jobs',
        message: `${targetYear}年${targetMonth}月に完了済みの作業記録がありません。契約料金で月次請求書を生成しますか？`,
      }, { status: 200 })
    }
    // サーバー側二重確認: confirm_no_jobs=true が送られたが実際はjobsあり → そのまま続行

    // ── 6. 未請求 job 分類 ────────────────────────────────────────────
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

    // ── 7. 契約料金取得（period_month IS NULL = 日常案件の標準料金） ──
    const { data: prices } = await auth.adminClient
      .from('project_prices')
      .select('id, amount_ex_tax, tax_rate, tax_amount, amount_inc_tax, unit_price, quantity, period_month, unit_label')
      .eq('project_id', projectId)
      .is('period_month', null)
      .limit(1)

    const price = prices?.[0] ?? null
    if (!price) {
      return NextResponse.json({
        error: 'この案件には料金情報が登録されていないため請求書を作成できません。料金情報を設定してから再度お試しください。',
      }, { status: 400 })
    }

    // unit_price / quantity が未設定の場合は amount_ex_tax にフォールバック
    if (!price.unit_price || !price.quantity) {
      if (!price.amount_ex_tax || Number(price.amount_ex_tax) === 0) {
        return NextResponse.json({
          error: '料金情報（単価・数量または税抜金額）が設定されていません。料金情報を設定してから再度お試しください。',
        }, { status: 400 })
      }
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

    // ── 9. 明細・金額計算（既存calculator再利用） ────────────────────
    const periodLabel = `${targetYear}年${targetMonth}月分`
    // buildItemsFromProjectPrice の 'hotel' ブランチ:
    //   unit_price × quantity の明細を生成（量 × 単価）
    const lineItems = buildItemsFromProjectPrice(price, 'hotel', periodLabel, project.name)
    const calc      = calcInvoice(lineItems, Number(price.tax_rate) || 0.10, 'floor')

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
        company_id:          auth.companyId,
        client_id:           project.client_id,
        project_id:          projectId,
        invoice_type:        'invoice',
        invoice_number:      numData,
        issue_date:          issueDate,
        due_date:            calcDueDate({
          issueDate,
          billingPeriodTo:    billingTo,
          closingDay:         client?.closing_day           ?? null,
          paymentMonthOffset: client?.payment_month_offset  ?? null,
          paymentDay:         client?.payment_day           ?? null,
        }),
        period_month:        null,   // 日常案件は period_month=NULL（project_prices が月別でないため）
        billing_period_from: billingFrom,
        billing_period_to:   billingTo,
        subtotal:            calc.subtotal,
        tax_rate:            calc.tax_rate,
        tax_amount:          calc.tax_amount,
        total_amount:        calc.total_amount,
        rounding_method:     'floor',
        title:               `日常清掃 ${targetYear}年${targetMonth}月分 請求書`,
        status:              'draft',
        created_by:          auth.userId,
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
        // 補償: invoice を削除
        await auth.adminClient.from('invoices').delete().eq('id', invoice.id)
        return NextResponse.json({
          error: `明細の保存に失敗しました: ${itemErr.message}`,
        }, { status: 500 })
      }
    }

    // ── 12. invoice_job_links INSERT（未請求 completed jobs のみ） ─────
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
        // 補償: invoice_items + invoice を削除
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
    console.error('[api/projects/[id]/invoice/hotel-monthly] unexpected error:', e)
    return NextResponse.json({
      error: '請求書の生成に失敗しました。しばらく時間をおいて再度お試しください。',
    }, { status: 500 })
  }
}


