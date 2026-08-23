// ============================================================
// Manual AI — Shared Core
// Worker / Console 共通の型・Context Builder・Source抽出・
// Non-streaming QA Generator。
//
// Streaming Generator は Worker固有のため含まない。
// Console は generateScopedManualQA() を使用する。
// Worker は自身の modules/manual-ai/ を継続使用する。
// ============================================================

import { createOpenAIClient, OPENAI_MODELS } from '../openai/client'
import {
  buildManualSystemPrompt,
  buildManualUserPrompt,
  NO_EVIDENCE_REPLY,
  type ManualAudience,
} from './prompts'

export type { ManualAudience }
export { NO_EVIDENCE_REPLY }

// ─── Types ───────────────────────────────────────────────
export type ManualScope = 'project' | 'company' | 'global'

export type ManualType = 'pdf' | 'image' | 'video' | 'text' | 'faq' | 'note'

export interface ManualItem {
  id:          string
  type:        ManualType
  title:       string
  content:     string | null
  file_url:    string | null
  // optional fields used by Console scope loader
  category?:   string | null
  project_id?: string | null
  scope?:      ManualScope
}

export interface ScopedManuals {
  /** 案件固有（最優先） */
  project: ManualItem[]
  /** 会社共通テンプレート */
  company: ManualItem[]
  /** HIKARU標準グローバル */
  global:  ManualItem[]
}

export interface ChatMessage {
  role:    'user' | 'assistant'
  content: string
}

export interface ManualSourceRef {
  manual_id:  string
  title:      string
  category:   string | null
  project_id: string | null
  scope:      ManualScope
}

export interface ManualQAResult {
  answer:         string
  sources:        ManualSourceRef[]
  evidence_found: boolean
}

// ─── Context Builder ─────────────────────────────────────

const TYPE_LABEL: Record<string, string> = {
  note:  '注意事項',
  faq:   'FAQ',
  text:  '作業手順・説明',
  pdf:   'PDF資料',
  image: '画像資料',
  video: '動画資料',
}

// type優先度（注意事項・FAQを先頭に）
const TYPE_PRIORITY: Record<string, number> = {
  note: 0, faq: 1, text: 2, pdf: 3, image: 4, video: 5,
}

interface BuildSectionOpts {
  /** 1Manualあたりのcontent最大文字数。未指定時は無制限（Worker互換）。 */
  maxContentChars?: number
}

function buildSection(items: ManualItem[], opts?: BuildSectionOpts): string {
  const sorted = [...items].sort(
    (a, b) => (TYPE_PRIORITY[a.type] ?? 9) - (TYPE_PRIORITY[b.type] ?? 9),
  )
  return sorted
    .map((m) => {
      const label = TYPE_LABEL[m.type] ?? m.type
      let block = `【${label}】「${m.title}」`
      if (m.content) {
        let body = m.content.trim()
        if (opts?.maxContentChars && body.length > opts.maxContentChars) {
          body = body.slice(0, opts.maxContentChars) + '…（省略）'
        }
        block += `\n${body}`
      }
      if (m.file_url) {
        block += `\n（参考ファイル: ${m.file_url}）`
      }
      return block
    })
    .join('\n\n────────────────\n\n')
}

export interface BuildContextOpts {
  /** 1Manualあたりのcontent最大文字数。未指定時は無制限。 */
  maxContentChars?: number
}

export function buildManualContext(manuals: ManualItem[], opts?: BuildContextOpts): string {
  if (manuals.length === 0) return '（マニュアルが登録されていません）'
  return buildSection(manuals, opts)
}

