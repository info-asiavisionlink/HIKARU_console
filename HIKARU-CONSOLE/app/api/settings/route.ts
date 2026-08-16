import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth

  const { data: company } = await admin
    .from('companies')
    .select(`
      id, name, address, phone, email, created_at,
      postal_code, invoice_registration_number,
      bank_name, bank_branch_name, bank_account_type,
      bank_account_number, bank_account_holder, bank_account_holder_kana
    `)
    .eq('id', companyId)
    .single()

  return NextResponse.json({ data: company })
}

export async function PATCH(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient: admin } = auth

  const body = await req.json()
  const {
    name, address, phone, email,
    postal_code, invoice_registration_number,
    bank_name, bank_branch_name, bank_account_type,
    bank_account_number, bank_account_holder, bank_account_holder_kana,
  } = body

  if (!name?.trim()) return NextResponse.json({ error: '会社名を入力してください' }, { status: 400 })

  // 適格請求書発行事業者登録番号: 入力がある場合のみ T + 13桁 を検証
  const regNum = invoice_registration_number?.trim() || null
  if (regNum && !/^T\d{13}$/.test(regNum)) {
    return NextResponse.json(
      { error: '適格請求書発行事業者登録番号は「T」+13桁の数字で入力してください（例: T1234567890123）' },
      { status: 400 }
    )
  }

  // 口座種別: 空文字は null、それ以外は '普通' / '当座' のみ許可
  const accountType = bank_account_type?.trim() || null
  if (accountType && accountType !== '普通' && accountType !== '当座') {
    return NextResponse.json(
      { error: '口座種別は「普通」または「当座」を選択してください' },
      { status: 400 }
    )
  }

  const { data, error } = await admin
    .from('companies')
    .update({
      name:    name.trim(),
      address: address?.trim()         || null,
      phone:   phone?.trim()           || null,
      email:   email?.trim()           || null,
      postal_code:                  postal_code?.trim()                  || null,
      invoice_registration_number:  regNum,
      bank_name:                    bank_name?.trim()                    || null,
      bank_branch_name:             bank_branch_name?.trim()             || null,
      bank_account_type:            accountType,
      bank_account_number:          bank_account_number?.trim()          || null,
      bank_account_holder:          bank_account_holder?.trim()          || null,
      bank_account_holder_kana:     bank_account_holder_kana?.trim()     || null,
    })
    .eq('id', companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data })
}
