'use client'

import { Filter } from 'lucide-react'
import type { PersonaResult } from '@/types'

interface FunnelViewProps {
  personas: PersonaResult[]
}

export function FunnelView({ personas }: FunnelViewProps) {
  if (personas.length === 0) return null

  // Build ordered list of unique URLs across all personas by first-visit order
  const urlOrder: string[] = []
  const urlSet = new Set<string>()

  // Gather all events sorted by step across all personas
  const allSteps: Array<{ url: string; persona_id: string; step: number }> = []
  for (const p of personas) {
    for (const e of p.events ?? []) {
      allSteps.push({ url: e.url, persona_id: p.persona_id, step: e.step })
    }
  }
  allSteps.sort((a, b) => a.step - b.step)

  for (const s of allSteps) {
    if (!urlSet.has(s.url)) {
      urlSet.add(s.url)
      urlOrder.push(s.url)
    }
  }

  if (urlOrder.length === 0) return null

  // For each URL, count how many personas visited it
  const personaUrlSets = personas.map(p => {
    const urls = new Set<string>()
    for (const e of p.events ?? []) {
      urls.add(e.url)
    }
    return urls
  })

  const totalPersonas = personas.length
  const funnelSteps = urlOrder.map(url => {
    const count = personaUrlSets.filter(s => s.has(url)).length
    return { url, count }
  })

  // Find biggest drop-off
  let maxDropIdx = -1
  let maxDrop = 0
  for (let i = 1; i < funnelSteps.length; i++) {
    const drop = funnelSteps[i - 1].count - funnelSteps[i].count
    if (drop > maxDrop) {
      maxDrop = drop
      maxDropIdx = i
    }
  }

  // Truncate URL for display
  function truncateUrl(url: string): string {
    try {
      const u = new URL(url)
      const path = u.pathname + u.search
      if (path.length > 50) return path.slice(0, 47) + '...'
      return path || '/'
    } catch {
      return url.length > 50 ? url.slice(0, 47) + '...' : url
    }
  }

  return (
    <div
      className="rounded-2xl p-6 space-y-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      <div className="flex items-center gap-2">
        <Filter size={15} className="text-purple-400" />
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Navigation Funnel</h2>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
          {urlOrder.length} pages visited
        </span>
      </div>

      <div className="space-y-2">
        {funnelSteps.map((step, i) => {
          const widthPct = Math.max((step.count / totalPersonas) * 100, 8)
          const dropOff = i > 0 ? funnelSteps[i - 1].count - step.count : 0
          const dropPct = i > 0 && funnelSteps[i - 1].count > 0
            ? Math.round((dropOff / funnelSteps[i - 1].count) * 100)
            : 0
          const isBiggestDrop = i === maxDropIdx && maxDrop > 0

          return (
            <div key={i} className="space-y-1">
              <div className="flex items-center gap-2">
                <div
                  className="h-8 rounded-lg flex items-center px-3 transition-all duration-500"
                  style={{
                    width: `${widthPct}%`,
                    background: isBiggestDrop
                      ? 'linear-gradient(90deg, #ef4444, #dc2626)'
                      : 'linear-gradient(90deg, #6366f1, #8b5cf6)',
                    minWidth: 'fit-content',
                  }}
                >
                  <span className="text-[11px] font-medium text-white whitespace-nowrap">
                    {step.count}/{totalPersonas}
                  </span>
                </div>
                <div className="flex-1 min-w-0 flex items-center gap-2">
                  <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }} title={step.url}>
                    {truncateUrl(step.url)}
                  </span>
                  {dropOff > 0 && (
                    <span
                      className="text-[10px] font-semibold shrink-0 px-1.5 py-0.5 rounded"
                      style={{
                        color: isBiggestDrop ? '#ef4444' : 'var(--text-tertiary)',
                        background: isBiggestDrop ? 'rgba(239,68,68,0.1)' : 'transparent',
                      }}
                    >
                      -{dropPct}%
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
