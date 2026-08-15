import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { calcInvoice, buildItemsFromProjectPrice } from '@/lib/billing/calculator'
import { calcDueDate } from '@/lib/billing/due-date'

// POST /api/projects/[id]/invoice
// 単発案件（spot）の完了済み作業実績から請求書 draft を自動生成する。
//
// IDOR対策:
//   - projects.company_id = auth.companyId をサーバー側で必須確認
//   - client_id / project_prices / jobs はすべてDBから取得（ブラウザ値不使用）
//
// 二重請求防止:
//   - completed jobs のうち invoice_job_links に未存在のものだけを対象とする
//   - invoice_job_links UNIQUE(job_id) が最終防御
//
// レスポンス:
//   201: { existing: false, invoice: {...} }  新規作成
//   200: { existing: true,  invoice: {...}, message }  既存draft
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
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

    // ── 2. spot案件のみ（このAPIはspot専用） ─────────────────────────
    if (project.project_type !== 'spot') {
      return NextResponse.json({
        error: 'このAPIは単発案件専用です',
      }, { status: 400 })
    }

    // ── 3. 顧客確認（client_idはDBから取得・ブラウザ値不使用） ────────
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

    // ── 4. 完了済みjobを取得（company_id + project_id + status='completed'） ──
    const { data: completedJobs } = await auth.adminClient
      .from('jobs')
      .select('id, work_date, started_at, completed_at')
      .eq('project_id', projectId)
      .eq('company_id', auth.companyId)
      .eq('status', 'completed')
      .order('work_date', { ascending: true })

    if (!completedJobs || completedJobs.length === 0) {
      return NextResponse.json({
        error: '完了済みの作業がありません。Worker が作業を完了してから請求書を作成してください。',
      }, { status: 400 })
    }

    // ── 5. 既請求job / 未請求jobを分類 ──────────────────────────────
    const allJobIds = completedJobs.map((j) => j.id)
    const { data: existingLinks } = await auth.adminClient
      .from('invoice_job_links')
      .select('job_id, invoice_id')
      .in('job_id', allJobIds)

    const billedJobIds  = new Set((existingLinks ?? []).map((l) => l.job_id as string))
    const unbilledJobs  = completedJobs.filter((j) => !billedJobIds.has(j.id))

    // ── 6. 既存draft invoice検出 ──────────────────────────────────────
    // 既請求jobが紐付いているinvoiceがこのprojectのdraftなら既存と判定
    if (billedJobIds.size > 0) {
      const billedInvoiceIds = [...new Set((existingLinks ?? []).map((l) => l.invoice_id as string))]
      const { data: draftInvoices } = await auth.adminClient
        .from('invoices')
        .select('id, invoice_number, status, created_at')
        .in('id', billedInvoiceIds)
        .eq('project_id', projectId)
        .eq('company_id', auth.companyId)
        .eq('invoice_type', 'invoice')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(1)

      if (draftInvoices && draftInvoices.length > 0) {
        return NextResponse.json({
          existing: true,
          invoice:  draftInvoices[0],
          message:  'この案件には作成途中の請求書があります',
        })
      }
    }

    // ── 7. 未請求jobが0件なら終了 ─────────────────────────────────────
    if (unbilledJobs.length === 0) {
      return NextResponse.json({
        error: '請求可能な未請求の完了作業がありません。すべての完了作業はすでに別の請求書に含まれています。',
      }, { status: 400 })
    }

    // ── 8. 正式見積を確認（accepted > issued の優先順位） ───────────
    const { data: quotes } = await auth.adminClient
      .from('invoices')
      .select(`
        id, status, subtotal, tax_rate, tax_amount, total_amount,
        rounding_method, billing_period_from, billing_period_to, period_month,
        invoice_items ( order_num, description, quantity, unit, unit_price, amount, tax_rate, source_type, source_id )
      `)
      .eq('project_id', projectId)
      .eq('company_id', auth.companyId)
      .eq('invoice_type', 'quote')
      .in('status', ['accepted', 'issued'])
      .order('created_at', { ascending: false })

    const bestQuote =
      (quotes ?? []).find((q) => q.status === 'accepted') ??
      (quotes ?? []).find((q) => q.status === 'issued')   ??
      null

    // ── 9. 請求書番号発行 ────────────────────────────────────────────
    const now       = new Date()
    const year      = now.getFullYear()
    const issueDate = now.toISOString().split('T')[0]

    const { data: numData } = await auth.adminClient
      .rpc('next_invoice_number', {
        p_company_id:   auth.companyId,
        p_invoice_type: 'invoice',
        p_year:         year,
      })

    if (!numData) {
      return NextResponse.json({ error: '請求書番号の発行に失敗しました' }, { status: 500 })
    }

    // ── 10. 明細・金額の決定 ─────────────────────────────────────────
    type ItemRow = {
      order_num: number; description: string; quantity: number
      unit: string | null; unit_price: number; amount: number
      tax_rate: number; source_type: string | null; source_id: string | null
    }

    let subtotal: number, taxRate: number, taxAmount: number, totalAmount: number
    let lineItemRows: ItemRow[]
    let convertedFromId: string | null = null

    if (bestQuote) {
      // 見積書Snapshotから金額を引き継ぐ（project_pricesの変動影響を受けない）
      subtotal        = Number(bestQuote.subtotal)
      taxRate         = Number(bestQuote.tax_rate)
      taxAmount       = Number(bestQuote.tax_amount)
      totalAmount     = Number(bestQuote.total_amount)
      convertedFromId = bestQuote.id
      lineItemRows    = (bestQuote.invoice_items as any[] ?? []).map((item: any, i: number) => ({
        order_num:   item.order_num ?? i,
        description: item.description,
        quantity:    Number(item.quantity),
        unit:        item.unit  ?? null,
        unit_price:  Number(item.unit_price),
        amount:      Number(item.amount),
        tax_rate:    Number(item.tax_rate),
        source_type: item.source_type ?? null,
        source_id:   item.source_id   ?? null,
      }))
    } else {
      // 見積なし: project_pricesから計算（spot は period_month IS NULL を使用）
      const { data: prices } = await auth.adminClient
        .from('project_prices')
        .select('id, amount_ex_tax, tax_rate, unit_price, quantity, period_month')
        .eq('project_id', projectId)
        .is('period_month', null)
        .limit(1)

      if (!prices || prices.length === 0) {
        // period_month IS NULL がなければ最初のレコードを使う
        const { data: anyPrices } = await auth.adminClient
          .from('project_prices')
          .select('id, amount_ex_tax, tax_rate, unit_price, quantity, period_month')
          .eq('project_id', projectId)
          .limit(1)

        if (!anyPrices || anyPrices.length === 0) {
          return NextResponse.json({
            error: 'この案件には料金情報が登録されていないため、請求書を作成できません。料金情報を設定してから再度お試しください。',
          }, { status: 400 })
        }

        const price    = anyPrices[0]
        const items    = buildItemsFromProjectPrice(price, 'spot', '', project.name)
        const calc     = calcInvoice(items, Number(price.tax_rate) || 0.10, 'floor')
        subtotal       = calc.subtotal
        taxRate        = calc.tax_rate
        taxAmount      = calc.tax_amount
        totalAmount    = calc.total_amount
        lineItemRows   = calc.items.map((item, i) => ({
          order_num:   item.order_num ?? i,
          description: item.description,
          quantity:    item.quantity,
          unit:        item.unit  || null,
          unit_price:  item.unit_price,
          amount:      item.amount,
          tax_rate:    item.tax_rate ?? calc.tax_rate,
          source_type: item.source_type || 'project_price',
          source_id:   item.source_id   || null,
        }))
      } else {
        const price    = prices[0]
        const items    = buildItemsFromProjectPrice(price, 'spot', '', project.name)
        const calc     = calcInvoice(items, Number(price.tax_rate) || 0.10, 'floor')
        subtotal       = calc.subtotal
        taxRate        = calc.tax_rate
        taxAmount      = calc.tax_amount
        totalAmount    = calc.total_amount
        lineItemRows   = calc.items.map((item, i) => ({
          order_num:   item.order_num ?? i,
          description: item.description,
          quantity:    item.quantity,
          unit:        item.unit  || null,
          unit_price:  item.unit_price,
          amount:      item.amount,
          tax_rate:    item.tax_rate ?? calc.tax_rate,
          source_type: item.source_type || 'project_price',
          source_id:   item.source_id   || null,
        }))
      }
    }

    // ── 11. invoice INSERT（invoice_type='invoice', status='draft'固定） ──
    const { data: invoice, error: invErr } = await auth.adminClient
      .from('invoices')
      .insert({
        company_id:        auth.companyId,
        client_id:         project.client_id,      // DBから取得（ブラウザ値不使用）
        project_id:        projectId,
        invoice_type:      'invoice',
        invoice_number:    numData,
        converted_from_id: convertedFromId,
        issue_date:        issueDate,
        due_date:          calcDueDate({
          issueDate,
          // spot は billing_period_to を持たないため渡さない。issueDate が基準日。
          closingDay:         client?.closing_day           ?? null,
          paymentMonthOffset: client?.payment_month_offset  ?? null,
          paymentDay:         client?.payment_day           ?? null,
        }),
        subtotal,
        tax_rate:          taxRate,
        tax_amount:        taxAmount,
        total_amount:      totalAmount,
        rounding_method:   bestQuote?.rounding_method ?? 'floor',
        title:             `清掃サービス請求書`,
        status:            'draft',
        created_by:        auth.userId,
      })
      .select()
      .single()

    if (invErr || !invoice) {
      return NextResponse.json({
        error: invErr?.message ?? '請求書の作成に失敗しました',
      }, { status: 500 })
    }

    // ── 12. invoice_items INSERT ─────────────────────────────────────
    if (lineItemRows.length > 0) {
      const { error: itemErr } = await auth.adminClient
        .from('invoice_items')
        .insert(lineItemRows.map((item) => ({ invoice_id: invoice.id, ...item })))

      if (itemErr) {
        // 補償: invoice を削除して一貫性を保つ
        await auth.adminClient.from('invoices').delete().eq('id', invoice.id)
        return NextResponse.json({
          error: `明細の保存に失敗しました: ${itemErr.message}`,
        }, { status: 500 })
      }
    }

    // ── 13. invoice_job_links INSERT（二重請求防止台帳） ─────────────
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
        // UNIQUE違反 = 同時リクエスト等で別の請求書がjobを先に取得した
        return NextResponse.json({
          error: 'この作業はすでに別の請求書に含まれています。ページを再読み込みして再度お試しください。',
          code:  'JOB_ALREADY_BILLED',
        }, { status: 409 })
      }

      return NextResponse.json({
        error: `作業の紐付けに失敗しました: ${linkErr.message}`,
      }, { status: 500 })
    }

    return NextResponse.json({ existing: false, invoice }, { status: 201 })

  } catch (e) {
    console.error('[api/projects/[id]/invoice] unexpected error:', e)
    return NextResponse.json({
      error: '請求書の生成に失敗しました。しばらく時間をおいて再度お試しください。',
    }, { status: 500 })
  }
}

