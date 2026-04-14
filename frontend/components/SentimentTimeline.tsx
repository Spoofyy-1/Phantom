'use client'

import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import type { PersonaResult } from '@/types'

interface SentimentTimelineProps {
  personas: PersonaResult[]
}

const PALETTE = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#14b8a6', '#ef4444', '#8b5cf6', '#f97316']

function smoothPath(points: Array<{ x: number; y: number }>): string {
  if (points.length < 2) return ''
  let d = `M ${points[0].x} ${points[0].y}`
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const curr = points[i]
    const cpx = (prev.x + curr.x) / 2
    d += ` C ${cpx} ${prev.y}, ${cpx} ${curr.y}, ${curr.x} ${curr.y}`
  }
  return d
}

export function SentimentTimeline({ personas }: SentimentTimelineProps) {
  const [hovered, setHovered] = useState<{ personaIdx: number; stepIdx: number } | null>(null)

  const withEvents = personas.filter(p => (p.events ?? []).length > 0)
  if (withEvents.length === 0) return null

  const maxSteps = Math.max(...withEvents.map(p => p.events.length))
  if (maxSteps === 0) return null

  const svgWidth = 700
  const svgHeight = 260
  const padLeft = 50
  const padRight = 20
  const padTop = 20
  const padBottom = 35
  const chartW = svgWidth - padLeft - padRight
  const chartH = svgHeight - padTop - padBottom

  function xPos(step: number): number {
    return padLeft + (step / Math.max(maxSteps - 1, 1)) * chartW
  }
  function yPos(sentiment: number): number {
    return padTop + (1 - sentiment / 10) * chartH
  }

  const zones = [
    { label: 'Happy', y: 10, color: '#10b981' },
    { label: 'Neutral', y: 5, color: '#f59e0b' },
    { label: 'Stuck', y: 0, color: '#ef4444' },
  ]

  return (
    <div
      className="rounded-2xl p-6 space-y-5"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp size={15} className="text-purple-400" />
          <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Sentiment Over Time</h2>
        </div>
        <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
          Higher = happier experience
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4">
        {withEvents.map((p, i) => (
          <span key={p.persona_id} className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
            <span
              className="inline-block w-3 h-3 rounded-full"
              style={{ background: PALETTE[i % PALETTE.length], boxShadow: `0 0 6px ${PALETTE[i % PALETTE.length]}60` }}
            />
            {p.persona_name}
            <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-tertiary)' }}>
              {p.events.length} steps
            </span>
          </span>
        ))}
      </div>

      {/* Chart */}
      <div className="relative">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full"
          style={{ height: 260 }}
          preserveAspectRatio="xMidYMid meet"
        >
          <defs>
            {withEvents.map((_, i) => (
              <linearGradient key={i} id={`sentGrad-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0.2} />
                <stop offset="100%" stopColor={PALETTE[i % PALETTE.length]} stopOpacity={0} />
              </linearGradient>
            ))}
          </defs>

          {/* Zone backgrounds */}
          <rect x={padLeft} y={yPos(10)} width={chartW} height={yPos(7) - yPos(10)} fill="#10b98108" rx={2} />
          <rect x={padLeft} y={yPos(7)} width={chartW} height={yPos(3) - yPos(7)} fill="#f59e0b05" rx={2} />
          <rect x={padLeft} y={yPos(3)} width={chartW} height={yPos(0) - yPos(3)} fill="#ef444408" rx={2} />

          {/* Grid lines */}
          {[0, 2.5, 5, 7.5, 10].map(val => (
            <line
              key={val}
              x1={padLeft}
              x2={svgWidth - padRight}
              y1={yPos(val)}
              y2={yPos(val)}
              stroke="var(--border-secondary)"
              strokeWidth={val === 5 ? 0.8 : 0.4}
              strokeDasharray={val === 5 ? '6,4' : '3,4'}
            />
          ))}

          {/* Y axis labels */}
          {zones.map(z => (
            <text
              key={z.label}
              x={padLeft - 8}
              y={yPos(z.y)}
              textAnchor="end"
              dominantBaseline="middle"
              fill={z.color}
              fontSize={10}
              fontWeight={600}
              opacity={0.7}
            >
              {z.label}
            </text>
          ))}

          {/* X axis labels */}
          {Array.from({ length: Math.min(maxSteps, 12) }, (_, i) => {
            const step = maxSteps <= 12 ? i : Math.round((i / 11) * (maxSteps - 1))
            return (
              <text key={step} x={xPos(step)} y={svgHeight - 8} textAnchor="middle" fill="var(--text-tertiary)" fontSize={10}>
                {step + 1}
              </text>
            )
          })}
          <text x={svgWidth / 2} y={svgHeight} textAnchor="middle" fill="var(--text-tertiary)" fontSize={9} opacity={0.5}>
            Step
          </text>

          {/* Area fills + lines + dots for each persona */}
          {withEvents.map((p, pi) => {
            const color = PALETTE[pi % PALETTE.length]
            const points = p.events.map((e, si) => ({
              x: xPos(si),
              y: yPos(10 - e.confusion_score),
              sentiment: 10 - e.confusion_score,
              confusion: e.confusion_score,
              step: e.step,
            }))

            const linePath = smoothPath(points)
            // Area path: line + close to bottom
            const areaPath = linePath
              ? `${linePath} L ${points[points.length - 1].x} ${yPos(0)} L ${points[0].x} ${yPos(0)} Z`
              : ''

            return (
              <g key={p.persona_id}>
                {/* Gradient fill under line */}
                {areaPath && (
                  <path d={areaPath} fill={`url(#sentGrad-${pi})`} />
                )}
                {/* Smooth line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                {/* Dots */}
                {points.map((pt, i) => {
                  const isHovered = hovered?.personaIdx === pi && hovered?.stepIdx === i
                  return (
                    <g key={i}>
                      {/* Invisible larger hit area */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={10}
                        fill="transparent"
                        onMouseEnter={() => setHovered({ personaIdx: pi, stepIdx: i })}
                        onMouseLeave={() => setHovered(null)}
                        style={{ cursor: 'pointer' }}
                      />
                      {/* Visible dot */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isHovered ? 5 : 3.5}
                        fill={color}
                        stroke="var(--bg-card)"
                        strokeWidth={2}
                        style={{ transition: 'r 0.15s ease' }}
                      />
                      {/* Hover glow */}
                      {isHovered && (
                        <circle cx={pt.x} cy={pt.y} r={12} fill={`${color}20`} />
                      )}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {hovered && (() => {
          const p = withEvents[hovered.personaIdx]
          const e = p.events[hovered.stepIdx]
          const sentiment = 10 - e.confusion_score
          const color = PALETTE[hovered.personaIdx % PALETTE.length]
          const x = xPos(hovered.stepIdx)
          const tooltipLeft = `${(x / svgWidth) * 100}%`
          return (
            <div
              className="absolute pointer-events-none z-10 rounded-lg px-3 py-2 text-xs shadow-lg"
              style={{
                left: tooltipLeft,
                top: 8,
                transform: 'translateX(-50%)',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-primary)',
                boxShadow: `0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px ${color}30`,
              }}
            >
              <div className="font-semibold" style={{ color }}>{p.persona_name}</div>
              <div style={{ color: 'var(--text-secondary)' }}>
                Step {e.step} · Confusion: {e.confusion_score}/10
              </div>
              <div className="mt-0.5" style={{ color: sentiment >= 7 ? '#10b981' : sentiment >= 4 ? '#f59e0b' : '#ef4444' }}>
                {sentiment >= 8 ? 'Smooth sailing' : sentiment >= 6 ? 'Slightly confused' : sentiment >= 4 ? 'Struggling' : 'Very frustrated'}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
