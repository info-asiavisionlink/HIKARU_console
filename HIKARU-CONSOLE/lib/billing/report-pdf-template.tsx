/**
 * HIKARU 清掃品質報告書 PDF テンプレート
 * @react-pdf/renderer 使用
 *
 * 写真はネットワーク画像のため PDF には含めない。
 * テキスト情報（概要・品質評価・箇所別スコア）を中心に構成。
 */
import React from 'react'
import path from 'path'
import {
  Document, Page, Text, View, StyleSheet, Font,
} from '@react-pdf/renderer'
import type { ReportContent } from '@/services/reports.service'

Font.register({
  family: 'NotoSansJP',
  src: path.join(process.cwd(), 'public', 'fonts', 'NotoSansJP-Regular.otf'),
})

const GOLD  = '#c9a227'
const DARK  = '#1a1a1a'
const GRAY1 = '#444444'
const GRAY2 = '#777777'
const GRAY3 = '#aaaaaa'
const BOR   = '#e5e5e5'
const BG    = '#f8f7f5'

const s = StyleSheet.create({
  page:         { fontFamily: 'NotoSansJP', fontSize: 10, padding: '40 48 56 48', backgroundColor: '#ffffff' },
  header:       { backgroundColor: DARK, padding: '14 16', marginBottom: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  headerLabel:  { fontSize: 7.5, color: GRAY3, textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 4 },
  headerTitle:  { fontSize: 18, fontWeight: 'bold', color: '#ffffff' },
  headerMeta:   { fontSize: 8.5, color: GRAY3, textAlign: 'right' },
  section:      { marginBottom: 16 },
  secTitle:     { fontSize: 7.5, fontWeight: 'bold', color: GRAY3, textTransform: 'uppercase', letterSpacing: 1.5, paddingBottom: 5, marginBottom: 8, borderBottom: `0.75px solid ${BOR}` },
  row:          { flexDirection: 'row', borderBottom: `0.5px solid ${BOR}`, paddingVertical: 4 },
  rowLabel:     { fontSize: 9, color: GRAY2, width: 80 },
  rowValue:     { fontSize: 9, color: DARK, flex: 1 },
  scoreBox:     { backgroundColor: BG, border: `0.75px solid ${BOR}`, padding: '10 14', marginBottom: 16 },
  scoreBig:     { fontSize: 28, fontWeight: 'bold', color: DARK },
  scoreLabel:   { fontSize: 9, color: GRAY2, marginTop: 2 },
  scoreRow:     { flexDirection: 'row', gap: 20, marginTop: 6 },
  scoreBadge:   { fontSize: 8.5, color: GRAY1 },
  bodyText:     { fontSize: 9, color: DARK, lineHeight: 1.65 },
  spotCard:     { border: `0.75px solid ${BOR}`, marginBottom: 10 },
  spotHead:     { backgroundColor: BG, flexDirection: 'row', justifyContent: 'space-between', padding: '6 10' },
  spotName:     { fontSize: 9.5, fontWeight: 'bold', color: DARK },
  spotScore:    { fontSize: 9, fontWeight: 'bold', color: DARK },
  spotBody:     { padding: '7 10 8 10' },
  spotAI:       { backgroundColor: '#eff6ff', border: `0.5px solid #bfdbfe`, padding: '5 8', marginTop: 5 },
  spotAILabel:  { fontSize: 7.5, fontWeight: 'bold', color: '#1d4ed8', marginBottom: 2 },
  spotAIText:   { fontSize: 8.5, color: DARK, lineHeight: 1.6 },
  rec:          { fontSize: 8, padding: '1 6', borderRadius: 9999 },
  footer:       { position: 'absolute', bottom: 24, left: 48, right: 48, borderTop: `0.5px solid ${BOR}`, paddingTop: 7, flexDirection: 'row', justifyContent: 'space-between' },
  footerText:   { fontSize: 7, color: GRAY3 },
  goldBar:      { backgroundColor: GOLD, height: 3, marginBottom: 14 },
})

function recLabel(r: 'pass' | 'check' | 'redo' | null): string {
  if (!r) return ''
  return r === 'pass' ? '合格' : r === 'check' ? '要確認' : '再清掃推奨'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' })
}
function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })
}
function calcDuration(start: string, end: string | null): string {
  if (!end) return '—'
  const min = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000)
  if (min < 60) return `${min}分`
  const h = Math.floor(min / 60), m = min % 60
  return m === 0 ? `${h}時間` : `${h}時間${m}分`
}

