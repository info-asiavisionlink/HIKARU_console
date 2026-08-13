/**
 * System内通知: 案件イベント
 *
 * notifications テーブルへ INSERT。
 * 失敗しても案件業務処理は継続する（void で呼び出すこと）。
 * LINE通知（lib/line/）とは独立した別系統。
 */

export interface AssignmentKey {
  assignee_type: 'employee' | 'partner'
  assignee_id:   string
}

/**
 * 新旧 assignment リストを比較し、新規追加された割当だけを返す。
 *
 * 比較キー: assignee_type + assignee_id
 *
 * 全置換（DELETE → INSERT）運用でも、既存 assignee への再通知を防ぐ。
 */
export function diffAssignments(
  before: AssignmentKey[],
  after:  AssignmentKey[]
): AssignmentKey[] {
  const beforeSet = new Set(before.map(a => `${a.assignee_type}:${a.assignee_id}`))
  return after.filter(a => !beforeSet.has(`${a.assignee_type}:${a.assignee_id}`))
}

/**
 * 新旧 assignment リストを比較し、解除された（before にあるが after にない）割当だけを返す。
 * diffAssignments の逆方向。
 */
export function diffRemoved(
  before: AssignmentKey[],
  after:  AssignmentKey[]
): AssignmentKey[] {
  const afterSet = new Set(after.map(a => `${a.assignee_type}:${a.assignee_id}`))
  return before.filter(a => !afterSet.has(`${a.assignee_type}:${a.assignee_id}`))
}

// ============================================================
// 変更フィールド比較ユーティリティ
// ============================================================

/** projects テーブルの通知対象フィールド定義 */
export const WATCHED_DETAIL_FIELDS = [
  { key: 'location_name',  label: '作業場所'     },
  { key: 'address',        label: '住所'         },
  { key: 'start_date',     label: '開始日'       },
  { key: 'end_date',       label: '終了日'       },
  { key: 'work_start_time', label: '作業開始時刻' },
  { key: 'work_end_time',   label: '作業終了時刻' },
] as const

export type WatchedDetailField = typeof WATCHED_DETAIL_FIELDS[number]['key']

export interface DetailChange {
  label:  string
  before: string | null
  after:  string | null
}

/**
 * 更新前後の project を比較し、通知対象フィールドの変更リストを返す。
 * null / undefined を同一視し、文字列化して比較する。
 */
export function detectDetailChanges(
  beforeProject: Record<string, unknown>,
  afterProject:  Record<string, unknown>
): DetailChange[] {
  const changes: DetailChange[] = []
  for (const { key, label } of WATCHED_DETAIL_FIELDS) {
    const b = beforeProject[key] ?? null
    const a = afterProject[key]  ?? null
    // 文字列として比較（null は null として扱う）
    if (String(b ?? '') !== String(a ?? '')) {
      changes.push({
        label,
        before: b != null ? String(b) : null,
        after:  a != null ? String(a) : null,
      })
    }
  }
  return changes
}

