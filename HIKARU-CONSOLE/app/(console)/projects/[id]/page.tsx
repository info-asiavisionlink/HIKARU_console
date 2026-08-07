'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useParams } from 'next/navigation'
import { deleteProject } from '@/services/projects.service'
import {
  PageHeader, Button, Card, CardContent, Badge, Skeleton, Breadcrumb, toast,
} from '@hikaru/ui'
import { ConfirmDeleteDialog } from '@/components/console/ConfirmDeleteDialog'
import { Trash2, BookOpen, MapPin, Users, Zap, DollarSign, Building2 } from 'lucide-react'
import {
  BILLING_STATUSES, type PriceEntry, type BillingEntry, emptyPrice, emptyBilling,
} from '@/components/console/PricingCard'

const statusVariant: Record<string, string> = { active: 'success', paused: 'warning', completed: 'secondary', cancelled: 'destructive' }
const statusLabel:   Record<string, string> = { active: '稼働中', paused: '停止中', completed: '完了', cancelled: 'キャンセル' }

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-xs text-[var(--color-muted-foreground)]">{label}</dt>
      <dd className="font-medium mt-0.5 text-sm">{value || '—'}</dd>
    </div>
  )
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [project,    setProject]    = React.useState<any>(null)
  const [loading,    setLoading]    = React.useState(true)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [spots,      setSpots]      = React.useState<string[]>([])
  const [price,      setPrice]      = React.useState<PriceEntry>(emptyPrice())
  const [billing,    setBilling]    = React.useState<BillingEntry>(emptyBilling())
  const [clients,    setClients]    = React.useState<{ id: string; name: string }[]>([])
  const [empMap,     setEmpMap]     = React.useState<Record<string, string>>({})
  const [parMap,     setParMap]     = React.useState<Record<string, string>>({})

  React.useEffect(() => {
    async function load() {
      const [projRes, spotsRes, pricingRes, clientsRes] = await Promise.all([
        fetch(`/api/projects/${id}`, { credentials: 'include', cache: 'no-store' }).then(r => r.json()),
        fetch(`/api/projects/${id}/spots`, { credentials: 'include' }).then(r => r.json()),
        fetch(`/api/projects/${id}/pricing`, { credentials: 'include' }).then(r => r.json()),
        fetch('/api/clients?pageSize=100').then(r => r.json()),
      ])
      if (projRes.project) setProject(projRes.project)
      if (spotsRes.data) setSpots((spotsRes.data as any[]).map(s => s.name))
      if (pricingRes.prices?.[0]) {
        const p = pricingRes.prices[0]
        setPrice({ amount_ex_tax: Number(p.amount_ex_tax), tax_rate: Number(p.tax_rate), tax_amount: Number(p.tax_amount), amount_inc_tax: Number(p.amount_inc_tax) })
      }
      if (pricingRes.billing) {
        const b = pricingRes.billing
        setBilling({ billing_status: b.billing_status ?? 'unbilled', quote_number: b.quote_number ?? '', contract_date: b.contract_date ?? '', billing_date: b.billing_date ?? '', payment_due_date: b.payment_due_date ?? '', actual_payment_date: b.actual_payment_date ?? '', notes: b.notes ?? '' })
      }
      setClients(clientsRes.clients ?? [])
      setLoading(false)
    }
    load()
    Promise.all([
      fetch('/api/employees?pageSize=200&status=active', { credentials: 'include' }).then(r => r.json()),
      fetch('/api/partners?pageSize=200&status=active',  { credentials: 'include' }).then(r => r.json()),
    ]).then(([e, p]) => {
      setEmpMap(Object.fromEntries((e.data ?? []).map((x: any) => [x.id, x.name])))
      setParMap(Object.fromEntries((p.data ?? []).map((x: any) => [x.id, x.company_name])))
    })
  }, [id])

  async function handleDelete() {
    const { error } = await deleteProject(id)
    if (error) toast.error('削除に失敗しました')
    else { toast.success('案件を削除しました'); router.push('/projects') }
  }

  if (loading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-48" /><Skeleton className="h-64 w-full" /><Skeleton className="h-64 w-full" />
    </div>
  )
  if (!project) return <div className="text-center py-16 text-[var(--color-muted-foreground)]">案件が見つかりません</div>

  const clientName = clients.find(c => c.id === project.client_id)?.name ?? project.clients?.name
  const assignments: any[] = project.project_assignments ?? []

  return (
    <div>
      <PageHeader
        title={project.name}
        breadcrumb={<Breadcrumb items={[{ label: '案件管理', href: '/projects' }, { label: project.name }]} />}
        actions={
          <div className="flex gap-2">
            <Link href={`/projects/${id}/manuals`}>
              <Button variant="outline" size="sm"><BookOpen className="h-4 w-4" /> マニュアル</Button>
            </Link>
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="h-4 w-4" /> 削除
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">

          {/* 基本情報 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <Zap className="h-4 w-4" /> 基本情報
              </h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Row label="案件名"     value={project.name} />
                <Row label="案件コード" value={project.code} />
                <Row label="開始日"     value={project.start_date     ? new Date(project.start_date).toLocaleDateString('ja-JP')     : null} />
                <Row label="終了日"     value={project.end_date       ? new Date(project.end_date).toLocaleDateString('ja-JP')       : null} />
                <Row label="作業開始時間" value={project.work_start_time?.slice(0, 5)} />
                <Row label="作業終了時間" value={project.work_end_time?.slice(0, 5)} />
              </dl>
            </CardContent>
          </Card>

          {/* 作業場所 */}
          <Card>
            <CardContent className="pt-6 space-y-4">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <MapPin className="h-4 w-4" /> 作業場所
              </h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <Row label="作業場所名"     value={project.location_name} />
                <Row label="住所"           value={project.address} />
                <Row label="電話番号"       value={project.phone} />
                <Row label="緊急連絡先"     value={project.emergency_contact} />
                <Row label="作業可能時間帯" value={project.business_hours} />
              </dl>
            </CardContent>
          </Card>

          {/* 作業箇所 */}
          {spots.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">作業箇所</h2>
                <div className="flex flex-wrap gap-1.5">
                  {spots.map((s, i) => (
                    <span key={i} className="text-xs px-2 py-1 rounded-[var(--radius)]"
                      style={{ background: 'var(--color-primary-muted)', border: '1px solid var(--color-primary-glow)', color: 'var(--color-primary)' }}>
                      {s}
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 担当者 */}
          {assignments.length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-4 w-4" /> 担当者
                </h2>
                <ul className="space-y-1.5">
                  {assignments.map((a: any, i: number) => {
                    const name = a.assignee_type === 'employee' ? (empMap[a.assignee_id] ?? a.assignee_id) : (parMap[a.assignee_id] ?? a.assignee_id)
                    return (
                      <li key={i} className="flex items-center gap-2 text-sm rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2">
                        <span className="text-[var(--color-muted-foreground)] text-xs">{a.assignee_type === 'employee' ? '従業員' : '協力業者'}</span>
                        <span className="font-medium">{name}</span>
                      </li>
                    )
                  })}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* 詳細情報 */}
          {(project.contract_info || project.notes) && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">詳細情報</h2>
                {project.contract_info && (
                  <div>
                    <dt className="text-xs text-[var(--color-muted-foreground)] mb-1">契約内容</dt>
                    <dd className="text-sm whitespace-pre-wrap">{project.contract_info}</dd>
                  </div>
                )}
                {project.notes && (
                  <div>
                    <dt className="text-xs text-[var(--color-muted-foreground)] mb-1">注意事項</dt>
                    <dd className="text-sm whitespace-pre-wrap">{project.notes}</dd>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 契約金額 */}
          {price.amount_inc_tax > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                  <DollarSign className="h-4 w-4" /> 契約金額
                </h2>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                  {[
                    ['税抜金額', price.amount_ex_tax  > 0 ? price.amount_ex_tax.toLocaleString('ja-JP')  + '円' : '—'],
                    ['消費税',   price.tax_amount     > 0 ? price.tax_amount.toLocaleString('ja-JP')     + '円' : '—'],
                    ['税込合計', price.amount_inc_tax > 0 ? price.amount_inc_tax.toLocaleString('ja-JP') + '円' : '—'],
                  ].map(([l, v]) => (
                    <div key={l}><dt className="text-[var(--color-muted-foreground)] text-xs">{l}</dt><dd className="font-bold mt-0.5" style={{ color: 'oklch(0.73 0.12 78)' }}>{v}</dd></div>
                  ))}
                </dl>
              </CardContent>
            </Card>
          )}
        </div>

        {/* 右カラム */}
        <div className="space-y-4">
          {/* 顧客 */}
          <Card>
            <CardContent className="pt-6 space-y-2">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider flex items-center gap-2">
                <Building2 className="h-4 w-4" /> 顧客
              </h2>
              <p className="text-sm font-medium">{clientName ?? '—'}</p>
            </CardContent>
          </Card>

          {/* ステータス */}
          <Card>
            <CardContent className="pt-6 space-y-2">
              <h2 className="text-sm font-semibold text-[var(--color-muted-foreground)] uppercase tracking-wider">ステータス</h2>
              <Badge variant={statusVariant[project.status] as any}>{statusLabel[project.status] ?? project.status}</Badge>
            </CardContent>
          </Card>

          {/* マニュアル */}
          <Link href={`/projects/${id}/manuals`} className="block">
            <Card className="hover:border-[var(--color-primary)] transition-colors cursor-pointer">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-[var(--color-primary)]">
                  <BookOpen className="h-5 w-5" />
                  <span className="text-sm font-medium">マニュアルを管理</span>
                </div>
                <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">AIが参照する資料を登録・管理</p>
              </CardContent>
            </Card>
          </Link>

          <Button variant="destructive" className="w-full" onClick={() => setDeleteOpen(true)}>
            <Trash2 className="h-4 w-4" /> この案件を削除
          </Button>
        </div>
      </div>

      <ConfirmDeleteDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title={`「${project.name}」を削除しますか？`}
        description="案件に紐づくデータも削除されます。この操作は取り消せません。"
      />
    </div>
  )
}
