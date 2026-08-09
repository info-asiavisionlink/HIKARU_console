// シフトLINE通知ヘルパー（route.ts から分離）
import { createClient } from '@supabase/supabase-js'
import { sendNotification } from './notification.service'
import {
  shiftCreatedTemplate,
  shiftUpdatedTemplate,
  shiftCancelledTemplate,
  shiftConfirmedTemplate,
} from './templates'

export type ShiftEventType =
  | 'shift_created'
  | 'shift_updated'
  | 'shift_cancelled'
  | 'shift_confirmed'

export interface ShiftRow {
  id: string
  shift_date: string
  start_time: string
  end_time: string
  assignee_type: string
  employee_id: string | null
  partner_id:  string | null
  projects:  { name?: string; location_name?: string } | null
  employees: { name?: string } | null
  partners:  { contact_person_name?: string } | null
}

export async function fireShiftNotification(
  shift: ShiftRow,
  companyId: string,
  eventType: ShiftEventType
) {
  try {
    const projectName  = shift.projects?.name ?? '案件'
    const locationName = shift.projects?.location_name ?? undefined
    const assigneeName = shift.employees?.name ?? shift.partners?.contact_person_name ?? '担当者'
    const params = {
      projectName,
      locationName,
      shiftDate:    shift.shift_date,
      startTime:    shift.start_time.slice(0, 5),
      endTime:      shift.end_time.slice(0, 5),
      assigneeName,
      companyBaseUrl: process.env.HIKARU_SYSTEM_URL,
    }

    const message =
      eventType === 'shift_updated'   ? shiftUpdatedTemplate(params)   :
      eventType === 'shift_cancelled' ? shiftCancelledTemplate(params)  :
      eventType === 'shift_confirmed' ? shiftConfirmedTemplate(params)  :
      shiftCreatedTemplate(params)

    // employees.auth_user_id → profiles.id を解決
    let profileId: string | undefined
    if (shift.assignee_type === 'employee' && shift.employee_id) {
      const db = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { autoRefreshToken: false, persistSession: false } }
      )
      const { data: emp } = await db
        .from('employees')
        .select('auth_user_id')
        .eq('id', shift.employee_id)
        .single()
      profileId = emp?.auth_user_id ?? undefined
    }

    // shift_updated は変更のたびに送信可能にするためタイムスタンプを含める
    const notificationKey = eventType === 'shift_updated'
      ? `shift_updated:${shift.id}:${Date.now()}`
      : `${eventType}:${shift.id}`

    await sendNotification({
      companyId,
      eventType,
      notificationKey,
      profileId,
      message,
    })
  } catch {
    // 通知失敗は業務処理に影響させない
  }
}