/**
 * assignee_type / assignee_id から profiles.id（= auth.users.id）を解決する。
 *
 * employee: employees.auth_user_id → profiles.id
 * partner:  partners.auth_user_id  → profiles.id
 *
 * auth_user_id が NULL（ログインアカウント未連携）なら null を返す → 呼び元でスキップ。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveProfileId(adminClient: any, a: AssignmentKey): Promise<string | null> {
  if (a.assignee_type === 'employee') {
    const { data } = await adminClient
      .from('employees')
      .select('auth_user_id')
      .eq('id', a.assignee_id)
      .single()
    return data?.auth_user_id ?? null
  }
  if (a.assignee_type === 'partner') {
    const { data } = await adminClient
      .from('partners')
      .select('auth_user_id')
      .eq('id', a.assignee_id)
      .single()
    return data?.auth_user_id ?? null
  }
  return null
}

// ============================================================
// project_cancelled / project_paused / project_completed 通知
// ============================================================

export type ProjectStatusEventType = 'project_cancelled' | 'project_paused' | 'project_completed'

const STATUS_NOTIFICATION: Record<
  ProjectStatusEventType,
  { title: string; bodyFn: (name: string) => string; targetUrlFn: (pid: string) => string }
> = {
  project_cancelled: {
    title:       '案件がキャンセルされました',
    bodyFn:      (name) => `${name} がキャンセルされました。`,
    targetUrlFn: (pid) => `/jobs/${pid}`,
  },
  project_paused: {
    title:       '案件が一時停止されました',
    bodyFn:      (name) => `${name} が一時停止されました。`,
    targetUrlFn: (pid) => `/jobs/${pid}`,
  },
  project_completed: {
    title:       '案件が完了しました',
    bodyFn:      (name) => `${name} が完了しました。`,
    // System は status=active のみ表示するため /jobs/{id} にはアクセスできない
    targetUrlFn: (_pid) => '/jobs',
  },
}

/**
 * 案件 status が cancelled / paused に変化した時、
 * 現在の全担当 Worker（project_assignments）へ通知する。
 *
 * - project_assignments を DB から取得（呼び出し時点の最新状態）
 * - auth_user_id 未連携 Worker はスキップ（サーバーログを残す）
 * - 通知失敗は console.error のみ（案件処理に影響させない）
 * - Employee / Partner 両対応
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fireProjectStatusNotifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient:  any,
  projectId:    string,
  projectName:  string,
  companyId:    string,
  eventType:    ProjectStatusEventType
): Promise<void> {
  try {
    const { data: rows } = await adminClient
      .from('project_assignments')
      .select('assignee_type, assignee_id')
      .eq('project_id', projectId)

    const assignments = (rows ?? []) as AssignmentKey[]
    if (assignments.length === 0) {
      console.log(`[System通知] project ${projectId} ${eventType}: 担当者なしのためスキップ`)
      return
    }

    const config = STATUS_NOTIFICATION[eventType]

    for (const a of assignments) {
      try {
        const profileId = await resolveProfileId(adminClient, a)
        if (!profileId) {
          console.log(
            `[System通知] project ${projectId} ${eventType}: ` +
            `${a.assignee_type} ${a.assignee_id} のログインアカウント未連携のためスキップ`
          )
          continue
        }

        const { error } = await adminClient.from('notifications').insert({
          company_id:           companyId,
          recipient_profile_id: profileId,
          title:                config.title,
          body:                 config.bodyFn(projectName),
          type:                 eventType,
          target_app:           'worker',
          is_read:              false,
          target_url:           config.targetUrlFn(projectId),
        })

        if (error) {
          console.error(
            `[System通知] project ${projectId} ${eventType} ` +
            `(${a.assignee_type} ${a.assignee_id}) 挿入失敗:`,
            error.message
          )
        }
      } catch (err) {
        console.error(
          `[System通知] project ${projectId} ${eventType} ` +
          `(${a.assignee_type} ${a.assignee_id}) 予期せぬエラー:`,
          err
        )
      }
    }
  } catch (err) {
    console.error(`[System通知] project ${projectId} ${eventType} 全体エラー:`, err)
  }
}

// ============================================================
// project_unassigned 通知
// ============================================================

/**
 * 担当から解除された Worker へ project_unassigned 通知を INSERT する。
 *
 * - removedAssignments: diffRemoved() で抽出した「今回解除された分」
 * - target_url は /jobs（解除後は /jobs/{id} にアクセスできない可能性があるため）
 * - auth_user_id 未連携 Worker はスキップ
 */
export async function fireProjectUnassignedNotifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient:        any,
  projectId:          string,
  projectName:        string,
  companyId:          string,
  removedAssignments: AssignmentKey[]
): Promise<void> {
  if (removedAssignments.length === 0) return

  for (const a of removedAssignments) {
    try {
      const profileId = await resolveProfileId(adminClient, a)
      if (!profileId) {
        console.log(
          `[System通知] project ${projectId} project_unassigned: ` +
          `${a.assignee_type} ${a.assignee_id} のログインアカウント未連携のためスキップ`
        )
        continue
      }

      const { error } = await adminClient.from('notifications').insert({
        company_id:           companyId,
        recipient_profile_id: profileId,
        title:                '案件の担当から解除されました',
        body:                 `${projectName} の担当から解除されました。`,
        type:                 'project_unassigned',
        target_app:           'worker',
        is_read:              false,
        // 解除後は project_assignments が削除されており /jobs/{id} へアクセス不可の可能性あり
        target_url:           '/jobs',
      })

      if (error) {
        console.error(
          `[System通知] project ${projectId} project_unassigned ` +
          `(${a.assignee_type} ${a.assignee_id}) 挿入失敗:`,
          error.message
        )
      }
    } catch (err) {
      console.error(
        `[System通知] project ${projectId} project_unassigned ` +
        `(${a.assignee_type} ${a.assignee_id}) 予期せぬエラー:`,
        err
      )
    }
  }
}

