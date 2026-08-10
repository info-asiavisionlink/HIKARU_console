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
      clients:client_id (name, email, phone, address, contact_name),
      projects:project_id (name),
      invoice_items (description, quantity, unit, unit_price, amount, order_num),
      companies:company_id (name, logo_url)
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

  const pdfData: PDFInvoiceData = {
    invoice_type:         invoice.invoice_type as 'quote' | 'invoice',
    invoice_number:       invoice.invoice_number,
    issue_date:           invoice.issue_date,
    due_date:             invoice.due_date,
    title:                invoice.title,
    status:               invoice.status,
    billing_period_from:  invoice.billing_period_from,
    billing_period_to:    invoice.billing_period_to,
    company_name:         company?.name ?? 'HIKARU',
    client_name:          client?.name ?? '—',
    client_address:       client?.address,
    client_phone:         client?.phone,
    client_email:         client?.email,
    client_contact:       client?.contact_name,
    project_name:         project?.name,
    items:                items.map((i: any) => ({
      description: i.description,
      quantity:    Number(i.quantity),
      unit:        i.unit,
      unit_price:  Number(i.unit_price),
      amount:      Number(i.amount),
    })),
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
