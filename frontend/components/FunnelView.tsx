'use client'

import { useState, useEffect } from 'react'
import { Filter } from 'lucide-react'
import type { PersonaResult } from '@/types'

interface FunnelViewProps {
  personas: PersonaResult[]
}

export function FunnelView({ personas }: FunnelViewProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 100)
    return () => clearTimeout(t)
  }, [])

  if (personas.length === 0) return null

  // Build ordered list of unique URLs across all personas by first-visit order
  const urlOrder: string[] = []
  const urlSet = new Set<string>()

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

  // For each URL, count how many personas visited it and track which ones
  const personaUrlSets = personas.map(p => {
    const urls = new Set<string>()
    for (const e of p.events ?? []) {
      urls.add(e.url)
    }
    return { urls, avatar: p.persona_avatar, name: p.persona_name }
  })

  const totalPersonas = personas.length
  const funnelSteps = urlOrder.map(url => {
    const count = personaUrlSets.filter(s => s.urls.has(url)).length
    const avatars = personaUrlSets
      .filter(s => s.urls.has(url))
      .map(s => s.avatar)
    return { url, count, avatars }
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

  // Show hostname only, strip protocol
  function displayUrl(url: string): string {
    try {
      const u = new URL(url)
      const path = u.pathname === '/' ? '' : u.pathname
      const host = u.hostname.replace(/^www\./, '')
      const display = host + path + u.search
      if (display.length > 50) return display.slice(0, 47) + '...'
      return display || host
    } catch {
      return url.length > 50 ? url.slice(0, 47) + '...' : url
    }
  }

  return (
    <div
      className="rounded-2xl p-6 space-y-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      <style>{`
        @keyframes funnelPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
      `}</style>

      <div className="flex items-center gap-2">
        <Filter size={15} className="text-purple-400" />
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Navigation Funnel</h2>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
          {urlOrder.length} pages visited
        </span>
      </div>

      <div className="space-y-1">
        {funnelSteps.map((step, i) => {
          const widthPct = Math.max((step.count / totalPersonas) * 100, 8)
          const dropOff = i > 0 ? funnelSteps[i - 1].count - step.count : 0
          const dropPct = i > 0 && funnelSteps[i - 1].count > 0
            ? Math.round((dropOff / funnelSteps[i - 1].count) * 100)
            : 0
          const isBiggestDrop = i === maxDropIdx && maxDrop > 0

          return (
            <div key={i}>
              {/* Drop-off indicator between steps */}
              {dropOff > 0 && (
                <div className="flex items-center gap-2 py-1 pl-4">
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{
                      color: isBiggestDrop ? '#fff' : '#ef4444',
                      background: isBiggestDrop ? '#ef4444' : 'rgba(239,68,68,0.1)',
                      border: isBiggestDrop ? 'none' : '1px solid rgba(239,68,68,0.2)',
                      animation: isBiggestDrop ? 'funnelPulse 2s ease-in-out infinite' : 'none',
                    }}
                  >
                    <span style={{ fontSize: '11px' }}>↓</span> {dropPct}% drop-off
                  </span>
                </div>
              )}

              <div className="flex items-center gap-2">
                {/* Persona avatars */}
                <div className="flex -space-x-1 shrink-0 w-[60px] justify-end">
                  {step.avatars.slice(0, 4).map((avatar, ai) => (
                    <span
                      key={ai}
                      className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[10px] border border-[var(--bg-card)]"
                      style={{ background: 'var(--bg-tertiary)', zIndex: 4 - ai }}
                    >
                      {avatar}
                    </span>
                  ))}
                  {step.avatars.length > 4 && (
                    <span
                      className="inline-flex items-center justify-center h-5 w-5 rounded-full text-[8px] font-bold border border-[var(--bg-card)]"
                      style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}
                    >
                      +{step.avatars.length - 4}
                    </span>
                  )}
                </div>

                {/* Bar with gradient fill and animated width */}
                <div
                  className="h-8 rounded-lg flex items-center px-3"
                  style={{
                    width: mounted ? `${widthPct}%` : '0%',
                    background: isBiggestDrop
                      ? 'linear-gradient(90deg, #ef4444, #f87171)'
                      : 'linear-gradient(90deg, #7c3aed, #a78bfa)',
                    minWidth: mounted ? 'fit-content' : '0',
                    transition: `width 0.8s cubic-bezier(0.22,1,0.36,1) ${i * 0.12}s, min-width 0s ${i * 0.12}s`,
                    overflow: 'hidden',
                  }}
                >
                  <span className="text-[11px] font-medium text-white whitespace-nowrap">
                    {step.count}/{totalPersonas}
                  </span>
                </div>

                {/* URL label */}
                <div className="flex-1 min-w-0">
                  <span
                    className="text-xs truncate block font-mono"
                    style={{ color: 'var(--text-secondary)' }}
                    title={step.url}
                  >
                    {displayUrl(step.url)}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
