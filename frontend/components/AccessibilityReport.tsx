'use client'

import { BarChart3 } from 'lucide-react'
import type { PersonaResult } from '@/types'

interface AccessibilityReportProps {
  personas: PersonaResult[]
}

const IMPACT_COLORS: Record<string, string> = {
  critical: '#dc2626',
  serious: '#ef4444',
  moderate: '#f59e0b',
  minor: '#6366f1',
}

const IMPACT_ORDER = ['critical', 'serious', 'moderate', 'minor']

export function AccessibilityReport({ personas }: AccessibilityReportProps) {
  // Aggregate all unique violations across personas (dedupe by id)
  const seenIds = new Set<string>()
  const allViolations: Array<{
    id: string
    impact: string
    description: string
    help: string
    help_url: string
    nodes_count: number
  }> = []

  for (const p of personas) {
    for (const v of p.a11y_violations ?? []) {
      if (!seenIds.has(v.id)) {
        seenIds.add(v.id)
        allViolations.push(v)
      }
    }
  }

  // Group by impact
  const grouped: Record<string, typeof allViolations> = {}
  for (const v of allViolations) {
    const impact = v.impact || 'minor'
    if (!grouped[impact]) grouped[impact] = []
    grouped[impact].push(v)
  }

  return (
    <div
      className="rounded-2xl p-6 space-y-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      <div className="flex items-center gap-2">
        <BarChart3 size={15} className="text-purple-400" />
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Accessibility Audit</h2>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
          {allViolations.length} issue{allViolations.length !== 1 ? 's' : ''} found
        </span>
      </div>

      {allViolations.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            No accessibility violations detected
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {IMPACT_ORDER.filter(impact => grouped[impact]?.length).map(impact => (
            <div key={impact} className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: IMPACT_COLORS[impact] }}>
                {impact} ({grouped[impact].length})
              </h3>
              <div className="space-y-2">
                {grouped[impact].map(v => (
                  <div
                    key={v.id}
                    className="rounded-xl p-4"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
                  >
                    <div className="flex items-start gap-3">
                      <span
                        className="mt-0.5 shrink-0 text-[10px] font-bold uppercase px-2 py-0.5 rounded-full"
                        style={{
                          color: IMPACT_COLORS[impact],
                          background: `${IMPACT_COLORS[impact]}15`,
                          border: `1px solid ${IMPACT_COLORS[impact]}30`,
                        }}
                      >
                        {impact}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                          {v.description}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                          {v.help}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                            {v.nodes_count} element{v.nodes_count !== 1 ? 's' : ''} affected
                          </span>
                          {v.help_url && (
                            <a
                              href={v.help_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[11px] underline"
                              style={{ color: 'var(--text-tertiary)' }}
                            >
                              Learn more
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
