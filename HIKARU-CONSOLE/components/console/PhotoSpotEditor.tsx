'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'

export type EditablePhotoSpot = {
  name: string
  description: string
}

interface Props {
  spots: EditablePhotoSpot[]
  onChange: (spots: EditablePhotoSpot[]) => void
}

export function PhotoSpotEditor({ spots, onChange }: Props) {
  function updName(i: number, val: string) {
    onChange(spots.map((s, idx) => idx === i ? { ...s, name: val } : s))
  }
  function updDesc(i: number, val: string) {
    onChange(spots.map((s, idx) => idx === i ? { ...s, description: val } : s))
  }
  function remove(i: number) {
    onChange(spots.length <= 1 ? [{ name: '', description: '' }] : spots.filter((_, idx) => idx !== i))
  }
  function add() {
    onChange([...spots, { name: '', description: '' }])
  }

  return (
    <div className="space-y-3">
      {spots.map((spot, i) => (
        <div
          key={i}
          className="rounded-[var(--radius)] border border-[var(--color-border)] p-3 space-y-2"
        >
          <div className="flex items-center gap-2">
            <div
              className="flex h-6 w-6 items-center justify-center rounded-full shrink-0 text-[10px] font-bold"
              style={{
                background: 'var(--color-primary-muted)',
                border: '1px solid var(--color-primary-glow)',
                color: 'var(--color-primary)',
              }}
            >
              {i + 1}
            </div>
            <input
              type="text"
              value={spot.name}
              onChange={(e) => updName(i, e.target.value)}
              placeholder={
                i === 0 ? '例: エアコン清掃' :
                i === 1 ? '例: 床清掃' :
                i === 2 ? '例: トイレ清掃' :
                '例: 窓清掃...'
              }
              maxLength={50}
              className="flex-1 rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
            />
            <button
              type="button"
              onClick={() => remove(i)}
              className="p-1.5 rounded-[var(--radius)] hover:opacity-80 shrink-0"
              style={{ color: 'var(--color-error-foreground)' }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
          <textarea
            value={spot.description}
            onChange={(e) => updDesc(i, e.target.value)}
            placeholder="説明（任意）例: 洗面所の鏡面。水滴・拭き跡・曇りを確認"
            maxLength={300}
            rows={2}
            className="w-full rounded-[var(--radius)] border border-[var(--color-border)] bg-[var(--color-background)] px-3 py-2 text-sm text-[var(--color-foreground)] placeholder:text-[var(--color-muted-foreground)] resize-none focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
          />
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-[var(--radius-lg)] text-sm border-dashed hover:opacity-80"
        style={{ border: '1.5px dashed var(--color-border)', color: 'var(--color-muted-foreground)' }}
      >
        <Plus className="h-4 w-4" />
        箇所を追加する
      </button>
    </div>
  )
}
