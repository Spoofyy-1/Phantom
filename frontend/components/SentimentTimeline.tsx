'use client'

import { TrendingUp } from 'lucide-react'
import type { PersonaResult } from '@/types'

interface SentimentTimelineProps {
  personas: PersonaResult[]
}

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444', '#8b5cf6', '#f97316']

export function SentimentTimeline({ personas }: SentimentTimelineProps) {
  // Filter personas with events
  const withEvents = personas.filter(p => (p.events ?? []).length > 0)
  if (withEvents.length === 0) return null

  // Find max steps across all personas
  const maxSteps = Math.max(...withEvents.map(p => p.events.length))
  if (maxSteps === 0) return null

  // SVG dimensions
  const svgWidth = 600
  const svgHeight = 200
  const padLeft = 35
  const padRight = 15
  const padTop = 15
  const padBottom = 25
  const chartW = svgWidth - padLeft - padRight
  const chartH = svgHeight - padTop - padBottom

  function xPos(step: number): number {
    return padLeft + (step / Math.max(maxSteps - 1, 1)) * chartW
  }

  function yPos(sentiment: number): number {
    // sentiment = 10 - confusion_score, range 0..10, higher=happier
    return padTop + (1 - sentiment / 10) * chartH
  }

  return (
    <div
      className="rounded-2xl p-6 space-y-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      <div className="flex items-center gap-2">
        <TrendingUp size={15} className="text-purple-400" />
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Sentiment Over Time</h2>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-3">
        {withEvents.map((p, i) => (
          <span key={p.persona_id} className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span
              className="inline-block w-3 h-0.5 rounded-full"
              style={{ background: PALETTE[i % PALETTE.length] }}
            />
            {p.persona_name}
          </span>
        ))}
      </div>

      {/* SVG chart */}
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full"
        style={{ height: 200 }}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {[2.5, 5, 7.5].map(val => (
          <line
            key={val}
            x1={padLeft}
            x2={svgWidth - padRight}
            y1={yPos(val)}
            y2={yPos(val)}
            stroke="var(--border-primary)"
            strokeWidth={0.5}
            strokeDasharray="4,4"
          />
        ))}

        {/* Y axis labels */}
        <text x={padLeft - 5} y={yPos(10)} textAnchor="end" dominantBaseline="middle" fill="var(--text-tertiary)" fontSize={9}>Happy</text>
        <text x={padLeft - 5} y={yPos(5)} textAnchor="end" dominantBaseline="middle" fill="var(--text-tertiary)" fontSize={9}>Neutral</text>
        <text x={padLeft - 5} y={yPos(0)} textAnchor="end" dominantBaseline="middle" fill="var(--text-tertiary)" fontSize={9}>Stuck</text>

        {/* X axis labels */}
        {Array.from({ length: Math.min(maxSteps, 10) }, (_, i) => {
          const step = maxSteps <= 10 ? i : Math.round((i / 9) * (maxSteps - 1))
          return (
            <text key={step} x={xPos(step)} y={svgHeight - 5} textAnchor="middle" fill="var(--text-tertiary)" fontSize={9}>
              {step + 1}
            </text>
          )
        })}

        {/* Lines and dots for each persona */}
        {withEvents.map((p, pi) => {
          const color = PALETTE[pi % PALETTE.length]
          const points = p.events.map((e, si) => ({
            x: xPos(si),
            y: yPos(10 - e.confusion_score),
            sentiment: 10 - e.confusion_score,
            confusion: e.confusion_score,
            step: e.step,
          }))

          const pathD = points
            .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`)
            .join(' ')

          return (
            <g key={p.persona_id}>
              <path d={pathD} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
              {points.map((pt, i) => (
                <circle key={i} cx={pt.x} cy={pt.y} r={3} fill={color} stroke="var(--bg-card)" strokeWidth={1.5}>
                  <title>Step {pt.step}: confusion {pt.confusion}/10</title>
                </circle>
              ))}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
