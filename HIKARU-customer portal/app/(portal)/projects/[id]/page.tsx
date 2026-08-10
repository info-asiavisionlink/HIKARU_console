import { cookies } from 'next/headers'
import { redirect, notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/server'
import { ProjectDetailClient } from './ProjectDetailClient'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ProjectDetailPage({ params }: Props) {
  const { id } = await params
  const cookieStore = await cookies()
  const uid = cookieStore.get('hk_cp_uid')?.value
  if (!uid) redirect('/login')

  const admin = createAdminClient()

  const { data: account } = await admin
    .from('client_portal_accounts')
    .select('id')
    .eq('profile_id', uid)
    .single()

  if (!account) redirect('/login')

  const { data: perm } = await admin
    .from('client_project_permissions')
    .select('*')
    .eq('portal_account_id', account.id)
    .eq('project_id', id)
    .single()

  if (!perm) notFound()

  const { data: project } = await admin
    .from('projects')
    .select('id, name, code, status, start_date, end_date, location_name, notes')
    .eq('id', id)
    .single()

  if (!project) notFound()

  // 最新のジョブ情報
  const { data: jobs } = await admin
    .from('jobs')
    .select(`
      id, status, work_date, started_at, completed_at, notes,
      profiles ( name )
    `)
    .eq('project_id', id)
    .order('work_date', { ascending: false })
    .limit(10)

  const latestJob = jobs?.[0]

  // 最新ジョブの写真
  type Photo = {
    id: string
    photo_type: string
    url: string | null
    storage_path: string
    created_at: string
    photo_spots: { name: string } | null
    ai_evaluations: {
      score: number
      passed: boolean
      recommendation: string
      comment: string
    }[] | null
  }
  let photos: Photo[] = []
  if (latestJob) {
    const { data } = await admin
      .from('photos')
      .select(`
        id, photo_type, url, storage_path, created_at,
        photo_spots ( name ),
        ai_evaluations!ai_evaluations_after_photo_id_fkey ( score, passed, recommendation, comment )
      `)
      .eq('job_id', latestJob.id)
      .order('created_at', { ascending: true })
    photos = (data as any[]) ?? []
  }

  // 最新報告書
  let latestReport: { id: string; overall_score: number | null; created_at: string } | null = null
  if (perm.can_view_reports) {
    const { data } = await admin
      .from('reports')
      .select('id, overall_score, created_at')
      .eq('project_id', id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    latestReport = data
  }

  return (
    <ProjectDetailClient
      project={project as any}
      perm={perm as any}
      jobs={(jobs as any[]) ?? []}
      photos={photos}
      latestReport={latestReport}
      portalAccountId={account.id}
    />
  )
}