export function buildScopedManualContext(
  scoped: ScopedManuals,
  opts?: BuildContextOpts,
): string {
  const hasProject = scoped.project.length > 0
  const hasCompany = scoped.company.length > 0
  const hasGlobal  = scoped.global.length > 0

  if (!hasProject && !hasCompany && !hasGlobal) {
    return '（マニュアルが登録されていません）'
  }

  const parts: string[] = []

  if (hasProject) {
    parts.push(
      '═══ 優先度1: 案件固有マニュアル（必ず最優先） ═══\n' +
      '（他のマニュアルと矛盾する場合は必ずこちらを優先してください）\n\n' +
      buildSection(scoped.project, opts),
    )
  }
  if (hasCompany) {
    parts.push(
      '═══ 優先度2: 会社共通マニュアル ═══\n' +
      '（案件固有の指示がない事項について参照してください）\n\n' +
      buildSection(scoped.company, opts),
    )
  }
  if (hasGlobal) {
    parts.push(
      '═══ 優先度3: HIKARU標準マニュアル ═══\n' +
      '（案件・会社マニュアルで確認できない場合のみ参照してください）\n\n' +
      buildSection(scoped.global, opts),
    )
  }

  return parts.join('\n\n')
}

export function flattenScopedManuals(scoped: ScopedManuals): ManualItem[] {
  return [
    ...scoped.project.map(m => ({ ...m, scope: 'project' as const })),
    ...scoped.company.map(m => ({ ...m, scope: 'company' as const })),
    ...scoped.global.map(m  => ({ ...m, scope: 'global'  as const })),
  ]
}

// ─── Source Extractor ────────────────────────────────────

export function extractSources(reply: string, manuals: ManualItem[]): string[] {
  const refSection = reply.match(/■参照マニュアル\s*\n([\s\S]*?)(?=■|$)/)?.[1] ?? ''

  const found = manuals.filter((m) => {
    const inRef  = refSection.includes(m.title)
    const inBody = reply.includes(m.title)
    return inRef || inBody
  })

  if (found.length > 0) return found.map((m) => m.title)

  if (refSection.trim()) {
    return refSection
      .split('\n')
      .map((l) => l.replace(/^[-・\s]+/, '').trim())
      .filter(Boolean)
      .slice(0, 5)
  }

  return []
}

// ─── Non-streaming QA Generator（Console用） ─────────────
// Console Realtime Toolから Promise<ManualQAResult> で呼べる。
// Streaming不要。Worker側のSSE Generatorとは別物。

export interface GenerateManualQAOpts {
  audience?:       ManualAudience
  maxTokens?:      number
  /** 1Manualあたりのcontent最大文字数（default: 3000）。 */
  maxContentChars?: number
}

export async function generateScopedManualQA(
  question: string,
  scoped:   ScopedManuals,
  opts?:    GenerateManualQAOpts,
): Promise<ManualQAResult> {
  const audience       = opts?.audience       ?? 'worker'
  const maxTokens      = opts?.maxTokens      ?? 1500
  const maxContentChars = opts?.maxContentChars ?? 3000

  const total = scoped.project.length + scoped.company.length + scoped.global.length

  if (total === 0) {
    return { answer: NO_EVIDENCE_REPLY, sources: [], evidence_found: false }
  }

  const context      = buildScopedManualContext(scoped, { maxContentChars })
  const systemPrompt = buildManualSystemPrompt(audience)
  const userPrompt   = buildManualUserPrompt(question, context, audience)

  const openai = createOpenAIClient()
  const completion = await openai.chat.completions.create({
    model:       OPENAI_MODELS.CHAT,
    messages:    [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
    temperature: 0.3,
    max_tokens:  maxTokens,
  } as Parameters<typeof openai.chat.completions.create>[0])

  const answer = (completion.choices[0]?.message as { content?: string | null })?.content?.trim() ?? ''

  if (!answer) {
    return { answer: NO_EVIDENCE_REPLY, sources: [], evidence_found: false }
  }

  const allManuals    = flattenScopedManuals(scoped)
  const sourceTitles  = extractSources(answer, allManuals)

  const sources: ManualSourceRef[] = allManuals
    .filter((m) => sourceTitles.includes(m.title))
    .map((m) => ({
      manual_id:  m.id,
      title:      m.title,
      category:   m.category   ?? null,
      project_id: m.project_id ?? null,
      scope:      m.scope      ?? 'company',
    }))

  const noEvidence =
    answer.includes('該当情報がありません') ||
    answer.includes('確認できませんでした') ||
    answer.includes('マニュアルが登録されていません')

  return {
    answer,
    sources,
    evidence_found: !noEvidence,
  }
}
