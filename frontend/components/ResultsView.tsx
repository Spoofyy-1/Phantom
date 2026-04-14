'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Image as ImageIcon, Lightbulb, FileText, BarChart3 } from 'lucide-react'
import type { TestResults, PersonaResult, ConfusionEvent, UXDimensions } from '@/types'
import clsx from 'clsx'
import { Heatmap } from './Heatmap'
import { AccessibilityReport } from './AccessibilityReport'
import { FunnelView } from './FunnelView'
import { SentimentTimeline } from './SentimentTimeline'
import { ConflictDetector } from './ConflictDetector'
import { ExportButton } from './ExportButton'

function ScoreRing({ score }: { score: number }) {
  const r = 28
  const circ = 2 * Math.PI * r
  const pct = score / 10
  const dashOffset = circ * (1 - pct)
  const color = score >= 7 ? '#10b981' : score >= 4 ? '#f59e0b' : '#ef4444'

  const [displayScore, setDisplayScore] = useState(0)
  const [animatedOffset, setAnimatedOffset] = useState(circ)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedOffset(dashOffset)
    }, 300)

    const duration = 1000
    const startTime = Date.now() + 300
    let raf: number
    const tick = () => {
      const elapsed = Date.now() - startTime
      if (elapsed < 0) {
        raf = requestAnimationFrame(tick)
        return
      }
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayScore(score * eased)
      if (progress < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)

    return () => {
      clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [score, dashOffset, circ])

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={72} height={72} className="-rotate-90">
        <circle cx={36} cy={36} r={r} fill="none" stroke="var(--border-primary)" strokeWidth={5} />
        <circle
          cx={36}
          cy={36}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeDasharray={circ}
          strokeDashoffset={animatedOffset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.22,1,0.36,1) 0.3s' }}
        />
      </svg>
      <span className="absolute text-xl font-bold" style={{ color }}>
        {displayScore.toFixed(1)}
      </span>
    </div>
  )
}

