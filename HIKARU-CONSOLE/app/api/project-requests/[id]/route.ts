import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// PATCH /api/project-requests/:id  → approve / reject
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  const { status, adminNote } = await req.json()

  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 })
  }

  // 依頼を更新
  const { data: req_, error } = await auth.adminClient
    .from('client_project_requests')
    .update({ status, admin_note: adminNote ?? null })
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .select('portal_account_id, title, client_id')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 顧客ポータルへ通知送信
  const notifType = status === 'approved' ? 'info' : 'info'
  const notifTitle = status === 'approved'
    ? `案件依頼「${req_.title}」が承認されました`
    : `案件依頼「${req_.title}」は承認されませんでした`
  const notifBody = status === 'approved'
    ? '担当者が案件の詳細を確認し、改めてご連絡いたします。'
    : adminNote ?? '詳細は担当者よりご連絡いたします。'

  await auth.adminClient
    .from('client_notifications')
    .insert({
      portal_account_id: req_.portal_account_id,
      type:              notifType,
      title:             notifTitle,
      body:              notifBody,
    })

  return NextResponse.json({ success: true })
}
