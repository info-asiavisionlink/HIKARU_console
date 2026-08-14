import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AC = any

// 報酬率の定義
const COMMISSION_RATES: Record<string, number> = {
  spot:      0.08,  // 8%
  recurring: 0.03,  // 3%
  hotel:     0.03,  // 3%
  other:     0.05,  // 5%
}

// POST: 入金完了処理 + 営業報酬自動計算
export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth as { companyId: string; adminClient: AC }

  const body = await req.json()
  // period_month は sales_commissions 向けに受け取る（project_billing では使わない）
  const { project_id, payment_amount, period_month } = body

  if (!project_id || !payment_amount) {
    return NextResponse.json({ error: 'project_id and payment_amount required' }, { status: 400 })
  }

  // 案件情報を取得（company_id でIDOR対策）
  const { data: project, error: pErr } = await admin
    .from('projects')
    .select('id, name, project_type, acquired_by, company_id')
    .eq('id', project_id)
    .eq('company_id', companyId)
    .single()

  if (pErr || !project) return NextResponse.json({ error: 'project not found' }, { status: 404 })

  const now = new Date().toISOString()

  // project_billing を upsert（入金完了に更新）
  // 本番スキーマ（migration 014）に合わせて以下カラムのみ使用:
  //   project_id, billing_status, actual_payment_date, updated_at
  // 存在しないカラム（actual_payment_amount, period_month）は一切書き込まない。
  // project_billing は 1案件=1レコード（PRIMARY KEY: project_id のみ）。
  const { error: billingErr } = await admin.from('project_billing').upsert({
    project_id,
    billing_status:      'paid',
    actual_payment_date: now.split('T')[0],
    updated_at:          now,
  }, { onConflict: 'project_id' })

  if (billingErr) {
    console.error('[api/billing] project_billing upsert failed:', billingErr.message)
    return NextResponse.json({ error: `請求情報の更新に失敗しました: ${billingErr.message}` }, { status: 500 })
  }

  // 獲得者がいる場合は報酬を計算・確定
  // sales_commissions は project_billing と別テーブル。
  // period_month / payment_amount はそちらで引き続き管理。
  let commission = null
  if (project.acquired_by) {
    const rate   = COMMISSION_RATES[project.project_type] ?? 0.03
    const amount = Math.round(Number(payment_amount) * rate)

    const { data: comm } = await admin.from('sales_commissions').insert({
      worker_id:        project.acquired_by,
      company_id:       companyId,
      project_id,
      period_month:     period_month ?? null,
      payment_amount:   Number(payment_amount),
      commission_rate:  rate,
      commission_amount: amount,
      project_type:     project.project_type,
      status:           'confirmed',
      confirmed_at:     now,
    }).select().single()

    commission = comm
  }

  return NextResponse.json({
    success: true,
    commission,
    message: project.acquired_by
      ? `入金完了。報酬 ¥${commission?.commission_amount?.toLocaleString() ?? 0} を確定しました。`
      : '入金完了（獲得者未設定のため報酬計算なし）',
  })
}

// GET: 案件の入金履歴・報酬状況
export async function GET(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth as { companyId: string; adminClient: AC }

  const projectId = req.nextUrl.searchParams.get('project_id')

  if (projectId) {
    // 特定案件の入金・報酬履歴
    const { data: billing } = await admin
      .from('project_billing')
      .select('*')
      .eq('project_id', projectId)
      .order('created_at', { ascending: false })

    const { data: commissions } = await admin
      .from('sales_commissions')
      .select('*, profiles(name)')
      .eq('project_id', projectId)
      .order('confirmed_at', { ascending: false })

    return NextResponse.json({ billing: billing ?? [], commissions: commissions ?? [] })
  }

  // 全社の今月報酬サマリー
  const today = new Date()
  const from  = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`
  const { data: commissions } = await admin
    .from('sales_commissions')
    .select('*, profiles(id, name, employee_number), projects(id, name, project_type)')
    .eq('company_id', companyId)
    .gte('confirmed_at', from)
    .order('confirmed_at', { ascending: false })

  return NextResponse.json({ commissions: commissions ?? [] })
}
