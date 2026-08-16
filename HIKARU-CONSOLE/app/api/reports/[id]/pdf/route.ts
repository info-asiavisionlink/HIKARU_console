import { NextRequest, NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import { ReportPDF, type ReportPDFData } from '@/lib/billing/report-pdf-template'
import type { ReportContent } from '@/services/reports.service'

// POST /api/reports/[id]/pdf
// 作業完了報告書の PDF を生成して Supabase Storage へ保存する。
//
// IDOR対策:
//   - reports.company_id = auth.companyId をサーバー側で確認
//   - 他社の報告書 PDF を生成できない
//
// Storage path: reports/{companyId}/{reportId}.pdf
// 既存 reports.pdf_url カラムに Storage path を保存。
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ── 1. report取得・ownership確認 ─────────────────────────────
  const { data: report } = await auth.adminClient
    .from('reports')
    .select('id, version, content, created_at, company_id')
    .eq('id', id)
    .eq('company_id', auth.companyId)
    .single()

  if (!report) return NextResponse.json({ error: '報告書が見つかりません' }, { status: 404 })

  // ── 2. 自社名取得 ─────────────────────────────────────────────
  const { data: company } = await auth.adminClient
    .from('companies')
    .select('name')
    .eq('id', auth.companyId)
    .single()

  const companyName = company?.name ?? 'HIKARU'

  // ── 3. PDF生成 ───────────────────────────────────────────────
  const pdfData: ReportPDFData = {
    reportId:    report.id,
    version:     report.version,
    createdAt:   report.created_at,
    companyName,
    content:     report.content as ReportContent,
  }

  const buffer = await renderToBuffer(React.createElement(ReportPDF, { data: pdfData }))

  // ── 4. Storage保存（invoicesと同じ documents bucket） ─────────
  const pdfPath = `reports/${auth.companyId}/${id}.pdf`

  const { error: uploadErr } = await auth.adminClient.storage
    .from('documents')
    .upload(pdfPath, buffer, {
      contentType: 'application/pdf',
      upsert:      true,
    })

  if (uploadErr) return NextResponse.json({ error: uploadErr.message }, { status: 500 })

  // ── 5. reports.pdf_url を更新（既存カラムを流用） ─────────────
  await auth.adminClient
    .from('reports')
    .update({ pdf_url: pdfPath })
    .eq('id', id)
    .eq('company_id', auth.companyId)

  // ── 6. Signed URL（1時間有効） ────────────────────────────────
  const { data: signedUrlData } = await auth.adminClient.storage
    .from('documents')
    .createSignedUrl(pdfPath, 3600)

  return NextResponse.json({
    pdf_path:   pdfPath,
    signed_url: signedUrlData?.signedUrl ?? null,
  })
}
