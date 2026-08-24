import { NextResponse } from 'next/server'
import { getAuthContext } from '@/lib/supabase/server-admin'
import { getJstDateString } from '@/lib/billing/date-utils'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any

export async function GET() {
  const auth = await getAuthContext()
  if (!auth) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const { companyId, adminClient } = auth
  const admin = adminClient as AnyClient

  // 今日の in_progress ジョブを全件取得（JST基準）
  const today = getJstDateString()

  const { data: jobs, error } = await admin
    .from('jobs')
    .select(`
      id, project_id, worker_id, status, work_date, started_at, completed_at,
      projects(id, name, code),
      profiles(id, name)
    `)
    .eq('company_id', companyId)
    .eq('work_date', today)
    .eq('status', 'in_progress')
    .order('started_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!jobs || jobs.length === 0) return NextResponse.json({ data: [] })

  // 各ジョブの写真を取得
  const jobIds = jobs.map((j: any) => j.id)
  const { data: photos } = await admin
    .from('photos')
    .select('id, job_id, spot_id, photo_type, url, created_at, photo_spots(name, order_num)')
    .in('job_id', jobIds)
    .order('created_at', { ascending: true })

  // 写真をジョブIDでグループ化
  const photosByJob: Record<string, any[]> = {}
  for (const p of (photos ?? [])) {
    if (!photosByJob[p.job_id]) photosByJob[p.job_id] = []
    photosByJob[p.job_id].push(p)
  }

  const data = jobs.map((j: any) => ({
    ...j,
    photos: photosByJob[j.id] ?? [],
    photo_count: (photosByJob[j.id] ?? []).length,
  }))

  return NextResponse.json({ data })
}
