'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Image as ImageIcon } from 'lucide-react'
import type { TestResults, PersonaResult, ConfusionEvent } from '@/types'
import clsx from 'clsx'

function ScoreRing({ score }: { score: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const pct = score / 10
  const dashOffset = circ * (1 - pct)
  const color = score >= 7 ? '#10b981' : score >= 4 ? '#f59e0b' : '#ef4444'

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={72} height={72} className="-rotate-90">
        <circle cx={36} cy={36} r={r} fill="none" stroke="#1e1e2e" strokeWidth={5} />
        <circle
          cx={36}
          cy={36}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s ease' }}
        />
      </svg>
      <span className="absolute text-xl font-bold" style={{ color }}>
        {score.toFixed(1)}
      </span>
    </div>
  )
}

function ConfusionCard({ event, index }: { event: ConfusionEvent; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const scoreColor = event.confusion_score >= 7 ? '#ef4444' : event.confusion_score >= 4 ? '#f59e0b' : '#10b981'

  return (
    <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d14] overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-[#111118] transition-colors"
      >
        <span
          className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-black"
          style={{ backgroundColor: scoreColor }}
        >
          {index + 1}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {event.persona_name && (
              <span className="text-[11px] font-medium text-purple-400">{event.persona_name}</span>
            )}
            <span className="text-[11px] text-[#555570]">Step {event.step}</span>
            <span
              className="ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${scoreColor}20`, color: scoreColor }}
            >
              {event.confusion_score}/10
            </span>
          </div>
          <p className="text-sm text-[#e2e2f0] leading-relaxed line-clamp-2">
            {event.confusion_note}
          </p>
          <p className="text-xs text-[#555570] mt-1 truncate">{event.url}</p>
        </div>
        {expanded ? (
          <ChevronUp size={16} className="text-[#555570] shrink-0 mt-1" />
        ) : (
          <ChevronDown size={16} className="text-[#555570] shrink-0 mt-1" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-[#1e1e2e] p-4 space-y-3">
          <div className="rounded-lg bg-[#111118] border border-[#1e1e2e] p-3">
            <p className="text-xs text-[#555570] mb-1">Internal thought</p>
            <p className="text-sm text-[#8888aa] italic">"{event.thought}"</p>
          </div>
          {event.screenshot && (
            <div className="rounded-lg overflow-hidden border border-[#1e1e2e]">
              <div className="flex items-center gap-2 px-3 py-2 bg-[#111118] border-b border-[#1e1e2e]">
                <ImageIcon size={12} className="text-[#555570]" />
                <span className="text-[11px] text-[#555570]">Screenshot at confusion point</span>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${event.screenshot}`}
                alt="Screenshot at confusion point"
                className="w-full"
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function PersonaSummary({ result }: { result: PersonaResult }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="rounded-2xl border border-[#1e1e2e] bg-[#111118] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-5 text-left hover:bg-[#0d0d14] transition-colors"
      >
        <span className="text-2xl">{result.persona_avatar}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold text-[#e2e2f0]">{result.persona_name}</p>
            {result.success ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-2 py-0.5">
                <CheckCircle2 size={10} />
                Completed
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-full px-2 py-0.5">
                <XCircle size={10} />
                Gave up
              </span>
            )}
          </div>
          <p className="text-xs text-[#8888aa] mt-0.5 line-clamp-1">{result.reason}</p>
        </div>
        <div className="text-right shrink-0 mr-2">
          <p className="text-sm font-semibold text-[#e2e2f0]">{result.steps_taken} steps</p>
          <p className="text-xs text-[#555570]">{result.confusion_events.length} friction pts</p>
        </div>
        {open ? <ChevronUp size={16} className="text-[#555570]" /> : <ChevronDown size={16} className="text-[#555570]" />}
      </button>

      {open && (
        <div className="border-t border-[#1e1e2e] p-5 space-y-4">
          {result.confusion_events.length === 0 ? (
            <p className="text-sm text-[#8888aa] text-center py-4">No confusion events — smooth sailing!</p>
          ) : (
            result.confusion_events.map((ce, i) => (
              <ConfusionCard key={i} event={ce} index={i} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export function ResultsView({ results }: { results: TestResults }) {
  const { ux_score, succeeded, total_personas, top_issues, personas } = results

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Overall score */}
      <div className="rounded-2xl border border-[#1e1e2e] bg-[#111118] p-6">
        <div className="flex items-center gap-6">
          <ScoreRing score={ux_score} />
          <div>
            <p className="text-2xl font-bold text-[#e2e2f0]">UX Score</p>
            <p className="text-[#8888aa] mt-1">
              {succeeded}/{total_personas} personas completed the task
              {' · '}
              Avg confusion {results.avg_confusion.toFixed(1)}/10
            </p>
          </div>
        </div>
      </div>

      {/* Top friction points */}
      {top_issues.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} className="text-amber-400" />
            <h2 className="text-base font-semibold text-[#e2e2f0]">Top Friction Points</h2>
            <span className="text-xs text-[#555570] ml-auto">Sorted by severity</span>
          </div>
          <div className="space-y-3">
            {top_issues.map((issue, i) => (
              <ConfusionCard key={i} event={issue} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* Per-persona breakdown */}
      <section>
        <h2 className="text-base font-semibold text-[#e2e2f0] mb-4">Persona Reports</h2>
        <div className="space-y-3">
          {personas.map((result) => (
            <PersonaSummary key={result.persona_id} result={result} />
          ))}
        </div>
      </section>
    </div>
  )
}
