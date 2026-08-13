/**
 * System内通知: シフトイベント
 *
 * notifications テーブルへINSERT。
 * 失敗してもシフト業務処理は継続する（void で呼び出すこと）。
 * LINE通知（lib/line/shift-notifier.ts）と並行して動作する。独立した2系統。
 */

export type ShiftEventType =
  | 'shift_created'
  | 'shift_updated'
  | 'shift_cancelled'
  | 'shift_confirmed'

export interface ShiftForSystemNotification {
  id:            string
  company_id:    string
  assignee_type: string
  employee_id:   string | null
  partner_id:    string | null
  shift_date:    string
  start_time:    string
  end_time:      string
  projects:      { name?: string | null } | null
}

const EVENT_TITLES: Record<ShiftEventType, string> = {
  shift_created:   '新しいシフトが登録されました',
  shift_updated:   'シフトが変更されました',
  shift_cancelled: 'シフトがキャンセルされました',
  shift_confirmed: 'シフトが確定しました',
}

function buildBody(shift: ShiftForSystemNotification): string {
  const projectName = shift.projects?.name ?? '案件'
  const start       = shift.start_time.slice(0, 5)
  const end         = shift.end_time.slice(0, 5)
  return `${projectName}\n${shift.shift_date} ${start}〜${end}`
}

/**
 * Employee / Partner の profiles.id を解決する。
 *
 * employees.auth_user_id = auth.users.id = profiles.id (migration 001, 011確認済み)
 * partners.auth_user_id  も同様。
 *
 * ログインアカウント未連携の場合は null を返す → 通知スキップ。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveProfileId(adminClient: any, shift: ShiftForSystemNotification): Promise<string | null> {
  if (shift.assignee_type === 'employee' && shift.employee_id) {
    const { data } = await adminClient
      .from('employees')
      .select('auth_user_id')
      .eq('id', shift.employee_id)
      .single()
    return data?.auth_user_id ?? null
  }
  if (shift.assignee_type === 'partner' && shift.partner_id) {
    const { data } = await adminClient
      .from('partners')
      .select('auth_user_id')
      .eq('id', shift.partner_id)
      .single()
    return data?.auth_user_id ?? null
  }
  return null
}

/**
 * シフトイベントに対する System内通知を INSERT する。
 *
 * - 業務処理成功後に void で呼び出すこと
 * - エラーは console.error のみ（例外を外へ伝播しない）
 * - profiles.id が未解決の場合はスキップしサーバーログを残す
 */
export async function fireShiftSystemNotification(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient: any,
  shift:       ShiftForSystemNotification,
  eventType:   ShiftEventType
): Promise<void> {
  try {
    const profileId = await resolveProfileId(adminClient, shift)
    if (!profileId) {
      console.log(
        `[System通知] shift ${shift.id} ${eventType}: ` +
        `assignee(${shift.assignee_type}) のログインアカウント未連携のためスキップ`
      )
      return
    }

    const { error } = await adminClient
      .from('notifications')
      .insert({
        company_id:           shift.company_id,
        recipient_profile_id: profileId,
        title:                EVENT_TITLES[eventType],
        body:                 buildBody(shift),
        type:                 eventType,
        target_app:           'worker',
        is_read:              false,
        target_url:           '/shifts',
      })

    if (error) {
      console.error(`[System通知] shift ${shift.id} ${eventType} 挿入失敗:`, error.message)
    }
  } catch (err) {
    console.error(`[System通知] shift ${shift.id} ${eventType} 予期せぬエラー:`, err)
  }
}
