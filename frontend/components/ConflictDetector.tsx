'use client'

import { Zap } from 'lucide-react'
import type { PersonaResult } from '@/types'

interface ConflictDetectorProps {
  personas: PersonaResult[]
}

interface Conflict {
  url: string
  persona_high: string
  score_high: number
  persona_low: string
  score_low: number
}

export function ConflictDetector({ personas }: ConflictDetectorProps) {
  if (personas.length < 2) return null

  // Build per-persona, per-URL confusion scores (use max confusion per URL per persona)
  const personaUrlScores: Map<string, Map<string, number>> = new Map()

  for (const p of personas) {
    const urlScores: Map<string, number> = new Map()
    for (const e of p.events ?? []) {
      const existing = urlScores.get(e.url) ?? 0
      urlScores.set(e.url, Math.max(existing, e.confusion_score))
    }
    personaUrlScores.set(p.persona_id, urlScores)
  }

  // Find conflicts: one persona >= 6 confusion and another <= 2 on same URL
  const conflicts: Conflict[] = []
  const seenConflicts = new Set<string>()

  for (let i = 0; i < personas.length; i++) {
    for (let j = i + 1; j < personas.length; j++) {
      const pA = personas[i]
      const pB = personas[j]
      const scoresA = personaUrlScores.get(pA.persona_id) ?? new Map()
      const scoresB = personaUrlScores.get(pB.persona_id) ?? new Map()

      // Check all URLs both visited
      const allUrlsArr = Array.from(new Set([...Array.from(scoresA.keys()), ...Array.from(scoresB.keys())]))
      for (let ui = 0; ui < allUrlsArr.length; ui++) {
        const url = allUrlsArr[ui]
        const scoreA = scoresA.get(url)
        const scoreB = scoresB.get(url)
        if (scoreA === undefined || scoreB === undefined) continue

        let high: typeof pA | null = null
        let low: typeof pA | null = null
        let highScore = 0
        let lowScore = 0

        if (scoreA >= 6 && scoreB <= 2) {
          high = pA; low = pB; highScore = scoreA; lowScore = scoreB
        } else if (scoreB >= 6 && scoreA <= 2) {
          high = pB; low = pA; highScore = scoreB; lowScore = scoreA
        }

        if (high && low) {
          const key = `${url}|${high.persona_id}|${low.persona_id}`
          if (!seenConflicts.has(key)) {
            seenConflicts.add(key)
            conflicts.push({
              url,
              persona_high: high.persona_name,
              score_high: highScore,
              persona_low: low.persona_name,
              score_low: lowScore,
            })
          }
        }
      }
    }
  }

  return (
    <div
      className="rounded-2xl p-6 space-y-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      <div className="flex items-center gap-2">
        <Zap size={15} className="text-amber-400" />
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Persona Conflicts</h2>
        {conflicts.length > 0 && (
          <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
            {conflicts.length} conflict{conflicts.length !== 1 ? 's' : ''} detected
          </span>
        )}
      </div>

      {conflicts.length === 0 ? (
        <div className="text-center py-6">
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
            All personas had similar experiences — no significant conflicts detected
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {conflicts.map((c, i) => {
            let displayUrl: string
            try {
              const u = new URL(c.url)
              displayUrl = u.pathname + u.search
              if (displayUrl.length > 60) displayUrl = displayUrl.slice(0, 57) + '...'
            } catch {
              displayUrl = c.url.length > 60 ? c.url.slice(0, 57) + '...' : c.url
            }

            return (
              <div
                key={i}
                className="rounded-xl p-4"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
              >
                <p className="text-xs mb-3 truncate" style={{ color: 'var(--text-tertiary)' }} title={c.url}>
                  {displayUrl}
                </p>
                <div className="flex items-center gap-3">
                  {/* Frustrated persona */}
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ color: '#ef4444', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
                  >
                    {c.persona_high} ({c.score_high}/10)
                  </span>

                  <span className="text-xs font-medium" style={{ color: 'var(--text-tertiary)' }}>vs</span>

                  {/* Fine persona */}
                  <span
                    className="text-xs font-semibold px-2.5 py-1 rounded-full"
                    style={{ color: '#10b981', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}
                  >
                    {c.persona_low} ({c.score_low}/10)
                  </span>
                </div>
                <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                  {c.persona_high} struggled here while {c.persona_low} had no issues
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
