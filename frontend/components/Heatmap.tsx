'use client'

import type { PersonaResult } from '@/types'

interface HeatmapProps {
  personas: PersonaResult[]
}

export function Heatmap({ personas }: HeatmapProps) {
  // Collect all click points across all personas
  const allClickPoints = personas.flatMap(p => p.click_points ?? [])
  if (allClickPoints.length === 0) return null

  // Find the last screenshot from any persona (most complete view)
  let lastScreenshot = ''
  for (const p of personas) {
    const events = p.events ?? []
    for (const e of events) {
      if (e.screenshot) {
        lastScreenshot = e.screenshot
      }
    }
  }

  if (!lastScreenshot) return null

  return (
    <div
      className="rounded-2xl p-6 space-y-4"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
    >
      <div className="flex items-center gap-2">
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="text-red-400">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
        </svg>
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
          Click Heatmap
          <span className="text-xs font-normal ml-2" style={{ color: 'var(--text-tertiary)' }}>
            {allClickPoints.length} total clicks
          </span>
        </h2>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
          Hot spots where AI users clicked
        </span>
      </div>

      <div
        className="relative rounded-lg overflow-hidden"
        style={{ border: '1px solid var(--border-primary)', aspectRatio: '16 / 10' }}
      >
        {/* Background screenshot */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${lastScreenshot}`}
          alt="Page screenshot with click heatmap overlay"
          className="absolute inset-0 w-full h-full object-cover object-top"
          draggable={false}
        />

        {/* SVG heatmap overlay with gaussian blur */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          viewBox="0 0 1280 800"
          preserveAspectRatio="xMidYMid slice"
          style={{ mixBlendMode: 'screen' }}
        >
          <defs>
            <filter id="heatmap-blur" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="15" />
            </filter>
          </defs>
          <g filter="url(#heatmap-blur)">
            {allClickPoints.map((point, i) => (
              <circle
                key={i}
                cx={point.x}
                cy={point.y}
                r={20}
                fill="rgba(239,68,68,0.5)"
              />
            ))}
          </g>
        </svg>
      </div>

      {/* Color legend bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
          <span>Cold (no clicks)</span>
          <span>Hot (many clicks)</span>
        </div>
        <div
          className="h-2 rounded-full w-full"
          style={{
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6, #f59e0b, #ef4444)',
          }}
        />
      </div>
    </div>
  )
}
