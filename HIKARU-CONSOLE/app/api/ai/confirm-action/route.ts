import { NextRequest } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { isValidConsoleAction, getConsoleActionLevel } from '@/lib/voice/registry/console.actions'
import { logConsoleAudit } from '@/lib/voice/agent/audit'

// ============================================================
// POST /api/ai/confirm-action — CONSOLE JARVIS Confirmed Action
// 管理者が「はい」で承認した後、Serverで全権限を再検証して実行。
// clientから受け取るaction/paramsのみ利用。
// company_id / userId / role はgetAuthContextから取得（Client値信用禁止）。
// ============================================================

export const maxDuration = 15

const CONFIRMATION_EXPIRY_MS = 5 * 60 * 1000

export async function POST(req: NextRequest) {
  const auth = await getAuthContext()
  if (!auth) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: {
    action?:      string
    params?:      Record<string, string>
    safetyLevel?: number
    expiresAt?:   number
  }
  try { body = await req.json() }
  catch { return Response.json({ error: 'invalid JSON' }, { status: 400 }) }

  const { action, params = {}, expiresAt } = body

  if (!action) return Response.json({ error: 'action required' }, { status: 400 })
  if (!isValidConsoleAction(action)) return Response.json({ error: 'invalid action' }, { status: 400 })

  const level = getConsoleActionLevel(action)
  if (level < 3) return Response.json({ error: 'no confirmation required' }, { status: 400 })

  if (level >= 5) {
    logConsoleAudit({
      source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
      companyId: auth.companyId, action, safetyLevel: level,
      confirmed: true, result: 'rejected', reason: 'L5 blocked',
    })
    return Response.json({
      error: 'この操作は音声では実行できません。管理画面から操作してください。',
      blocked: true,
    }, { status: 403 })
  }

  if (expiresAt && Date.now() > expiresAt) {
    return Response.json({
      error: '確認の有効期限が切れました。もう一度操作してください。',
      expired: true,
    }, { status: 400 })
  }

  if (expiresAt && expiresAt > Date.now() + CONFIRMATION_EXPIRY_MS) {
    return Response.json({ error: '無効なexpiresAt' }, { status: 400 })
  }

  try {
    switch (action) {
      // ─── L4: update_project_status ───────────────────────
      case 'console.update_project_status': {
        const { projectId, status } = params
        if (!projectId) return Response.json({ error: 'projectId required' }, { status: 400 })
        if (!status)    return Response.json({ error: 'status required' }, { status: 400 })

        const VALID_STATUSES = ['active', 'paused', 'completed', 'cancelled']
        if (!VALID_STATUSES.includes(status)) {
          return Response.json({ error: `statusはactive/paused/completed/cancelledのみ変更可能です` }, { status: 400 })
        }

        const res = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: req.headers.get('cookie') ?? '' },
          body:    JSON.stringify({ status }),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'project', resourceId: projectId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? 'ステータス変更に失敗しました。' }, { status: res.status })

        // Read-back: DB上のstatusを確認してからsuccessとする
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}`, {
          headers: { Cookie: req.headers.get('cookie') ?? '' },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          if (verifyData?.project?.status !== status) {
            return Response.json({ error: 'ステータス変更を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        const STATUS_LABELS: Record<string, string> = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル' }
        return Response.json({ success: true, voiceReply: `案件を${STATUS_LABELS[status] ?? status}に変更しました。` })
      }

      // ─── L4: create_project ───────────────────────────────
      case 'console.create_project': {
        const { name, project_type, start_date, end_date, location_name } = params
        if (!name?.trim()) return Response.json({ error: '案件名は必須です' }, { status: 400 })

        const validTypes = ['spot', 'recurring', 'hotel']
        const pType = project_type && validTypes.includes(project_type) ? project_type : 'spot'

        const body: Record<string, string | null | undefined> = {
          name:          name.trim(),
          project_type:  pType,
          start_date:    start_date    || null,
          end_date:      end_date      || null,
          location_name: location_name || null,
        }

        const res = await fetch(`${req.nextUrl.origin}/api/projects`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: req.headers.get('cookie') ?? '' },
          body:    JSON.stringify(body),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'project',
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '案件登録に失敗しました。' }, { status: res.status })

        const projectId = data?.project?.id
        if (!projectId) return Response.json({ error: '案件IDを取得できませんでした。' }, { status: 500 })

        // Read-back: 作成確認
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}`, {
          headers: { Cookie: req.headers.get('cookie') ?? '' },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          if (!verifyData?.project?.id) {
            return Response.json({ error: '案件登録を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        return Response.json({ success: true, voiceReply: `案件「${name.trim()}」を登録しました。` })
      }

      // ─── L4: approve_expense ──────────────────────────────
      case 'console.approve_expense': {
        const { expenseId } = params
        if (!expenseId) return Response.json({ error: 'expenseId required' }, { status: 400 })

        const res = await fetch(`${req.nextUrl.origin}/api/expenses/${expenseId}/approve`, {
          method:  'POST',
          headers: { Cookie: req.headers.get('cookie') ?? '' },
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'expense', resourceId: expenseId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '経費申請の承認に失敗しました。' }, { status: res.status })

        // Read-back: DB上のstatusを確認してからsuccessとする（FAKE_SUCCESS防止）
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/expenses/${expenseId}`, {
          headers: { Cookie: req.headers.get('cookie') ?? '' },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          if (verifyData?.expense?.status !== 'approved') {
            return Response.json({ error: '承認処理を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }
        return Response.json({ success: true, voiceReply: '経費申請を承認しました。' })
      }

      // ─── L4: reject_expense ───────────────────────────────
      case 'console.reject_expense': {
        const { expenseId, reject_reason } = params
        if (!expenseId) return Response.json({ error: 'expenseId required' }, { status: 400 })
        if (!reject_reason?.trim()) return Response.json({ error: '却下理由は必須です' }, { status: 400 })

        const res = await fetch(`${req.nextUrl.origin}/api/expenses/${expenseId}/reject`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: req.headers.get('cookie') ?? '' },
          body:    JSON.stringify({ reject_reason: reject_reason.trim() }),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'expense', resourceId: expenseId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '経費申請の却下に失敗しました。' }, { status: res.status })

        // Read-back: DB上のstatusを確認してからsuccessとする（FAKE_SUCCESS防止）
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/expenses/${expenseId}`, {
          headers: { Cookie: req.headers.get('cookie') ?? '' },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          if (verifyData?.expense?.status !== 'rejected') {
            return Response.json({ error: '却下処理を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }
        return Response.json({ success: true, voiceReply: '経費申請を却下しました。' })
      }

      // ─── L4: approve_attendance ───────────────────────────
      case 'console.approve_attendance': {
        const { correctionId } = params
        if (!correctionId) return Response.json({ error: 'correctionId required' }, { status: 400 })

        const res = await fetch(`${req.nextUrl.origin}/api/attendance/corrections/${correctionId}/approve`, {
          method:  'POST',
          headers: { Cookie: req.headers.get('cookie') ?? '' },
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'attendance_correction', resourceId: correctionId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '勤怠修正申請の承認に失敗しました。' }, { status: res.status })
        return Response.json({ success: true, voiceReply: '勤怠修正申請を承認しました。' })
      }

      default:
        return Response.json({ error: 'unsupported action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[console-confirm-action]', err)
    return Response.json({ error: '処理中にエラーが発生しました。' }, { status: 500 })
  }
}
