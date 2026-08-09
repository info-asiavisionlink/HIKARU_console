import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

// POST /api/invoices/[id]/publish - 顧客ポータルへ公開
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existing } = await auth.adminClient
    .from('invoices').select('status, company_id, invoice_type, published_to_portal').eq('id', id).single()

  if (!existing) return NextResponse.json({ error: '見つかりません' }, { status: 404 })
  if (existing.company_id !== auth.companyId) return NextResponse.json({ error: '権限なし' }, { status: 403 })
  if (existing.status === 'draft') return NextResponse.json({ error: '下書きは公開できません。先に発行してください。' }, { status: 400 })

  const now = new Date().toISOString()
  const { data, error } = await auth.adminClient
    .from('invoices')
    .update({
      published_to_portal: true,
      published_at:        now,
      published_by:        auth.userId,
    })
    .eq('id', id)
    .select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  // 将来: LINE通知 quote_published / invoice_sent イベントをここでキック
  return NextResponse.json({ invoice: data })
}