function ConfusionCard({ event, index }: { event: ConfusionEvent; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const scoreColor = event.confusion_score >= 7 ? '#ef4444' : event.confusion_score >= 4 ? '#f59e0b' : '#10b981'

  return (
    <div className="rounded-xl overflow-hidden"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left transition-colors"
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
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
            <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Step {event.step}</span>
            <span
              className="ml-auto text-[11px] font-semibold px-1.5 py-0.5 rounded"
              style={{ backgroundColor: `${scoreColor}20`, color: scoreColor }}
            >
              {event.confusion_score}/10
            </span>
          </div>
          <p className="text-sm leading-relaxed line-clamp-2" style={{ color: 'var(--text-primary)' }}>
            {event.confusion_note}
          </p>
          <p className="text-xs mt-1 truncate" style={{ color: 'var(--text-tertiary)' }}>{event.url}</p>
        </div>
        {expanded ? (
          <ChevronUp size={16} style={{ color: 'var(--text-tertiary)' }} className="shrink-0 mt-1" />
        ) : (
          <ChevronDown size={16} style={{ color: 'var(--text-tertiary)' }} className="shrink-0 mt-1" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="overflow-hidden"
          >
            <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
              <div className="rounded-lg p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
                <p className="text-xs mb-1" style={{ color: 'var(--text-tertiary)' }}>Internal thought</p>
                <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>&quot;{event.thought}&quot;</p>
              </div>
              {event.screenshot && (
                <div className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
                  <div className="flex items-center gap-2 px-3 py-2" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
                    <ImageIcon size={12} style={{ color: 'var(--text-tertiary)' }} />
                    <span className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Screenshot at confusion point</span>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PersonaSummary({ result }: { result: PersonaResult }) {
  const [open, setOpen] = useState(false)
  const isError = !result.success && result.steps_taken === 0

  return (
    <div className="rounded-2xl overflow-hidden hover:-translate-y-0.5 transition-transform duration-200"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 p-5 text-left transition-colors"
        onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-card-hover)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <span className="text-2xl">{result.persona_avatar}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{result.persona_name}</p>
            {result.success ? (
              <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-2 py-0.5">
                <CheckCircle2 size={10} />
                Completed
              </span>
            ) : isError ? (
              <span className="flex items-center gap-1 text-[11px] text-orange-400 bg-orange-400/10 border border-orange-400/20 rounded-full px-2 py-0.5">
                <AlertTriangle size={10} />
                Error
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[11px] text-red-400 bg-red-400/10 border border-red-400/20 rounded-full px-2 py-0.5">
                <XCircle size={10} />
                Gave up
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--text-secondary)' }}>{result.reason}</p>
        </div>
        <div className="text-right shrink-0 mr-2">
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{result.steps_taken} steps</p>
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{result.confusion_events.length} friction pts</p>
        </div>
        {open ? <ChevronUp size={16} style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-tertiary)' }} />}
      </button>

      {open && (
        <div className="p-5 space-y-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
          {result.confusion_events.length === 0 ? (
            <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)' }}>No confusion events — smooth sailing!</p>
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

const DIMENSION_META: Array<{ key: keyof UXDimensions; label: string; desc: string; color: string }> = [
  { key: 'task_success',          label: 'Task Success',          desc: 'Did personas complete the task?',           color: '#10b981' },
  { key: 'efficiency',            label: 'Efficiency',            desc: 'How many steps did it take?',               color: '#6366f1' },
  { key: 'clarity',               label: 'Clarity',               desc: 'How confused were personas?',               color: '#f59e0b' },
  { key: 'error_recovery',        label: 'Error Recovery',        desc: 'Could confused personas still finish?',     color: '#ec4899' },
  { key: 'friction_distribution', label: 'Friction Spread',       desc: 'Was friction isolated or widespread?',      color: '#14b8a6' },
]

function DimensionBar({ label, desc, score, color, delay }: { label: string; desc: string; score: number; color: string; delay: number }) {
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const t = setTimeout(() => setWidth(score * 10), delay)
    return () => clearTimeout(t)
  }, [score, delay])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{label}</span>
          <span className="text-xs ml-2" style={{ color: 'var(--text-tertiary)' }}>{desc}</span>
        </div>
        <span className="text-sm font-bold tabular-nums" style={{ color }}>{score.toFixed(1)}</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${width}%`,
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            transition: 'width 1s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </div>
    </div>
  )
}

const GRADE_LABEL: Record<string, string> = {
  A: 'Excellent', B: 'Good', C: 'Needs Work', D: 'Poor', F: 'Critical Issues',
}
const GRADE_COLOR: Record<string, string> = {
  A: '#10b981', B: '#6366f1', C: '#f59e0b', D: '#ef4444', F: '#dc2626',
}

export function ResultsView({ results }: { results: TestResults }) {
  const { ux_score, grade, succeeded, total_personas, top_issues, personas, summary, recommendations } = results
  const allErrored = personas.length > 0 && personas.every(p => !p.success && p.steps_taken === 0)
  const gradeColor = GRADE_COLOR[grade] ?? '#6366f1'

  const [activeResultTab, setActiveResultTab] = useState<'overview' | 'analysis' | 'accessibility' | 'reports'>('overview')

  return (
    <div className="space-y-8 animate-slide-up">
      {/* Overall score — always visible */}
      <div className="rounded-2xl p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        {allErrored ? (
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/10 border border-orange-500/20">
              <AlertTriangle size={24} className="text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Test Failed</p>
              <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>All personas encountered errors — check the details below</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-6 flex-wrap">
            <ScoreRing score={ux_score} />
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25, delay: 0.5 }}
              className="flex flex-col items-center justify-center h-16 w-16 rounded-2xl font-black text-2xl border"
              style={{ color: gradeColor, background: `${gradeColor}15`, borderColor: `${gradeColor}30` }}
            >
              {grade}
            </motion.div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>UX Score</p>
                <span className="text-sm font-medium px-2 py-0.5 rounded-full" style={{ color: gradeColor, background: `${gradeColor}15` }}>
                  {GRADE_LABEL[grade] ?? grade}
                </span>
              </div>
              <p className="mt-1" style={{ color: 'var(--text-secondary)' }}>
                {succeeded}/{total_personas} personas completed the task
                {' · '}
                Avg confusion {results.avg_confusion.toFixed(1)}/10
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Tab bar — only shown when not allErrored */}
      {!allErrored && (
        <>
          <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
            {[
              { id: 'overview' as const, label: 'Overview' },
              { id: 'analysis' as const, label: 'Analysis' },
              { id: 'accessibility' as const, label: 'Accessibility' },
              { id: 'reports' as const, label: 'Reports' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveResultTab(tab.id)}
                className="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                style={activeResultTab === tab.id ? {
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  boxShadow: 'var(--shadow-sm)',
                } : {
                  color: 'var(--text-tertiary)',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* === Overview Tab === */}
          {activeResultTab === 'overview' && (
            <div className="space-y-8">
              {/* Dimension breakdown */}
              {results.dimensions && (
                <div className="rounded-2xl p-6 space-y-5" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                  <div className="flex items-center gap-2">
                    <BarChart3 size={15} className="text-purple-400" />
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>UX Dimensions</h2>
                    {results.low_confidence && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-400 border border-amber-400/20 ml-auto">
                        Low confidence — use 3+ personas
                      </span>
                    )}
                  </div>
                  <div className="space-y-4">
                    {DIMENSION_META.map((dim, i) => (
                      <DimensionBar
                        key={dim.key}
                        label={dim.label}
                        desc={dim.desc}
                        score={results.dimensions[dim.key]}
                        color={dim.color}
                        delay={300 + i * 150}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* AI Summary */}
              {summary && (
                <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                  <div className="flex items-center gap-2">
                    <FileText size={15} className="text-purple-400" />
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Assessment</h2>
                  </div>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{summary}</p>
                </div>
              )}

              {/* Recommendations */}
              {recommendations && recommendations.length > 0 && (
                <div className="rounded-2xl p-6 space-y-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                  <div className="flex items-center gap-2">
                    <Lightbulb size={15} className="text-amber-400" />
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Recommendations</h2>
                  </div>
                  <ul className="space-y-2">
                    {recommendations.map((rec, i) => (
                      <li key={i} className={`flex items-start gap-3 animate-fade-in-up delay-${Math.min(i + 1, 5)}`}>
                        <span
                          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-black"
                          style={{ backgroundColor: '#f59e0b' }}
                        >
                          {i + 1}
                        </span>
                        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>{rec}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Export */}
              <ExportButton results={results} />
            </div>
          )}

          {/* === Analysis Tab === */}
          {activeResultTab === 'analysis' && (
            <div className="space-y-8">
              {/* Heatmap */}
              {personas.some(p => (p.click_points ?? []).length > 0) && (
                <Heatmap personas={personas} />
              )}

              {/* Sentiment Timeline */}
              <SentimentTimeline personas={personas} />

              {/* Navigation Funnel */}
              <FunnelView personas={personas} />

              {/* Persona Conflicts */}
              <ConflictDetector personas={personas} />
            </div>
          )}

          {/* === Accessibility Tab === */}
          {activeResultTab === 'accessibility' && (
            <div className="space-y-8">
              <AccessibilityReport personas={personas} />
            </div>
          )}

          {/* === Reports Tab === */}
          {activeResultTab === 'reports' && (
            <div className="space-y-8">
              {/* Top friction points */}
              {top_issues.length > 0 && (
                <section>
                  <div className="flex items-center gap-2 mb-4">
                    <AlertTriangle size={16} className="text-amber-400" />
                    <h2 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>Top Friction Points</h2>
                    <span className="text-xs ml-auto" style={{ color: 'var(--text-tertiary)' }}>Sorted by severity</span>
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
                <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Persona Reports</h2>
                <div className="space-y-3">
                  {personas.map((result) => (
                    <PersonaSummary key={result.persona_id} result={result} />
                  ))}
                </div>
              </section>
            </div>
          )}
        </>
      )}

      {/* If allErrored, show persona reports directly (no tabs) */}
      {allErrored && (
        <section>
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Persona Reports</h2>
          <div className="space-y-3">
            {personas.map((result) => (
              <PersonaSummary key={result.persona_id} result={result} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
