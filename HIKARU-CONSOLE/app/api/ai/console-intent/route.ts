import { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { createOpenAIClient, OPENAI_MODELS } from '@/lib/openai/client'
import {
  buildConsoleActionListForPrompt,
  isValidConsoleAction,
  getConsoleActionLevel,
} from '@/lib/voice/registry/console.actions'

// CONSOLE専用Intent解析。DBへの書き込みなし。
export const maxDuration = 15

// ============================================================
// POST /api/ai/console-intent — 管理者発話からAction Intentを解析
// 認証: CONSOLE Admin（getAuthContext → hk_c_uid / hk_c_at cookie）
// ⚠️ このAPIはActionを実行しない。Intent名とparamを返すだけ。
// ============================================================

function buildConsoleIntentPrompt(
  actionList: string,
  context?: {
    recentMessages?:  Array<{ role: string; content: string }>
    lastIntent?:      string
    lastResultData?:  { type: string; items?: Array<{ id: string; label: string }> }
  }
): string {
  let choiceSection = ''
  if (context?.lastResultData?.items?.length) {
    choiceSection = '\n\n【直前の選択肢リスト】\n'
    context.lastResultData.items.forEach(item => {
      choiceSection += `  ${item.label} → id: ${item.id}\n`
    })
  }

  let conversationSection = ''
  if (context?.recentMessages?.length) {
    conversationSection = '\n\n【直近の会話】\n'
    context.recentMessages.forEach(m => {
      conversationSection += `${m.role === 'user' ? 'Admin' : 'JARVIS'}: ${m.content}\n`
    })
  }

  return `あなたはHIKARU Console Assistant（清掃業務管理システムAI）のIntent Classifierです。
管理者の発話を分析し、最も適切なActionを1つ選んでください。

【利用可能なAction一覧】
${actionList}
${choiceSection}${conversationSection}

【絶対ルール】
1. 上記リストに存在しないActionは絶対に出力しない
2. L3以上（承認・削除・変更・作成）は現在未登録
3. confidence が 0.6 未満の場合は必ず action=null
4. 不明・不確実な場合は推測せず action=null
5. 必ずJSON形式のみで返す

【短い返答の解釈ルール】
肯定 (「はい」「うん」「お願い」): 直前の提案Actionを実行
否定 (「いいえ」「まだ」「違う」): action=null
番号選択 (「1件目」「最初」「それ」): 直前の選択肢から選択
詳細要求 (「詳しく」「もう一回」): 直前のActionを再実行・詳細

【コンテキスト解釈ガイド】
- 「ダッシュボード」「トップ」→ console.go_dashboard
- 「戻って」「前の画面」→ console.go_back
- 「案件」「案件管理」→ console.open_projects
- 「案件依頼」「見積依頼」→ console.open_project_requests
- 「顧客」「クライアント」→ console.open_clients
- 「従業員」「スタッフ」→ console.open_employees
- 「協力業者」「パートナー」→ console.open_partners
- 「シフト」「勤務」→ console.open_shifts
- 「勤怠」「出勤記録」→ console.open_attendance
- 「経費」「申請」→ console.open_expenses または console.get_pending_expenses
- 「請求」「見積書」→ console.open_invoices
- 「通知」→ console.open_notifications または console.get_notifications
- 「品質」「評価」→ console.open_quality
- 「マニュアル」→ console.open_manuals
- 「報告書」「レポート」→ console.open_reports
- 「分析」「AI分析」→ console.open_analytics
- 「在庫」→ console.open_inventory
- 「契約」→ console.open_contracts
- 「設定」→ console.open_settings

【voiceReplyの書き方】
- 短く・自然に（音声なので長文禁止）
- 例: 「案件管理を開きます」「承認待ちの経費が3件あります」

【出力形式】
{
  "action": "console.xxx" または null,
  "confidence": 0.0〜1.0,
  "params": {},
  "voiceReply": "JARVISの返答（1〜2文）または null"
}`.trim()
}

export async function POST(req: NextRequest) {
  // CONSOLE Admin認証（getAuthContext = hk_c_uid / hk_c_at）
  const auth = await getAuthContext()
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    utterance?:        string
    currentPath?:      string
    recentMessages?:   Array<{ role: string; content: string }>
    lastIntent?:       string
    lastResultData?:   { type: string; items?: Array<{ id: string; label: string }> }
  }
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 })
  }

  const { utterance, currentPath, recentMessages, lastIntent, lastResultData } = body

  if (!utterance?.trim()) {
    return Response.json({ error: 'utterance required' }, { status: 400 })
  }

  const actionList   = buildConsoleActionListForPrompt()
  const systemPrompt = buildConsoleIntentPrompt(actionList, {
    recentMessages: recentMessages?.slice(-6),
    lastIntent,
    lastResultData,
  })

  const userMessage = [
    `発話: "${utterance.trim()}"`,
    currentPath ? `現在のパス: ${currentPath}` : '',
  ].filter(Boolean).join('\n')

  try {
    const openai = createOpenAIClient()
    const completion = await openai.chat.completions.create({
      model:           'gpt-4o-mini' as const,  // CONSOLE共有libにMINIなし
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userMessage  },
      ],
      temperature:     0.1,
      max_tokens:      200,
      response_format: { type: 'json_object' },
    })

    const raw = completion.choices[0]?.message?.content ?? '{}'
    let parsed: { action?: string; confidence?: number; params?: Record<string, string>; voiceReply?: string }
    try {
      parsed = JSON.parse(raw)
    } catch {
      return Response.json({ action: null, confidence: 0, params: {}, voiceReply: null })
    }

    const actionName = parsed.action

    // Registry外のAction → 拒否
    if (actionName && !isValidConsoleAction(actionName)) {
      return Response.json({ action: null, confidence: 0, params: {}, voiceReply: null })
    }

    // L3以上 → 拒否（DAY2で追加予定）
    if (actionName && isValidConsoleAction(actionName) && getConsoleActionLevel(actionName) >= 3) {
      return Response.json({
        action: null, confidence: 0, params: {},
        voiceReply: 'この操作はまだ音声で対応していません。画面から操作してください。',
      })
    }

    return Response.json({
      action:     actionName ?? null,
      confidence: parsed.confidence ?? 0,
      params:     parsed.params     ?? {},
      voiceReply: parsed.voiceReply ?? null,
    })
  } catch (err) {
    console.error('[console/intent]', err instanceof Error ? err.message : err)
    return Response.json({ action: null, confidence: 0, params: {}, voiceReply: null }, { status: 500 })
  }
}
