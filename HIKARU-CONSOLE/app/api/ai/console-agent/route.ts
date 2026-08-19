import { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { createOpenAIClient, OPENAI_MODELS } from '@/lib/openai/client'
import { isValidConsoleAction, getConsoleActionLevel } from '@/lib/voice/registry/console.actions'
import { CONSOLE_AGENT_TOOLS, toOpenAITools } from '@/lib/voice/agent/console.tools'
import type { ConsoleAgentContext, ConsoleAgentApiResponse } from '@/lib/voice/agent/types'

// ============================================================
// POST /api/ai/console-agent — CONSOLE JARVIS Agent
// 認証: CONSOLE Admin（getAuthContext）
// 複数Tool呼び出しによる多段データ取得 → 自然な回答生成
// System Agent とは完全分離。Admin業務Context専用。
// DBへの書き込みなし（Read-only Tools + Navigation提案のみ）
// ============================================================

export const maxDuration = 30

const MAX_TOOL_STEPS = 5

const SYSTEM_PROMPT = `あなたはHIKARU Console管理者アシスタント「JARVIS」です。
清掃業務管理システムの管理者・マネージャーをサポートする音声アシスタントです。

## 役割
- 案件・顧客・従業員・協力業者の状況確認
- 承認待ち経費・勤怠修正の件数確認
- シフト・勤怠・品質・報告書の管理支援
- 必要なページへのナビゲーション提案

## 重要なルール
- Toolで取得した情報のみを事実として扱う
- Read-only Toolは必要に応じて連続使用可（最大${MAX_TOOL_STEPS}回）
- 承認・変更・削除などのWrite操作は現在対応していない（DAY2で追加予定）
- NavigationはNavigate Toolを通じて提案する

## 返答スタイル（音声向け）
- 結論から先に伝える
- 重要情報のみ（件数・金額・人名）
- 2〜3文以内で簡潔に
- 次のActionが明らかな場合のみ提案する

## Navigate Toolの使い方
navigate Toolを呼ぶとき action には以下を使用:
- console.go_dashboard, console.go_back
- console.open_projects, console.open_project_requests
- console.open_clients, console.open_employees, console.open_partners
- console.open_shifts, console.open_attendance
- console.open_expenses, console.open_invoices
- console.open_notifications, console.open_quality
- console.open_manuals, console.open_reports
- console.open_analytics, console.open_inventory
- console.open_contracts, console.open_settings
`

export async function POST(req: NextRequest) {
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
  try { body = await req.json() }
  catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }) }

  const { utterance, currentPath = '/dashboard', recentMessages, lastIntent, lastResultData } = body

  if (!utterance?.trim()) {
    return Response.json({ error: 'utterance required' }, { status: 400 })
  }

  const origin      = req.headers.get('origin') || req.nextUrl.origin
  const baseUrl     = origin.startsWith('http') ? origin : `https://${origin}`
  const cookieHeader = req.headers.get('cookie') ?? ''

  const agentCtx: ConsoleAgentContext = {
    userId:      auth.userId,
    companyId:   auth.companyId,
    currentPath,
    cookieHeader,
    baseUrl,
  }

  const messages: Array<{ role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_call_id?: string; name?: string }> = []

  if (recentMessages?.length) {
    for (const m of recentMessages.slice(-6)) {
      messages.push({ role: m.role as 'user' | 'assistant', content: m.content })
    }
  }

  let contextAddendum = ''
  if (lastResultData?.items?.length) {
    contextAddendum += '\n【直前の選択肢】\n'
    lastResultData.items.forEach(item => { contextAddendum += `  ${item.label} → ID: ${item.id}\n` })
  }
  if (lastIntent) contextAddendum += `\n【直前のAction】: ${lastIntent}`

  const userContent = [
    `発話: "${utterance.trim()}"`,
    `現在のパス: ${currentPath}`,
    contextAddendum,
  ].filter(Boolean).join('\n')

  messages.push({ role: 'user', content: userContent })

  const openai      = createOpenAIClient()
  const openaiTools = toOpenAITools(CONSOLE_AGENT_TOOLS)

  let steps = 0
  let lastNavigateAction: string | null = null
  let finalResultData: ConsoleAgentApiResponse['resultData'] | undefined

  const allMessages = [{ role: 'system' as const, content: SYSTEM_PROMPT }, ...messages]

  while (steps < MAX_TOOL_STEPS) {
    let completion
    try {
      completion = await openai.chat.completions.create({
        model:       OPENAI_MODELS.CHAT,
        messages:    allMessages as any,
        tools:       openaiTools,
        tool_choice: 'auto',
        temperature: 0.3,
        max_tokens:  600,
      })
    } catch (err) {
      console.error('[console-agent] OpenAI error:', err instanceof Error ? err.message : err)
      return Response.json({
        action: null, confidence: 0, params: {}, voiceReply: 'AIに接続できませんでした。しばらくしてから再度お試しください。',
      })
    }

    const choice  = completion.choices[0]
    const message = choice?.message

    if (!message) break

    if (message.tool_calls?.length) {
      allMessages.push({ role: 'assistant', content: message.content ?? '', ...({ tool_calls: message.tool_calls } as any) })

      for (const tc of message.tool_calls) {
        const toolName = tc.function.name
        const tool     = CONSOLE_AGENT_TOOLS.find(t => t.name === toolName)

        let resultText = `Tool "${toolName}" not found`
        if (tool) {
          if (tool.safetyLevel >= 3) {
            resultText = 'この操作は現在許可されていません。'
          } else {
            let params: Record<string, string> = {}
            try { params = JSON.parse(tc.function.arguments) } catch {}
            try {
              const result = await tool.execute(params, agentCtx)
              resultText = result.text

              if (toolName === 'navigate' && result.data?.action) {
                lastNavigateAction = result.data.action as string
              }

              if (result.items?.length) {
                const typeMap: Record<string, ConsoleAgentApiResponse['resultData']> = {
                  get_projects:         { type: 'project_list',  items: result.items },
                  get_notifications:    { type: 'notification_list', items: result.items },
                  get_pending_expenses: { type: 'expense_list',  items: result.items },
                }
                if (typeMap[toolName]) finalResultData = typeMap[toolName]
              }
            } catch (err) {
              resultText = 'Toolの実行中にエラーが発生しました。'
              console.error(`[console-agent] Tool ${toolName} error:`, err)
            }
          }
        }

        allMessages.push({
          role:         'tool',
          content:      resultText,
          tool_call_id: tc.id,
          name:         toolName,
        } as any)
      }

      steps++
      continue
    }

    const voiceReply = message.content?.trim() ?? null

    if (lastNavigateAction) {
      const actionName = lastNavigateAction
      if (isValidConsoleAction(actionName) && getConsoleActionLevel(actionName) <= 2) {
        return Response.json({
          action:     actionName,
          confidence: 1.0,
          params:     {},
          voiceReply,
          resultData: finalResultData,
        } satisfies ConsoleAgentApiResponse)
      }
    }

    return Response.json({
      action:     null,
      confidence: 0,
      params:     {},
      voiceReply,
      resultData: finalResultData,
    } satisfies ConsoleAgentApiResponse)
  }

  return Response.json({
    action: null, confidence: 0, params: {},
    voiceReply: '情報を確認しましたが、もう少し具体的に教えていただけますか？',
    resultData: finalResultData,
  } satisfies ConsoleAgentApiResponse)
}
