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
      bank_account_number, bank_account_holder, bank_account_holder_kana,
      corporate_number, seal_path
    `)
    .eq('id', companyId)
    .single()

  if (!company) return NextResponse.json({ data: null })
  const { seal_path, ...rest } = company as Record<string, unknown>
  return NextResponse.json({ data: { ...rest, has_seal: seal_path !== null } })
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
    corporate_number,
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

  // 法人番号: 空文字/null は null、値あり → 13桁数字のみ
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  const corpNum = corporate_number?.trim() || null
  if (corpNum && !/^\d{13}$/.test(corpNum)) {
    return NextResponse.json(
      { error: '法人番号は13桁の数字で入力してください（ハイフンなし）' },
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
      corporate_number:             corpNum,
    } as never)
    .eq('id', companyId)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { seal_path, ...rest } = data as Record<string, unknown>
  return NextResponse.json({ data: { ...rest, has_seal: seal_path !== null } })
}
