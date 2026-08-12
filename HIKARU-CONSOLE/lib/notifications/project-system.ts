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
// project_cancelled / project_paused 通知
// ============================================================

export type ProjectStatusEventType = 'project_cancelled' | 'project_paused'

const STATUS_NOTIFICATION: Record<ProjectStatusEventType, { title: string; bodyFn: (name: string) => string }> = {
  project_cancelled: {
    title:  '案件がキャンセルされました',
    bodyFn: (name) => `${name} がキャンセルされました。`,
  },
  project_paused: {
    title:  '案件が一時停止されました',
    bodyFn: (name) => `${name} が一時停止されました。`,
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
          is_read:              false,
          target_url:           `/jobs/${projectId}`,
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
