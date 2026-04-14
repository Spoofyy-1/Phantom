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
        <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Click Heatmap</h2>
        <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>
          Hot spots where AI users clicked
        </span>
      </div>

      <div className="relative rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
        {/* Background screenshot */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${lastScreenshot}`}
          alt="Page screenshot with click heatmap overlay"
          className="w-full block"
          draggable={false}
        />

        {/* Click point overlays — positioned relative to 1280x800 viewport */}
        {allClickPoints.map((point, i) => (
          <div
            key={i}
            className="absolute pointer-events-none"
            style={{
              left: `${(point.x / 1280) * 100}%`,
              top: `${(point.y / 800) * 100}%`,
              width: 24,
              height: 24,
              marginLeft: -12,
              marginTop: -12,
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(239,68,68,0.6) 0%, transparent 70%)',
              mixBlendMode: 'screen',
            }}
            title={`Step ${point.step} — (${point.x}, ${point.y})`}
          />
        ))}
      </div>

      <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-tertiary)' }}>
        <span className="flex items-center gap-1.5">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(239,68,68,0.6) 0%, transparent 70%)' }}
          />
          Click point
        </span>
        <span>{allClickPoints.length} total clicks tracked</span>
      </div>
    </div>
  )
}
