import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { InvoicePDF, type PDFInvoiceData } from '@/lib/billing/pdf-template'

// POST /api/invoices/[id]/pdf - PDF生成 + Storage保存
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // データ取得
  const { data: invoice } = await auth.adminClient
    .from('invoices')
    .select(`
      *,
      clients:client_id (name, email, phone, address, contact_name, invoice_email, payment_terms, closing_day),
      projects:project_id (name),
      invoice_items (description, quantity, unit, unit_price, amount, tax_rate, order_num),
      companies:company_id (
        name, logo_url, address, phone, email,
        postal_code, invoice_registration_number,
        bank_name, bank_branch_name, bank_account_type,
        bank_account_number, bank_account_holder, bank_account_holder_kana,
        corporate_number, seal_path
      )
    `)
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()

  if (!invoice) return NextResponse.json({ error: '見つかりません' }, { status: 404 })

  const client  = invoice.clients  as any
  const project = invoice.projects as any
  const company = invoice.companies as any
  const items   = (invoice.invoice_items as any[] ?? [])
    .sort((a: any, b: any) => a.order_num - b.order_num)

  // 電子印: Private Storage からダウンロード → Base64 data URI へ変換
  // 取得失敗時もPDF生成を続行する
  let companySealBase64: string | null = null
  if (company?.seal_path) {
    try {
      const { data: sealBlob, error: sealErr } = await auth.adminClient.storage
        .from('company-assets')
        .download(company.seal_path)
      if (!sealErr && sealBlob) {
        const arrayBuf = await sealBlob.arrayBuffer()
        companySealBase64 = `data:image/png;base64,${Buffer.from(arrayBuf).toString('base64')}`
      } else {
        console.error('[pdf] seal download error:', sealErr?.message)
      }
    } catch (e) {
      console.error('[pdf] seal download failed — continuing without seal:', e)
    }
  }

  const pdfData: PDFInvoiceData = {
    invoice_type:         invoice.invoice_type as 'quote' | 'invoice',
    invoice_number:       invoice.invoice_number,
    issue_date:           invoice.issue_date,
    due_date:             invoice.due_date,
    title:                invoice.title,
    status:               invoice.status,
    billing_period_from:  invoice.billing_period_from,
    billing_period_to:    invoice.billing_period_to,
    // 自社情報（既存）
    company_name:         company?.name ?? 'HIKARU',
    company_address:      company?.address  ?? null,
    company_phone:        company?.phone    ?? null,
    company_email:        company?.email    ?? null,
    // 自社情報（新規）
    company_postal_code:                 company?.postal_code                 ?? null,
    company_invoice_registration_number: company?.invoice_registration_number ?? null,
    company_corporate_number:            company?.corporate_number            ?? null,
    company_seal_base64:                 companySealBase64,
    // 振込先
    bank_name:               company?.bank_name               ?? null,
    bank_branch_name:        company?.bank_branch_name        ?? null,
    bank_account_type:       company?.bank_account_type       ?? null,
    bank_account_number:     company?.bank_account_number     ?? null,
    bank_account_holder:     company?.bank_account_holder     ?? null,
    bank_account_holder_kana: company?.bank_account_holder_kana ?? null,
    // 顧客情報
    client_name:          client?.name ?? '—',
    client_address:       client?.address      ?? null,
    client_phone:         client?.phone        ?? null,
    client_email:         client?.email        ?? null,
    client_contact:       client?.contact_name ?? null,
    client_invoice_email: client?.invoice_email ?? null,
    payment_terms:        client?.payment_terms ?? null,
    closing_day:          client?.closing_day   ?? null,
    project_name:         project?.name,
    // 明細（tax_rate を追加）
    items: items.map((i: any) => ({
      description: i.description,
      quantity:    Number(i.quantity),
      unit:        i.unit,
      unit_price:  Number(i.unit_price),
      amount:      Number(i.amount),
      tax_rate:    Number(i.tax_rate ?? invoice.tax_rate ?? 0.10),
    })),
    // 金額（DB値をそのまま使用 — 再計算しない）
    subtotal:     Number(invoice.subtotal),
    tax_rate:     Number(invoice.tax_rate),
    tax_amount:   Number(invoice.tax_amount),
    total_amount: Number(invoice.total_amount),
    notes:        invoice.notes,
  }

  // PDF 生成
  const buffer = await renderToBuffer(React.createElement(InvoicePDF, { data: pdfData }))

  // Storage 保存
  const typeFolder = invoice.invoice_type === 'quote' ? 'quotes' : 'invoices'
  const pdfPath    = `invoices/${auth.companyId}/${typeFolder}/${id}.pdf`

  const { error: uploadErr } = await auth.adminClient.storage
    .from('documents')
    .upload(pdfPath, buffer, {
      contentType: 'application/pdf',
      upsert:      true,
    })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  // パスをDBに保存
  await auth.adminClient
    .from('invoices')
    .update({ pdf_path: pdfPath, pdf_generated_at: new Date().toISOString() })
    .eq('id', id)

  // Signed URL (1時間有効)
  const { data: signedUrlData } = await auth.adminClient.storage
    .from('documents')
    .createSignedUrl(pdfPath, 3600)

  return NextResponse.json({
    pdf_path:   pdfPath,
    signed_url: signedUrlData?.signedUrl ?? null,
  })
}
