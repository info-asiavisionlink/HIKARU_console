import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

function calcTax(amountExTax: number, taxRate: number) {
  const taxAmount    = Math.floor(amountExTax * taxRate)
  const amountIncTax = amountExTax + taxAmount
  return { taxAmount, amountIncTax }
}

// GET /api/projects/[id]/pricing
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // adminClient は service_role のため RLS をバイパスする。
  // company_id 確認をアプリ側で必ず実施すること。
  const { data: project } = await auth.adminClient
    .from('projects')
    .select('id, company_id')
    .eq('id', id)
    .single()

  if (!project) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
  if (project.company_id !== auth.companyId) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const [billingRes, pricesRes] = await Promise.all([
    auth.adminClient.from('project_billing').select('*').eq('project_id', id).maybeSingle(),
    auth.adminClient.from('project_prices').select('*').eq('project_id', id).order('period_month', { ascending: true, nullsFirst: true }),
  ])

  return NextResponse.json({
    billing: billingRes.data ?? null,
    prices:  pricesRes.data ?? [],
  })
}

// PUT /api/projects/[id]/pricing
// Body:
//   billing: { billing_status, quote_number, contract_date, billing_date, payment_due_date, actual_payment_date, notes }
//   prices:  Array<{ period_month?, amount_ex_tax, tax_rate, unit_price?, quantity?, unit_label? }>
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  // adminClient は service_role のため RLS をバイパスする。
  // project_prices DELETE / INSERT および project_billing UPSERT より前に
  // 必ず company_id を確認し、他社案件の料金を変更できないことを保証する。
  // project_type も取得して日常案件のサーバー側金額整合性チェックに使用する。
  const { data: project } = await auth.adminClient
    .from('projects')
    .select('id, company_id, project_type')
    .eq('id', id)
    .single()

  if (!project) return NextResponse.json({ error: '案件が見つかりません' }, { status: 404 })
  if (project.company_id !== auth.companyId) return NextResponse.json({ error: '権限がありません' }, { status: 403 })

  const body = await req.json()
  const { billing, prices } = body
  const client = auth.adminClient

  // ── billing upsert（空文字の日付フィールドをnullに変換）
  if (billing) {
    const DATE_FIELDS = ['contract_date', 'billing_date', 'payment_due_date', 'actual_payment_date'] as const
    const sanitized = { ...billing }
    for (const f of DATE_FIELDS) {
      if (sanitized[f] === '') sanitized[f] = null
    }
    const { error } = await client
      .from('project_billing')
      .upsert({ project_id: id, ...sanitized }, { onConflict: 'project_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── prices upsert (計算して保存)
  if (prices) {
    // 既存を全削除して再登録（upsert だと NULL UNIQUE が複雑になるため）
    await client.from('project_prices').delete().eq('project_id', id)

    const isHotel = project.project_type === 'hotel'

    const rows = (prices as any[])
      .filter((p) => Number(p.amount_ex_tax) > 0 || Number(p.unit_price) > 0)
      .map((p) => {
        const unitP   = Number(p.unit_price) || 0
        const qty     = Number(p.quantity)   || 0
        // 日常案件: amount_ex_tax = unit_price × quantity をサーバー側で保証
        // spot/recurring: ブラウザ送信の amount_ex_tax をそのまま使用
        const exTax   = isHotel ? unitP * qty : (Number(p.amount_ex_tax) || 0)
        const taxRate = Number(p.tax_rate ?? 0.10)
        const { taxAmount, amountIncTax } = calcTax(exTax, taxRate)

        // unit_label: trim して最大20文字。空文字は NULL 扱い
        const rawLabel  = typeof p.unit_label === 'string' ? p.unit_label.trim() : null
        const unitLabel = rawLabel && rawLabel.length > 0
          ? rawLabel.slice(0, 20)
          : null

        return {
          project_id:     id,
          period_month:   p.period_month   ?? null,
          amount_ex_tax:  exTax,
          tax_rate:       taxRate,
          tax_amount:     taxAmount,
          amount_inc_tax: amountIncTax,
          unit_price:     p.unit_price     ?? null,
          quantity:       p.quantity       ?? null,
          unit_label:     unitLabel,
        }
      })

    if (rows.length > 0) {
      const { error } = await client.from('project_prices').insert(rows)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true })
}
