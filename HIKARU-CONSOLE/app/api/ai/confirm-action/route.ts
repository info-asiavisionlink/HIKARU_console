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

  // 時刻正規化: HH:MM → HH:MM:SS（APIはHH:MM:SS形式）
  const normTime = (t: string): string => {
    const parts = t.trim().split(':')
    if (parts.length === 2) return `${t.trim()}:00`
    return t.trim()
  }

  try {
    switch (action) {
      // ─── L4: create_shift ────────────────────────────────
      case 'console.create_shift': {
        const { projectId, assignee_type, assignee_id, assignee_name, project_name,
                shift_date, start_time, end_time, notes } = params
        if (!projectId)    return Response.json({ error: 'projectId required' },    { status: 400 })
        if (!assignee_type || !['employee', 'partner'].includes(assignee_type))
          return Response.json({ error: 'assignee_type must be employee or partner' }, { status: 400 })
        if (!assignee_id)  return Response.json({ error: 'assignee_id required' },  { status: 400 })
        if (!shift_date)   return Response.json({ error: 'shift_date required' },   { status: 400 })
        if (!start_time)   return Response.json({ error: 'start_time required' },   { status: 400 })
        if (!end_time)     return Response.json({ error: 'end_time required' },     { status: 400 })

        const cookie = req.headers.get('cookie') ?? ''
        const st = normTime(start_time)
        const et = normTime(end_time)

        // 重複チェック（管理者は上書き可能だが、Voice事前報告）
        const oq = new URLSearchParams({
          assignee_type, assignee_id,
          date: shift_date,
          start: start_time.slice(0, 5),
          end:   end_time.slice(0, 5),
        })
        const overlapRes = await fetch(`${req.nextUrl.origin}/api/shifts/overlap?${oq}`, {
          headers: { Cookie: cookie },
        })
        if (overlapRes.ok) {
          const overlapData = await overlapRes.json()
          const overlaps: any[] = overlapData.overlaps ?? []
          if (overlaps.length > 0) {
            const ov = overlaps[0]
            const name = assignee_name ?? '担当者'
            return Response.json({
              error: `${name}は${shift_date}の${ov.start_time?.slice(0, 5) ?? ''}〜${ov.end_time?.slice(0, 5) ?? ''}に「${ov.project_name ?? '別案件'}」のシフトがすでにあります。時間を変更してください。`,
              conflict: true,
            }, { status: 409 })
          }
        }

        const createBody: Record<string, unknown> = {
          project_id:   projectId,
          assignee_type,
          shift_date,
          start_time:   st,
          end_time:     et,
        }
        createBody[assignee_type === 'employee' ? 'employee_id' : 'partner_id'] = assignee_id
        if (notes?.trim()) createBody.notes = notes.trim()

        const res  = await fetch(`${req.nextUrl.origin}/api/shifts`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify(createBody),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed', resourceType: 'shift',
        })
        if (!res.ok) return Response.json({ error: data?.error ?? 'シフト登録に失敗しました。' }, { status: res.status })

        const shiftId = data?.shift?.id
        if (!shiftId) return Response.json({ error: 'シフトIDを取得できませんでした。' }, { status: 500 })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/shifts/${shiftId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const s = verifyData?.shift
          if (!s?.id || s.shift_date !== shift_date) {
            return Response.json({ error: 'シフト登録を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        const name    = assignee_name ?? '担当者'
        const projName = project_name ?? 'シフト'
        return Response.json({ success: true, voiceReply: `${name}を${projName}に${shift_date} ${start_time.slice(0, 5)}〜${end_time.slice(0, 5)}で登録しました。` })
      }

      // ─── L4: update_shift ────────────────────────────────
      case 'console.update_shift': {
        const { shiftId, shift_date, start_time, end_time, notes,
                assignee_type, assignee_id, assignee_name, project_id } = params
        if (!shiftId) return Response.json({ error: 'shiftId required' }, { status: 400 })

        const cookie = req.headers.get('cookie') ?? ''

        // 現在のシフトを取得（重複チェックと変更確認のため）
        const currentRes = await fetch(`${req.nextUrl.origin}/api/shifts/${shiftId}`, {
          headers: { Cookie: cookie },
        })
        if (!currentRes.ok) return Response.json({ error: 'シフトが見つかりませんでした。' }, { status: 404 })
        const current = (await currentRes.json())?.shift
        if (!current) return Response.json({ error: 'シフトが見つかりませんでした。' }, { status: 404 })

        // 変更フィールドを構築
        const ALLOWED_SHIFT_FIELDS = ['project_id', 'assignee_type', 'employee_id', 'partner_id', 'shift_date', 'start_time', 'end_time', 'notes'] as const
        const updateBody: Record<string, unknown> = {}
        if (shift_date) updateBody.shift_date = shift_date
        if (start_time) updateBody.start_time = normTime(start_time)
        if (end_time)   updateBody.end_time   = normTime(end_time)
        if (notes !== undefined) updateBody.notes = notes?.trim() || null
        if (project_id) updateBody.project_id = project_id
        if (assignee_type && assignee_id) {
          updateBody.assignee_type = assignee_type
          updateBody[assignee_type === 'employee' ? 'employee_id' : 'partner_id'] = assignee_id
          updateBody[assignee_type === 'employee' ? 'partner_id' : 'employee_id'] = null
        }

        if (Object.keys(updateBody).length === 0) {
          return Response.json({ error: '変更するフィールドがありません。' }, { status: 400 })
        }

        // 時間・日付・担当者変更時は重複チェック
        const checkAssigneeType = (assignee_type ?? current.assignee_type) as string
        const checkAssigneeId   = assignee_id ?? (current.assignee_type === 'employee' ? current.employee_id : current.partner_id)
        const checkDate  = shift_date  ?? current.shift_date
        const checkStart = start_time  ?? current.start_time?.slice(0, 5)
        const checkEnd   = end_time    ?? current.end_time?.slice(0, 5)

        if (shift_date || start_time || end_time || assignee_id) {
          const oq = new URLSearchParams({
            assignee_type: checkAssigneeType, assignee_id: checkAssigneeId,
            date: checkDate,
            start: checkStart.slice(0, 5),
            end:   checkEnd.slice(0, 5),
            exclude_id: shiftId,
          })
          const overlapRes = await fetch(`${req.nextUrl.origin}/api/shifts/overlap?${oq}`, {
            headers: { Cookie: cookie },
          })
          if (overlapRes.ok) {
            const overlapData = await overlapRes.json()
            const overlaps: any[] = overlapData.overlaps ?? []
            if (overlaps.length > 0) {
              const ov = overlaps[0]
              const name = assignee_name ?? current.employees?.name ?? current.partners?.company_name ?? '担当者'
              return Response.json({
                error: `${name}は${checkDate}の${ov.start_time?.slice(0, 5)}〜${ov.end_time?.slice(0, 5)}に「${ov.project_name ?? '別案件'}」のシフトがあります。時間を変更してください。`,
                conflict: true,
              }, { status: 409 })
            }
          }
        }

        const res  = await fetch(`${req.nextUrl.origin}/api/shifts/${shiftId}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify(updateBody),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'shift', resourceId: shiftId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? 'シフトの変更に失敗しました。' }, { status: res.status })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/shifts/${shiftId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const s = verifyData?.shift
          if (s && shift_date && s.shift_date !== shift_date) {
            return Response.json({ error: 'シフトの変更を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        const changedParts: string[] = []
        if (shift_date)  changedParts.push(`日付を${shift_date}に`)
        if (start_time)  changedParts.push(`開始を${start_time.slice(0, 5)}に`)
        if (end_time)    changedParts.push(`終了を${end_time.slice(0, 5)}に`)
        if (assignee_name) changedParts.push(`担当を${assignee_name}に`)

        return Response.json({
          success:    true,
          voiceReply: changedParts.length > 0 ? `${changedParts.join('、')}変更しました。` : 'シフトを更新しました。',
        })
      }

      // ─── L4: cancel_shift ────────────────────────────────
      case 'console.cancel_shift': {
        const { shiftId, assignee_name, shift_date } = params
        if (!shiftId) return Response.json({ error: 'shiftId required' }, { status: 400 })

        const cookie = req.headers.get('cookie') ?? ''

        // 現在のシフト確認
        const currentRes = await fetch(`${req.nextUrl.origin}/api/shifts/${shiftId}`, {
          headers: { Cookie: cookie },
        })
        if (!currentRes.ok) return Response.json({ error: 'シフトが見つかりませんでした。' }, { status: 404 })
        const current = (await currentRes.json())?.shift
        if (!current) return Response.json({ error: 'シフトが見つかりませんでした。' }, { status: 404 })
        if (current.status === 'cancelled')
          return Response.json({ error: 'このシフトはすでに取り消し済みです。' }, { status: 400 })
        if (current.status === 'completed')
          return Response.json({ error: '完了済みのシフトは取り消せません。' }, { status: 400 })

        const res  = await fetch(`${req.nextUrl.origin}/api/shifts/${shiftId}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify({ status: 'cancelled' }),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'shift', resourceId: shiftId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? 'シフトの取り消しに失敗しました。' }, { status: res.status })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/shifts/${shiftId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          if (verifyData?.shift?.status !== 'cancelled') {
            return Response.json({ error: 'シフトの取り消しを確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        const name = assignee_name ?? current.employees?.name ?? current.partners?.company_name ?? '担当者'
        const date = shift_date ?? current.shift_date ?? ''
        return Response.json({ success: true, voiceReply: `${name}の${date}のシフトを取り消しました。` })
      }

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
        const { name, project_type, start_date, end_date, location_name, client_id, store_id, address, notes } = params
        if (!name?.trim()) return Response.json({ error: '案件名は必須です' }, { status: 400 })

        const validTypes = ['spot', 'recurring', 'hotel']
        const pType = project_type && validTypes.includes(project_type) ? project_type : 'spot'

        const createBody: Record<string, string | null> = {
          name:          name.trim(),
          project_type:  pType,
          start_date:    start_date    || null,
          end_date:      end_date      || null,
          location_name: location_name || null,
          client_id:     client_id     || null,
          store_id:      store_id      || null,
          address:       address       || null,
          notes:         notes         || null,
        }
        // null値のキーを削除（不要なnullをAPIへ送らない）
        for (const k of Object.keys(createBody)) {
          if (createBody[k] === null) delete createBody[k]
        }

        const res = await fetch(`${req.nextUrl.origin}/api/projects`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: req.headers.get('cookie') ?? '' },
          body:    JSON.stringify(createBody),
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

        // Read-back: 作成確認 + 送信フィールドと照合
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}`, {
          headers: { Cookie: req.headers.get('cookie') ?? '' },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          if (!verifyData?.project?.id) {
            return Response.json({ error: '案件登録を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
          const p = verifyData.project
          if (p.name !== name.trim() || p.project_type !== pType) {
            return Response.json({ error: '案件登録の内容を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        return Response.json({ success: true, voiceReply: `案件「${name.trim()}」を登録しました。` })
      }

      // ─── L4: add_assignment ──────────────────────────────
      case 'console.add_assignment': {
        const { projectId, assignee_type, assignee_id, assignee_name } = params
        if (!projectId)    return Response.json({ error: 'projectId required' }, { status: 400 })
        if (!assignee_type || !['employee', 'partner'].includes(assignee_type))
          return Response.json({ error: 'assignee_type must be employee or partner' }, { status: 400 })
        if (!assignee_id)  return Response.json({ error: 'assignee_id required' }, { status: 400 })

        const cookie = req.headers.get('cookie') ?? ''

        const currentRes = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}/assignments`, {
          headers: { Cookie: cookie },
        })
        if (!currentRes.ok) return Response.json({ error: '現在の担当者情報を取得できませんでした。' }, { status: 500 })
        const currentData = await currentRes.json()
        const current: { assignee_type: string; assignee_id: string }[] = currentData.data ?? []

        if (current.some(a => a.assignee_type === assignee_type && a.assignee_id === assignee_id)) {
          return Response.json({ error: `${assignee_name ?? '対象の担当者'}はすでにこの案件の担当です。` }, { status: 400 })
        }

        const newAssignments = [...current, { assignee_type, assignee_id }]
        const putRes = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}/assignments`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify({ assignments: newAssignments }),
        })
        const putData = await putRes.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: putRes.ok ? 'success' : 'failed',
          resourceType: 'project_assignment', resourceId: projectId,
        })
        if (!putRes.ok) return Response.json({ error: putData?.error ?? '担当者の追加に失敗しました。' }, { status: putRes.status })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}/assignments`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const found = (verifyData.data ?? []).some((a: any) => a.assignee_type === assignee_type && a.assignee_id === assignee_id)
          if (!found) {
            return Response.json({ error: '担当者の追加を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        return Response.json({ success: true, voiceReply: `${assignee_name ?? '担当者'}をこの案件に追加しました。` })
      }

      // ─── L4: remove_assignment ───────────────────────────
      case 'console.remove_assignment': {
        const { projectId, assignee_type, assignee_id, assignee_name } = params
        if (!projectId)   return Response.json({ error: 'projectId required' }, { status: 400 })
        if (!assignee_type || !['employee', 'partner'].includes(assignee_type))
          return Response.json({ error: 'assignee_type must be employee or partner' }, { status: 400 })
        if (!assignee_id) return Response.json({ error: 'assignee_id required' }, { status: 400 })

        const cookie = req.headers.get('cookie') ?? ''

        const currentRes = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}/assignments`, {
          headers: { Cookie: cookie },
        })
        if (!currentRes.ok) return Response.json({ error: '現在の担当者情報を取得できませんでした。' }, { status: 500 })
        const currentData = await currentRes.json()
        const current: { assignee_type: string; assignee_id: string }[] = currentData.data ?? []

        if (!current.some(a => a.assignee_type === assignee_type && a.assignee_id === assignee_id)) {
          return Response.json({ error: `${assignee_name ?? '対象の担当者'}はこの案件の担当ではありません。` }, { status: 400 })
        }

        const newAssignments = current.filter(a => !(a.assignee_type === assignee_type && a.assignee_id === assignee_id))
        const putRes = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}/assignments`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify({ assignments: newAssignments }),
        })
        const putData = await putRes.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: putRes.ok ? 'success' : 'failed',
          resourceType: 'project_assignment', resourceId: projectId,
        })
        if (!putRes.ok) return Response.json({ error: putData?.error ?? '担当者の解除に失敗しました。' }, { status: putRes.status })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}/assignments`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const stillExists = (verifyData.data ?? []).some((a: any) => a.assignee_type === assignee_type && a.assignee_id === assignee_id)
          if (stillExists) {
            return Response.json({ error: '担当者の解除を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        return Response.json({ success: true, voiceReply: `${assignee_name ?? '担当者'}をこの案件の担当から外しました。` })
      }

      // ─── L4: replace_assignment ──────────────────────────
      case 'console.replace_assignment': {
        const { projectId, from_type, from_id, from_name, to_type, to_id, to_name } = params
        if (!projectId) return Response.json({ error: 'projectId required' }, { status: 400 })
        if (!from_type || !['employee', 'partner'].includes(from_type))
          return Response.json({ error: 'from_type must be employee or partner' }, { status: 400 })
        if (!to_type || !['employee', 'partner'].includes(to_type))
          return Response.json({ error: 'to_type must be employee or partner' }, { status: 400 })
        if (!from_id || !to_id) return Response.json({ error: 'from_id and to_id required' }, { status: 400 })

        const cookie = req.headers.get('cookie') ?? ''

        const currentRes = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}/assignments`, {
          headers: { Cookie: cookie },
        })
        if (!currentRes.ok) return Response.json({ error: '現在の担当者情報を取得できませんでした。' }, { status: 500 })
        const currentData = await currentRes.json()
        const current: { assignee_type: string; assignee_id: string }[] = currentData.data ?? []

        if (!current.some(a => a.assignee_type === from_type && a.assignee_id === from_id)) {
          return Response.json({ error: `${from_name ?? '変更前の担当者'}はこの案件の担当ではありません。` }, { status: 400 })
        }
        if (current.some(a => a.assignee_type === to_type && a.assignee_id === to_id)) {
          return Response.json({ error: `${to_name ?? '変更後の担当者'}はすでにこの案件の担当です。` }, { status: 400 })
        }

        const newAssignments = current
          .filter(a => !(a.assignee_type === from_type && a.assignee_id === from_id))
          .concat([{ assignee_type: to_type, assignee_id: to_id }])

        const putRes = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}/assignments`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify({ assignments: newAssignments }),
        })
        const putData = await putRes.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: putRes.ok ? 'success' : 'failed',
          resourceType: 'project_assignment', resourceId: projectId,
        })
        if (!putRes.ok) return Response.json({ error: putData?.error ?? '担当者の変更に失敗しました。' }, { status: putRes.status })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}/assignments`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const updated    = verifyData.data ?? []
          const toExists   = updated.some((a: any) => a.assignee_type === to_type   && a.assignee_id === to_id)
          const fromGone   = !updated.some((a: any) => a.assignee_type === from_type && a.assignee_id === from_id)
          if (!toExists || !fromGone) {
            return Response.json({ error: '担当者の変更を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        return Response.json({ success: true, voiceReply: `担当者を${from_name ?? '変更前の方'}から${to_name ?? '変更後の方'}に変更しました。` })
      }

      // ─── L4: update_project ──────────────────────────────
      case 'console.update_project': {
        const { projectId } = params
        if (!projectId) return Response.json({ error: 'projectId required' }, { status: 400 })

        const ALLOWED_FIELDS = ['name', 'project_type', 'start_date', 'end_date', 'location_name', 'address', 'notes', 'client_id', 'store_id'] as const
        const VALID_TYPES    = ['spot', 'recurring', 'hotel']

        const updateBody: Record<string, string | null> = {}
        for (const field of ALLOWED_FIELDS) {
          const val = params[field]
          if (val === undefined) continue
          if (field === 'project_type' && !VALID_TYPES.includes(val)) continue
          updateBody[field] = val || null
        }

        if (Object.keys(updateBody).length === 0) {
          return Response.json({ error: '変更するフィールドがありません。' }, { status: 400 })
        }

        const cookie = req.headers.get('cookie') ?? ''
        const res    = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify(updateBody),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'project', resourceId: projectId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '案件の更新に失敗しました。' }, { status: res.status })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const p          = verifyData?.project
          if (p) {
            for (const [key, val] of Object.entries(updateBody)) {
              if (val !== null && p[key] !== val) {
                return Response.json({ error: '案件の更新を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
              }
            }
          }
        }

        const changedParts: string[] = []
        if (updateBody.name)          changedParts.push(`案件名を「${updateBody.name}」に`)
        if (updateBody.start_date)    changedParts.push(`開始日を${updateBody.start_date}に`)
        if (updateBody.end_date)      changedParts.push(`終了日を${updateBody.end_date}に`)
        if (updateBody.location_name) changedParts.push(`場所を「${updateBody.location_name}」に`)

        return Response.json({
          success:    true,
          voiceReply: changedParts.length > 0 ? `${changedParts.join('、')}変更しました。` : '案件情報を更新しました。',
        })
      }

      // ─── L4: create_client ───────────────────────────────
      case 'console.create_client': {
        const { name, code, phone, email, address, contact_name, notes } = params
        if (!name?.trim()) return Response.json({ error: '顧客名は必須です' }, { status: 400 })

        const createBody: Record<string, string> = { name: name.trim() }
        if (code?.trim())         createBody.code         = code.trim()
        if (phone?.trim())        createBody.phone        = phone.trim()
        if (email?.trim())        createBody.email        = email.trim()
        if (address?.trim())      createBody.address      = address.trim()
        if (contact_name?.trim()) createBody.contact_name = contact_name.trim()
        if (notes?.trim())        createBody.notes        = notes.trim()

        const cookie = req.headers.get('cookie') ?? ''
        const res    = await fetch(`${req.nextUrl.origin}/api/clients`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify(createBody),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed', resourceType: 'client',
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '顧客登録に失敗しました。' }, { status: res.status })

        const clientId = data?.client?.id
        if (!clientId) return Response.json({ error: '顧客IDを取得できませんでした。' }, { status: 500 })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/clients/${clientId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const c = verifyData?.data
          if (!c?.id || c.name !== name.trim()) {
            return Response.json({ error: '顧客登録を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        return Response.json({ success: true, voiceReply: `顧客「${name.trim()}」を登録しました。` })
      }

      // ─── L4: update_client ───────────────────────────────
      case 'console.update_client': {
        const { clientId } = params
        if (!clientId) return Response.json({ error: 'clientId required' }, { status: 400 })

        const ALLOWED_CLIENT_FIELDS = ['name', 'code', 'phone', 'email', 'address', 'contact_name', 'notes', 'is_active'] as const
        const updateBody: Record<string, string | boolean | null> = {}
        for (const field of ALLOWED_CLIENT_FIELDS) {
          const val = params[field]
          if (val === undefined) continue
          if (field === 'is_active') {
            updateBody[field] = val === 'true'
          } else {
            updateBody[field] = val || null
          }
        }
        if (Object.keys(updateBody).length === 0) {
          return Response.json({ error: '変更するフィールドがありません。' }, { status: 400 })
        }

        const cookie  = req.headers.get('cookie') ?? ''
        const res     = await fetch(`${req.nextUrl.origin}/api/clients/${clientId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify(updateBody),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed', resourceType: 'client', resourceId: clientId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '顧客情報の更新に失敗しました。' }, { status: res.status })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/clients/${clientId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const c = verifyData?.data
          if (c) {
            for (const [key, val] of Object.entries(updateBody)) {
              if (val !== null && key !== 'is_active' && c[key] !== val) {
                return Response.json({ error: '顧客情報の更新を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
              }
            }
          }
        }

        const changedParts: string[] = []
        if (typeof updateBody.name         === 'string' && updateBody.name)         changedParts.push(`顧客名を「${updateBody.name}」に`)
        if (typeof updateBody.phone        === 'string' && updateBody.phone)        changedParts.push(`電話番号を「${updateBody.phone}」に`)
        if (typeof updateBody.email        === 'string' && updateBody.email)        changedParts.push(`メールを「${updateBody.email}」に`)
        if (typeof updateBody.address      === 'string' && updateBody.address)      changedParts.push(`住所を「${updateBody.address}」に`)
        if (typeof updateBody.contact_name === 'string' && updateBody.contact_name) changedParts.push(`担当者を「${updateBody.contact_name}」に`)

        return Response.json({
          success:    true,
          voiceReply: changedParts.length > 0 ? `${changedParts.join('、')}変更しました。` : '顧客情報を更新しました。',
        })
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

        const cookie = req.headers.get('cookie') ?? ''
        const res = await fetch(`${req.nextUrl.origin}/api/attendance/corrections/${correctionId}/approve`, {
          method:  'POST',
          headers: { Cookie: cookie },
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'attendance_correction', resourceId: correctionId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '勤怠修正申請の承認に失敗しました。' }, { status: res.status })

        // Read-back: GETでstatus=approvedを確認
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/attendance/corrections/${correctionId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          if (verifyData?.correction?.status !== 'approved') {
            return Response.json({ error: '承認処理を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        return Response.json({ success: true, voiceReply: '勤怠修正申請を承認しました。' })
      }

      // ─── L4: reject_attendance ───────────────────────────
      case 'console.reject_attendance': {
        const { correctionId, reject_reason } = params
        if (!correctionId)          return Response.json({ error: 'correctionId required' }, { status: 400 })
        if (!reject_reason?.trim()) return Response.json({ error: '却下理由は必須です' },   { status: 400 })

        const cookie = req.headers.get('cookie') ?? ''
        const res = await fetch(`${req.nextUrl.origin}/api/attendance/corrections/${correctionId}/reject`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify({ reject_reason: reject_reason.trim() }),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'attendance_correction', resourceId: correctionId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '勤怠修正申請の却下に失敗しました。' }, { status: res.status })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/attendance/corrections/${correctionId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          if (verifyData?.correction?.status !== 'rejected') {
            return Response.json({ error: '却下処理を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        return Response.json({ success: true, voiceReply: '勤怠修正申請を却下しました。' })
      }

      // ─── L4: create_employee ─────────────────────────────
      case 'console.create_employee': {
        const { name, phone, email, name_kana, hire_date, department, position, notes } = params
        if (!name?.trim()) return Response.json({ error: '名前は必須です' }, { status: 400 })

        const ALLOWED_EMP_CREATE = ['name', 'phone', 'email', 'name_kana', 'hire_date', 'department', 'position', 'notes'] as const
        const createBody: Record<string, string | null> = {}
        for (const field of ALLOWED_EMP_CREATE) {
          const val = { name, phone, email, name_kana, hire_date, department, position, notes }[field]
          if (val !== undefined) createBody[field] = val?.trim() || null
        }
        createBody.name = name.trim()

        const cookie  = req.headers.get('cookie') ?? ''
        const res     = await fetch(`${req.nextUrl.origin}/api/employees`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify(createBody),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed', resourceType: 'employee',
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '従業員登録に失敗しました。' }, { status: res.status })

        const employeeId = data?.data?.id
        if (!employeeId) return Response.json({ error: '従業員IDを取得できませんでした。' }, { status: 500 })

        const verifyRes = await fetch(`${req.nextUrl.origin}/api/employees/${employeeId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const e = verifyData?.data
          if (!e?.id || e.name !== name.trim()) {
            return Response.json({ error: '従業員登録を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
          // 送信した任意フィールドの照合
          for (const field of ['phone', 'email', 'name_kana', 'hire_date', 'department', 'position'] as const) {
            const sent = createBody[field]
            if (sent && e[field] !== sent) {
              return Response.json({ error: '従業員登録の内容を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
            }
          }
        }

        return Response.json({ success: true, voiceReply: `従業員「${name.trim()}」を登録しました。ログインアカウントが必要な場合は管理画面から設定してください。` })
      }

      // ─── L4: update_employee ─────────────────────────────
      case 'console.update_employee': {
        const { employeeId } = params
        if (!employeeId) return Response.json({ error: 'employeeId required' }, { status: 400 })

        const ALLOWED_EMP_UPDATE = ['name', 'phone', 'email', 'name_kana', 'hire_date', 'department', 'position', 'notes'] as const
        const updateBody: Record<string, string | null> = {}
        for (const field of ALLOWED_EMP_UPDATE) {
          const val = params[field]
          if (val !== undefined) updateBody[field] = val?.trim() || null
        }
        if (Object.keys(updateBody).length === 0) {
          return Response.json({ error: '変更するフィールドがありません。' }, { status: 400 })
        }

        const cookie  = req.headers.get('cookie') ?? ''
        const res     = await fetch(`${req.nextUrl.origin}/api/employees/${employeeId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify(updateBody),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'employee', resourceId: employeeId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '従業員情報の更新に失敗しました。' }, { status: res.status })

        const verifyRes = await fetch(`${req.nextUrl.origin}/api/employees/${employeeId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const e = verifyData?.data
          if (e) {
            for (const [key, val] of Object.entries(updateBody)) {
              if (val !== null && e[key] !== val) {
                return Response.json({ error: '従業員情報の更新を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
              }
            }
          }
        }

        const changedParts: string[] = []
        if (updateBody.name)       changedParts.push(`名前を「${updateBody.name}」に`)
        if (updateBody.phone)      changedParts.push(`電話番号を「${updateBody.phone}」に`)
        if (updateBody.email)      changedParts.push(`メールを「${updateBody.email}」に`)
        if (updateBody.department) changedParts.push(`部署を「${updateBody.department}」に`)
        if (updateBody.position)   changedParts.push(`役職を「${updateBody.position}」に`)

        return Response.json({
          success:    true,
          voiceReply: changedParts.length > 0 ? `${changedParts.join('、')}変更しました。` : '従業員情報を更新しました。',
        })
      }

      // ─── L4: update_employee_status ──────────────────────
      case 'console.update_employee_status': {
        const { employeeId, status } = params
        if (!employeeId) return Response.json({ error: 'employeeId required' }, { status: 400 })
        if (!status)     return Response.json({ error: 'status required' }, { status: 400 })

        const VALID_STATUSES = ['active', 'on_leave', 'resigned', 'suspended'] as const
        if (!VALID_STATUSES.includes(status as typeof VALID_STATUSES[number])) {
          return Response.json({ error: 'statusはactive/on_leave/resigned/suspendedのみ変更可能です' }, { status: 400 })
        }

        const cookie  = req.headers.get('cookie') ?? ''
        const res     = await fetch(`${req.nextUrl.origin}/api/employees/${employeeId}`, {
          method:  'PATCH',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify({ status }),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'employee', resourceId: employeeId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? 'ステータス変更に失敗しました。' }, { status: res.status })

        const verifyRes = await fetch(`${req.nextUrl.origin}/api/employees/${employeeId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          if (verifyData?.data?.status !== status) {
            return Response.json({ error: 'ステータス変更を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        const STATUS_LABELS: Record<string, string> = {
          active: '在籍中', on_leave: '休職中', resigned: '退職', suspended: '利用停止',
        }
        return Response.json({ success: true, voiceReply: `従業員のステータスを${STATUS_LABELS[status] ?? status}に変更しました。` })
      }

      // ─── L4: create_estimate_from_project ───────────────
      case 'console.create_estimate_from_project': {
        const { projectId, project_name } = params
        if (!projectId) return Response.json({ error: 'projectId required' }, { status: 400 })

        const cookie = req.headers.get('cookie') ?? ''
        const res    = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}/quote`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify({}),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed', resourceType: 'invoice',
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '見積書の作成に失敗しました。' }, { status: res.status })

        const quote = data?.quote
        if (!quote?.id) return Response.json({ error: '見積書IDを取得できませんでした。' }, { status: 500 })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/invoices/${quote.id}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const inv = verifyData?.invoice
          if (!inv?.id || inv.invoice_type !== 'quote') {
            return Response.json({ error: '見積書の作成を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        const projLabel = project_name ? `「${project_name}」の` : ''
        const existing  = data?.existing === true ? '（既存の下書きを返しました）' : ''
        return Response.json({
          success:    true,
          voiceReply: `${projLabel}見積書 ${quote.invoice_number ?? quote.id} を作成しました。${existing}`,
        })
      }

      // ─── L4: create_invoice_from_project ─────────────────
      case 'console.create_invoice_from_project': {
        const { projectId, project_name } = params
        if (!projectId) return Response.json({ error: 'projectId required' }, { status: 400 })

        const cookie = req.headers.get('cookie') ?? ''
        const res    = await fetch(`${req.nextUrl.origin}/api/projects/${projectId}/invoice`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify({}),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed', resourceType: 'invoice',
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '請求書の作成に失敗しました。' }, { status: res.status })

        const invoice = data?.invoice
        if (!invoice?.id) return Response.json({ error: '請求書IDを取得できませんでした。' }, { status: 500 })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/invoices/${invoice.id}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const inv = verifyData?.invoice
          if (!inv?.id || inv.invoice_type !== 'invoice') {
            return Response.json({ error: '請求書の作成を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        const projLabel = project_name ? `「${project_name}」の` : ''
        const existing  = data?.existing === true ? '（既存の下書きを返しました）' : ''
        return Response.json({
          success:    true,
          voiceReply: `${projLabel}請求書 ${invoice.invoice_number ?? invoice.id} を作成しました。${existing}`,
        })
      }

      // ─── L4: update_invoice_status ───────────────────────
      case 'console.update_invoice_status': {
        const { invoiceId, status: newStatus, cancel_reason } = params
        if (!invoiceId)  return Response.json({ error: 'invoiceId required' },  { status: 400 })
        if (!newStatus)  return Response.json({ error: 'status required' },      { status: 400 })

        const VALID_STATUSES = ['issued', 'accepted', 'rejected', 'sent', 'awaiting_payment', 'overdue', 'paid', 'cancelled']
        if (!VALID_STATUSES.includes(newStatus)) {
          return Response.json({ error: `statusは${VALID_STATUSES.join('/')}のみ変更可能です` }, { status: 400 })
        }

        const cookie = req.headers.get('cookie') ?? ''
        const res    = await fetch(`${req.nextUrl.origin}/api/invoices/${invoiceId}/status`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify({ status: newStatus, cancel_reason: cancel_reason ?? null }),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'invoice', resourceId: invoiceId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? 'ステータス変更に失敗しました。' }, { status: res.status })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/invoices/${invoiceId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          if (verifyData?.invoice?.status !== newStatus) {
            return Response.json({ error: 'ステータス変更を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        const STATUS_LABELS: Record<string, string> = {
          issued: '発行済み', accepted: '承認済み', rejected: '却下', sent: '送付済み',
          awaiting_payment: '入金待ち', overdue: '期限超過', paid: '入金済み', cancelled: 'キャンセル',
        }
        return Response.json({ success: true, voiceReply: `ステータスを${STATUS_LABELS[newStatus] ?? newStatus}に変更しました。` })
      }

      // ─── L4: convert_estimate ────────────────────────────
      case 'console.convert_estimate': {
        const { invoiceId, invoice_number } = params
        if (!invoiceId) return Response.json({ error: 'invoiceId required' }, { status: 400 })

        const cookie = req.headers.get('cookie') ?? ''

        // 変換前確認: issued または accepted のquoteのみ変換可
        const currentRes = await fetch(`${req.nextUrl.origin}/api/invoices/${invoiceId}`, {
          headers: { Cookie: cookie },
        })
        if (!currentRes.ok) return Response.json({ error: '見積書が見つかりませんでした。' }, { status: 404 })
        const currentData = await currentRes.json()
        const quote = currentData?.invoice
        if (!quote?.id) return Response.json({ error: '見積書が見つかりませんでした。' }, { status: 404 })
        if (quote.invoice_type !== 'quote') {
          return Response.json({ error: '見積書のみ変換できます。' }, { status: 400 })
        }
        if (quote.converted_from_id) {
          return Response.json({ error: 'この見積書はすでに請求書に変換されています。' }, { status: 400 })
        }

        const res  = await fetch(`${req.nextUrl.origin}/api/invoices/${invoiceId}/convert`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify({}),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'invoice', resourceId: invoiceId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '見積書の変換に失敗しました。' }, { status: res.status })

        const newInvoice = data?.invoice
        if (!newInvoice?.id) return Response.json({ error: '請求書IDを取得できませんでした。' }, { status: 500 })

        // Read-back: 新しい請求書の確認
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/invoices/${newInvoice.id}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const inv = verifyData?.invoice
          if (!inv?.id || inv.invoice_type !== 'invoice') {
            return Response.json({ error: '請求書の作成を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        const quoteNumber = invoice_number ?? quote.invoice_number ?? invoiceId
        return Response.json({
          success:    true,
          voiceReply: `見積書 ${quoteNumber} を請求書 ${newInvoice.invoice_number ?? newInvoice.id} に変換しました。`,
        })
      }

      // ─── L4: record_payment ──────────────────────────────
      case 'console.record_payment': {
        const { invoiceId, amount, paid_at, payment_method, notes, invoice_number } = params
        if (!invoiceId) return Response.json({ error: 'invoiceId required' },  { status: 400 })
        if (!amount)    return Response.json({ error: 'amount required' },      { status: 400 })
        if (!paid_at)   return Response.json({ error: 'paid_at required' },     { status: 400 })

        const paymentAmount = Number(amount)
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
          return Response.json({ error: '入金額は0より大きい値を指定してください' }, { status: 400 })
        }

        const dateRe = /^\d{4}-\d{2}-\d{2}$/
        if (!dateRe.test(paid_at)) {
          return Response.json({ error: 'paid_atはYYYY-MM-DD形式で指定してください' }, { status: 400 })
        }

        const cookie = req.headers.get('cookie') ?? ''
        const res    = await fetch(`${req.nextUrl.origin}/api/invoices/${invoiceId}/payment`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify({
            amount:         paymentAmount,
            paid_at,
            payment_method: payment_method ?? null,
            notes:          notes ?? null,
          }),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'invoice_payment', resourceId: invoiceId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '入金記録に失敗しました。' }, { status: res.status })

        const invLabel = invoice_number ? `請求書 ${invoice_number} に` : ''
        const fullyPaid = data?.is_fully_paid === true
        const remaining = data?.remaining ?? 0
        let reply = `${invLabel}${paymentAmount.toLocaleString()}円の入金を記録しました（${paid_at}）。`
        if (fullyPaid) {
          reply += ' 全額入金完了です。'
        } else if (remaining > 0) {
          reply += ` 残額 ${remaining.toLocaleString()}円です。`
        }
        return Response.json({ success: true, voiceReply: reply })
      }

      // ─── L4: inventory_stock_in ──────────────────────────
      case 'console.inventory_stock_in': {
        const { inventoryId, quantity, item_name, reason } = params
        if (!inventoryId) return Response.json({ error: 'inventoryId required' }, { status: 400 })
        const qty = Number(quantity)
        if (!quantity || isNaN(qty) || qty <= 0) {
          return Response.json({ error: '数量は正の値を入力してください' }, { status: 400 })
        }

        const cookie = req.headers.get('cookie') ?? ''
        const res    = await fetch(`${req.nextUrl.origin}/api/inventory/${inventoryId}/in`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify({ quantity: qty, notes: reason ?? null }),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'inventory', resourceId: inventoryId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '入庫処理に失敗しました。' }, { status: res.status })

        const newStock = data?.new_stock
        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/inventory/${inventoryId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const currentQty = verifyData?.item?.stock_quantity
          if (newStock != null && currentQty !== newStock) {
            return Response.json({ error: '入庫後の在庫数を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        const label = item_name ? `${item_name}を` : ''
        return Response.json({ success: true, voiceReply: `${label}${qty}個入庫しました。現在庫: ${newStock ?? '確認中'}個です。` })
      }

      // ─── L4: inventory_stock_out ─────────────────────────
      case 'console.inventory_stock_out': {
        const { inventoryId, quantity, item_name, reason } = params
        if (!inventoryId) return Response.json({ error: 'inventoryId required' }, { status: 400 })
        const qty = Number(quantity)
        if (!quantity || isNaN(qty) || qty <= 0) {
          return Response.json({ error: '数量は正の値を入力してください' }, { status: 400 })
        }

        const cookie = req.headers.get('cookie') ?? ''

        // 事前在庫チェック
        const checkRes = await fetch(`${req.nextUrl.origin}/api/inventory/${inventoryId}`, {
          headers: { Cookie: cookie },
        })
        if (checkRes.ok) {
          const checkData = await checkRes.json()
          const currentQty = checkData?.item?.stock_quantity ?? 0
          if (qty > currentQty) {
            return Response.json({
              error: `現在${currentQty}個しかないため、${qty}個は出庫できません。`,
            }, { status: 400 })
          }
        }

        const res  = await fetch(`${req.nextUrl.origin}/api/inventory/${inventoryId}/out`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify({ quantity: qty, reason: reason?.trim() || null }),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'inventory', resourceId: inventoryId,
        })
        if (!res.ok) {
          const errMsg = data?.current_stock != null
            ? `現在${data.current_stock}個しかないため、${data.requested ?? qty}個は出庫できません。`
            : (data?.error ?? '出庫処理に失敗しました。')
          return Response.json({ error: errMsg }, { status: res.status })
        }

        const newStock = data?.new_stock
        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/inventory/${inventoryId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const verifiedQty = verifyData?.item?.stock_quantity
          if (newStock != null && verifiedQty !== newStock) {
            return Response.json({ error: '出庫後の在庫数を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        const label = item_name ? `${item_name}を` : ''
        return Response.json({ success: true, voiceReply: `${label}${qty}個出庫しました。現在庫: ${newStock ?? '確認中'}個です。` })
      }

      // ─── L4: adjust_inventory ────────────────────────────
      case 'console.adjust_inventory': {
        const { inventoryId, target_quantity, reason, item_name, current_quantity } = params
        if (!inventoryId)     return Response.json({ error: 'inventoryId required' },     { status: 400 })
        if (!reason?.trim())  return Response.json({ error: '調整理由は必須です' },         { status: 400 })
        const targetQty = Number(target_quantity)
        if (isNaN(targetQty) || targetQty < 0) {
          return Response.json({ error: '調整後数量は0以上の値を入力してください' }, { status: 400 })
        }

        const cookie = req.headers.get('cookie') ?? ''

        // 現在庫を取得して差分計算
        let currentQty = current_quantity != null ? Number(current_quantity) : null
        if (currentQty === null) {
          const checkRes = await fetch(`${req.nextUrl.origin}/api/inventory/${inventoryId}`, {
            headers: { Cookie: cookie },
          })
          if (checkRes.ok) {
            const checkData = await checkRes.json()
            currentQty = checkData?.item?.stock_quantity ?? 0
          } else {
            return Response.json({ error: '現在の在庫数を取得できませんでした。' }, { status: 500 })
          }
        }

        const adjustmentQty = targetQty - (currentQty ?? 0)
        if (adjustmentQty === 0) {
          return Response.json({ success: true, voiceReply: `現在庫は既に${targetQty}個です。変更はありません。` })
        }

        const res  = await fetch(`${req.nextUrl.origin}/api/inventory/${inventoryId}/adjust`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify({ adjustment_quantity: adjustmentQty, reason: reason.trim() }),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'inventory', resourceId: inventoryId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '在庫調整に失敗しました。' }, { status: res.status })

        const newStock = data?.new_stock
        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/inventory/${inventoryId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const verifiedQty = verifyData?.item?.stock_quantity
          if (verifiedQty !== targetQty) {
            return Response.json({ error: '在庫調整の結果を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        const label = item_name ? `${item_name}の` : ''
        const dir   = adjustmentQty > 0 ? `${adjustmentQty}個増加` : `${Math.abs(adjustmentQty)}個減少`
        return Response.json({ success: true, voiceReply: `${label}在庫を${targetQty}個に調整しました（${dir}）。` })
      }

      // ─── L4: create_inventory_item ───────────────────────
      case 'console.create_inventory_item': {
        const { name, category, unit, min_stock, storage_location, notes } = params
        if (!name?.trim()) return Response.json({ error: '品目名は必須です' }, { status: 400 })

        const createBody: Record<string, string | number | null> = { name: name.trim() }
        if (category?.trim())          createBody.category         = category.trim()
        if (unit?.trim())              createBody.unit             = unit.trim()
        if (min_stock != null)         createBody.min_stock        = Number(min_stock)
        if (storage_location?.trim())  createBody.storage_location = storage_location.trim()
        if (notes?.trim())             createBody.notes            = notes.trim()

        const cookie = req.headers.get('cookie') ?? ''
        const res    = await fetch(`${req.nextUrl.origin}/api/inventory`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify(createBody),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed', resourceType: 'inventory',
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '品目登録に失敗しました。' }, { status: res.status })

        const itemId = data?.item?.id
        if (!itemId) return Response.json({ error: '品目IDを取得できませんでした。' }, { status: 500 })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/inventory/${itemId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          if (!verifyData?.item?.id || verifyData.item.name !== name.trim()) {
            return Response.json({ error: '品目登録を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        return Response.json({ success: true, voiceReply: `品目「${name.trim()}」を登録しました。初期在庫は0個です。入庫で在庫を追加してください。` })
      }

      // ─── L4: update_inventory_item ───────────────────────
      case 'console.update_inventory_item': {
        const { inventoryId } = params
        if (!inventoryId) return Response.json({ error: 'inventoryId required' }, { status: 400 })

        const ALLOWED = ['name', 'category', 'unit', 'min_stock', 'storage_location', 'supplier_name', 'notes'] as const
        const updateBody: Record<string, string | number | null> = {}
        for (const field of ALLOWED) {
          const val = params[field]
          if (val === undefined) continue
          if (field === 'min_stock') {
            updateBody[field] = Number(val)
          } else {
            updateBody[field] = val?.trim() || null
          }
        }
        if (Object.keys(updateBody).length === 0) {
          return Response.json({ error: '変更するフィールドがありません。' }, { status: 400 })
        }

        const cookie = req.headers.get('cookie') ?? ''
        const res    = await fetch(`${req.nextUrl.origin}/api/inventory/${inventoryId}`, {
          method:  'PUT',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body:    JSON.stringify(updateBody),
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'inventory', resourceId: inventoryId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? '品目更新に失敗しました。' }, { status: res.status })

        // Read-back
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/inventory/${inventoryId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          const item = verifyData?.item
          if (item) {
            for (const [key, val] of Object.entries(updateBody)) {
              if (key !== 'min_stock' && val !== null && item[key] !== val) {
                return Response.json({ error: '品目更新を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
              }
            }
          }
        }

        const changedParts: string[] = []
        if (updateBody.name)             changedParts.push(`名前を「${updateBody.name}」に`)
        if (updateBody.min_stock != null) changedParts.push(`最低在庫を${updateBody.min_stock}個に`)
        if (updateBody.storage_location) changedParts.push(`保管場所を「${updateBody.storage_location}」に`)

        return Response.json({
          success:    true,
          voiceReply: changedParts.length > 0 ? `${changedParts.join('、')}変更しました。` : '品目情報を更新しました。',
        })
      }

      // ─── L4: generate_report_pdf ─────────────────────────
      case 'console.generate_report_pdf': {
        const { reportId, report_number } = params
        if (!reportId) return Response.json({ error: 'reportId required' }, { status: 400 })

        const cookie = req.headers.get('cookie') ?? ''

        // 事前確認: report が存在するか・PDF既存チェック
        const currentRes = await fetch(`${req.nextUrl.origin}/api/reports/${reportId}`, {
          headers: { Cookie: cookie },
        })
        if (!currentRes.ok) return Response.json({ error: '報告書が見つかりませんでした。' }, { status: 404 })
        const currentData = await currentRes.json()
        const report = currentData?.data
        if (!report?.id) return Response.json({ error: '報告書が見つかりませんでした。' }, { status: 404 })

        const res = await fetch(`${req.nextUrl.origin}/api/reports/${reportId}/pdf`, {
          method:  'POST',
          headers: { Cookie: cookie },
        })
        const data = await res.json()
        logConsoleAudit({
          source: 'jarvis_console', actor: auth.userId, actorType: 'admin',
          companyId: auth.companyId, action, safetyLevel: level,
          confirmed: true, result: res.ok ? 'success' : 'failed',
          resourceType: 'report', resourceId: reportId,
        })
        if (!res.ok) return Response.json({ error: data?.error ?? 'PDF生成に失敗しました。' }, { status: res.status })

        // Read-back: pdf_url が更新されているか確認
        const verifyRes = await fetch(`${req.nextUrl.origin}/api/reports/${reportId}`, {
          headers: { Cookie: cookie },
        })
        if (verifyRes.ok) {
          const verifyData = await verifyRes.json()
          if (!verifyData?.data?.pdf_url) {
            return Response.json({ error: 'PDFの生成を確認できませんでした。管理画面でご確認ください。' }, { status: 500 })
          }
        }

        const label = report_number ? `報告書 ${report_number} の` : ''
        return Response.json({ success: true, voiceReply: `${label}PDFを生成しました。報告書画面からダウンロードできます。` })
      }

      default:
        return Response.json({ error: 'unsupported action' }, { status: 400 })
    }
  } catch (err) {
    console.error('[console-confirm-action]', err)
    return Response.json({ error: '処理中にエラーが発生しました。' }, { status: 500 })
  }
}
