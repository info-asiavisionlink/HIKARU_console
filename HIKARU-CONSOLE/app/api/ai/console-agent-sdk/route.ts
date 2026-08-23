import { NextRequest } from 'next/server'
import { run }           from '@openai/agents'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { consoleJarvisAgent, type ConsoleAgentSDKContext } from '@/lib/voice/agent/console-sdk-agent'
import type { ConsoleAgentApiResponse } from '@/lib/voice/agent/types'

// ============================================================
// POST /api/ai/console-agent-sdk — CONSOLE JARVIS Agent (Agents SDK)
// 認証: CONSOLE Admin（getAuthContext）
// System Agent とは完全分離。
// ============================================================

export const maxDuration = 30

export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    utterance?:          string
    currentPath?:        string
    recentMessages?:     Array<{ role: string; content: string }>
    lastIntent?:         string
    lastResultData?:     { type: string; items?: Array<{ id: string; label: string }> }
    previousResponseId?: string
  }
  try { body = await req.json() }
  catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }) }

  const { utterance, currentPath = '/dashboard', recentMessages, lastIntent, lastResultData, previousResponseId } = body

  if (!utterance?.trim()) {
    return Response.json({ error: 'utterance required' }, { status: 400 })
  }

  const origin      = req.headers.get('origin') || req.nextUrl.origin
  const baseUrl     = origin.startsWith('http') ? origin : `https://${origin}`
  const cookieHeader = req.headers.get('cookie') ?? ''

  const agentCtx: ConsoleAgentSDKContext = {
    userId:      auth.userId,
    companyId:   auth.companyId,
    cookieHeader,
    baseUrl,
  }

  let contextAddendum = ''
  if (lastResultData?.items?.length) {
    contextAddendum += '\n【直前の選択肢】\n'
    lastResultData.items.forEach(item => { contextAddendum += `  ${item.label} → ID: ${item.id}\n` })
  }
  if (lastIntent) contextAddendum += `\n【直前のAction】: ${lastIntent}`
  if (recentMessages?.length) {
    contextAddendum += '\n【直近の会話】\n'
    recentMessages.slice(-4).forEach(m => {
      contextAddendum += `${m.role === 'user' ? 'Admin' : 'JARVIS'}: ${m.content}\n`
    })
  }

  const inputText = [
    `発話: "${utterance.trim()}"`,
    `現在のパス: ${currentPath}`,
    contextAddendum,
  ].filter(Boolean).join('\n')

  try {
    const result = await run(consoleJarvisAgent, inputText, {
      maxTurns:          3,
      context:           agentCtx,
      previousResponseId: previousResponseId ?? undefined,
    })

    const finalOutput = result.finalOutput ?? ''
    let navigateAction: string | null = null
    let navigateDetail: { entity: string; entity_id: string } | null = null
    let pendingConfirmation: Record<string, unknown> | null = null

    for (const item of result.newItems ?? []) {
      if (item.type === 'tool_call_output_item') {
        try {
          const output = typeof item.output === 'string' ? item.output : ''
          const parsed = JSON.parse(output)
          if (parsed.__navigate && parsed.action) navigateAction = parsed.action
          if (parsed.__navigate_detail && parsed.entity && parsed.entity_id) {
            navigateDetail = { entity: parsed.entity, entity_id: parsed.entity_id }
          }
          if (parsed.__pendingConfirmation) {
            pendingConfirmation = {
              action:      parsed.action,
              params:      parsed.params ?? {},
              safetyLevel: parsed.safetyLevel,
              message:     parsed.message,
              expiresAt:   parsed.expiresAt,
            }
          }
        } catch {}
      }
    }

    return Response.json({
      action:              navigateAction,
      confidence:          navigateAction ? 1.0 : 0,
      params:              {},
      voiceReply:          finalOutput || null,
      pendingApproval:     false,
      pendingConfirmation: pendingConfirmation ?? undefined,
      navigateDetail:      navigateDetail ?? undefined,
      previousResponseId:  result.lastResponseId,
    } satisfies ConsoleAgentApiResponse & {
      pendingApproval?:    boolean
      pendingConfirmation?: Record<string, unknown>
      navigateDetail?:     { entity: string; entity_id: string }
      previousResponseId?: string
    })

  } catch (err) {
    console.error('[console-agent-sdk]', err instanceof Error ? err.message : err)
    return Response.json({
      action: null, confidence: 0, params: {}, voiceReply: null, error: 'agent_failed',
    }, { status: 500 })
  }
}