export interface ReportPDFData {
  reportId:    string
  version:     number
  createdAt:   string
  companyName: string
  content:     ReportContent
}

export function ReportPDF({ data }: { data: ReportPDFData }) {
  const { content, version, createdAt, companyName } = data
  const { project, store, client, job, spots, summary } = content

  return (
    <Document title={`清掃品質報告書 No.${String(version).padStart(3, '0')}`}>
      <Page size="A4" style={s.page}>

        {/* ヘッダー */}
        <View style={s.header}>
          <View>
            <Text style={s.headerLabel}>HIKARU Quality Report</Text>
            <Text style={s.headerTitle}>清掃品質報告書</Text>
          </View>
          <View>
            <Text style={s.headerMeta}>No. {String(version).padStart(3, '0')}</Text>
            <Text style={s.headerMeta}>{new Date(createdAt).toLocaleDateString('ja-JP')}</Text>
          </View>
        </View>
        <View style={s.goldBar} />

        {/* 作業概要 */}
        <View style={s.section}>
          <Text style={s.secTitle}>作業概要</Text>
          {[
            ['案件名',       project.name],
            ['クライアント', client.name],
            ['作業場所',     store.name],
            ['担当作業者',   job.worker_name],
            ['作業日',       formatDate(job.work_date)],
            ['開始',         formatTime(job.started_at)],
            ['終了',         job.completed_at ? formatTime(job.completed_at) : '—'],
            ['作業時間',     calcDuration(job.started_at, job.completed_at)],
          ].map(([label, value]) => (
            <View key={label} style={s.row}>
              <Text style={s.rowLabel}>{label}</Text>
              <Text style={s.rowValue}>{value}</Text>
            </View>
          ))}
        </View>

        {/* 品質スコアサマリー */}
        <View style={s.scoreBox}>
          <Text style={s.secTitle}>品質評価サマリー</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 10 }}>
            <Text style={s.scoreBig}>{summary.overall_score}</Text>
            <Text style={[s.scoreLabel, { marginBottom: 6 }]}>/ 100点</Text>
          </View>
          <View style={s.scoreRow}>
            <Text style={s.scoreBadge}>合格: {summary.passed_count}箇所</Text>
            {summary.check_count > 0 && <Text style={s.scoreBadge}>要確認: {summary.check_count}箇所</Text>}
            {summary.redo_count  > 0 && <Text style={s.scoreBadge}>再清掃: {summary.redo_count}箇所</Text>}
          </View>
        </View>

        {/* 本日の作業内容 */}
        <View style={s.section}>
          <Text style={s.secTitle}>本日の作業内容</Text>
          <Text style={s.bodyText}>{summary.work_summary}</Text>
        </View>

        {/* 品質評価 */}
        <View style={s.section}>
          <Text style={s.secTitle}>品質評価</Text>
          <Text style={s.bodyText}>{summary.quality_assessment}</Text>
        </View>

        {/* 箇所別詳細 */}
        <View style={s.section}>
          <Text style={s.secTitle}>撮影箇所別詳細（{spots.length}箇所 ※写真は含みません）</Text>
          {spots.map((spot) => (
            <View key={spot.name} style={s.spotCard}>
              <View style={s.spotHead}>
                <Text style={s.spotName}>{spot.order}. {spot.name}</Text>
                <Text style={s.spotScore}>
                  {spot.score != null ? `${spot.score}点` : '—'}
                  {spot.recommendation ? `　${recLabel(spot.recommendation)}` : ''}
                </Text>
              </View>
              {spot.ai_comment ? (
                <View style={s.spotBody}>
                  <View style={s.spotAI}>
                    <Text style={s.spotAILabel}>AI コメント</Text>
                    <Text style={s.spotAIText}>{spot.ai_comment}</Text>
                  </View>
                </View>
              ) : null}
            </View>
          ))}
        </View>

        {/* フッター */}
        <View style={s.footer}>
          <Text style={s.footerText}>{companyName}</Text>
          <Text style={s.footerText}>清掃品質報告書 No.{String(version).padStart(3, '0')}</Text>
        </View>

      </Page>
    </Document>
  )
}