// ============================================================
// project_details_changed 通知
// ============================================================

function buildDetailsChangedBody(projectName: string, changes: DetailChange[]): string {
  const lines = [`${projectName} の案件情報が変更されました。`, '']
  for (const c of changes) {
    const b = c.before ?? '（未設定）'
    const a = c.after  ?? '（未設定）'
    lines.push(`${c.label}: ${b} → ${a}`)
  }
  return lines.join('\n')
}

/**
 * 場所・日時等の案件詳細が変更された時、全担当 Worker へ通知する。
 *
 * - changes: detectDetailChanges() で抽出した変更フィールドリスト
 * - project_assignments を DB から取得して全担当へ通知
 * - auth_user_id 未連携 Worker はスキップ
 */
export async function fireProjectDetailsChangedNotifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient:  any,
  projectId:    string,
  projectName:  string,
  companyId:    string,
  changes:      DetailChange[]
): Promise<void> {
  if (changes.length === 0) return

  try {
    const { data: rows } = await adminClient
      .from('project_assignments')
      .select('assignee_type, assignee_id')
      .eq('project_id', projectId)

    const assignments = (rows ?? []) as AssignmentKey[]
    if (assignments.length === 0) {
      console.log(`[System通知] project ${projectId} project_details_changed: 担当者なしのためスキップ`)
      return
    }

    const body = buildDetailsChangedBody(projectName, changes)

    for (const a of assignments) {
      try {
        const profileId = await resolveProfileId(adminClient, a)
        if (!profileId) {
          console.log(
            `[System通知] project ${projectId} project_details_changed: ` +
            `${a.assignee_type} ${a.assignee_id} のログインアカウント未連携のためスキップ`
          )
          continue
        }

        const { error } = await adminClient.from('notifications').insert({
          company_id:           companyId,
          recipient_profile_id: profileId,
          title:                '案件情報が変更されました',
          body,
          type:                 'project_details_changed',
          target_app:           'worker',
          is_read:              false,
          target_url:           `/jobs/${projectId}`,
        })

        if (error) {
          console.error(
            `[System通知] project ${projectId} project_details_changed ` +
            `(${a.assignee_type} ${a.assignee_id}) 挿入失敗:`,
            error.message
          )
        }
      } catch (err) {
        console.error(
          `[System通知] project ${projectId} project_details_changed ` +
          `(${a.assignee_type} ${a.assignee_id}) 予期せぬエラー:`,
          err
        )
      }
    }
  } catch (err) {
    console.error(`[System通知] project ${projectId} project_details_changed 全体エラー:`, err)
  }
}

// ============================================================
// project_assigned 通知
// ============================================================

/**
 * 新規追加された割当 Worker それぞれへ project_assigned 通知を INSERT する。
 *
 * - newAssignments: diffAssignments() で抽出した「今回新たに追加された分」
 * - projectId / projectName / companyId: サーバー側で確定した値のみ使用
 * - エラーは console.error のみ（案件処理に影響させない）
 * - auth_user_id 未連携 Worker はスキップ（サーバーログを残す）
 */
export async function fireProjectAssignedNotifications(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  adminClient:    any,
  projectId:      string,
  projectName:    string,
  companyId:      string,
  newAssignments: AssignmentKey[]
): Promise<void> {
  if (newAssignments.length === 0) return

  for (const assignment of newAssignments) {
    try {
      const profileId = await resolveProfileId(adminClient, assignment)
      if (!profileId) {
        console.log(
          `[System通知] project ${projectId} project_assigned: ` +
          `${assignment.assignee_type} ${assignment.assignee_id} のログインアカウント未連携のためスキップ`
        )
        continue
      }

      const { error } = await adminClient
        .from('notifications')
        .insert({
          company_id:           companyId,
          recipient_profile_id: profileId,
          title:                '新しい案件に割り当てられました',
          body:                 `${projectName} の担当に割り当てられました。`,
          type:                 'project_assigned',
          target_app:           'worker',
          is_read:              false,
          target_url:           `/jobs/${projectId}`,
        })

      if (error) {
        console.error(
          `[System通知] project ${projectId} project_assigned ` +
          `(${assignment.assignee_type} ${assignment.assignee_id}) 挿入失敗:`,
          error.message
        )
      }
    } catch (err) {
      console.error(
        `[System通知] project ${projectId} project_assigned ` +
        `(${assignment.assignee_type} ${assignment.assignee_id}) 予期せぬエラー:`,
        err
      )
    }
  }
}
