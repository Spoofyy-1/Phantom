'use client'

import { CheckCircle2, XCircle, Loader2, Brain, AlertTriangle } from 'lucide-react'
import type { LiveEvent, PersonaResult } from '@/types'
import clsx from 'clsx'

interface PersonaState {
  id: string
  name: string
  avatar: string
  color: string
  status: 'waiting' | 'running' | 'done' | 'failed'
  currentThought?: string
  currentStep?: number
  confusionScore?: number
  result?: PersonaResult
}

interface Props {
  personas: Array<{ id: string; name: string; avatar: string; color: string }>
  events: LiveEvent[]
}

function buildPersonaStates(
  personas: Props['personas'],
  events: LiveEvent[]
): PersonaState[] {
  const stateMap = new Map<string, PersonaState>()

  for (const p of personas) {
    stateMap.set(p.id, {
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      color: p.color,
      status: 'waiting',
    })
  }

  for (const event of events) {
    if (event.type === 'persona_start') {
      const s = stateMap.get(event.persona_id)
      if (s) s.status = 'running'
    } else if (event.type === 'step') {
      const s = stateMap.get(event.persona_id)
      if (s) {
        s.currentThought = event.thought
        s.currentStep = event.step
        s.confusionScore = event.confusion_score
      }
    } else if (event.type === 'persona_complete') {
      const s = stateMap.get(event.persona_id)
      if (s) {
        s.status = event.success ? 'done' : 'failed'
        s.result = event.result
      }
    } else if (event.type === 'persona_error') {
      const s = stateMap.get(event.persona_id)
      if (s) s.status = 'failed'
    }
  }

  return Array.from(stateMap.values())
}

function ConfusionMeter({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const color = score >= 7 ? '#ef4444' : score >= 4 ? '#f59e0b' : '#10b981'
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 rounded-full bg-[#1e1e2e] overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
      <span className="text-[11px] tabular-nums" style={{ color }}>
        {score}/10
      </span>
    </div>
  )
}

export function TestProgress({ personas, events }: Props) {
  const states = buildPersonaStates(personas, events)

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {states.map((state) => (
        <div
          key={state.id}
          className={clsx(
            'rounded-2xl border p-5 transition-all duration-300',
            state.status === 'running' && 'border-purple-500/40 bg-[#0f0f18]',
            state.status === 'done' && 'border-emerald-500/30 bg-[#0a110e]',
            state.status === 'failed' && 'border-red-500/20 bg-[#110a0a]',
            state.status === 'waiting' && 'border-[#1e1e2e] bg-[#111118] opacity-50'
          )}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-lg"
              style={{ backgroundColor: `${state.color}20` }}
            >
              {state.avatar}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-[#e2e2f0] truncate">{state.name}</p>
              {state.currentStep && (
                <p className="text-xs text-[#8888aa]">Step {state.currentStep}</p>
              )}
            </div>

            {/* Status icon */}
            {state.status === 'waiting' && (
              <span className="h-5 w-5 rounded-full border border-[#2a2a3e]" />
            )}
            {state.status === 'running' && (
              <Loader2 size={18} className="text-purple-400 animate-spin shrink-0" />
            )}
            {state.status === 'done' && (
              <CheckCircle2 size={18} className="text-emerald-400 shrink-0" />
            )}
            {state.status === 'failed' && (
              <XCircle size={18} className="text-red-400 shrink-0" />
            )}
          </div>

          {/* Confusion meter */}
          {state.status === 'running' && state.confusionScore !== undefined && (
            <div className="flex items-center gap-2 mb-2">
              <Brain size={12} className="text-[#555570]" />
              <span className="text-[11px] text-[#555570]">Confusion</span>
              <ConfusionMeter score={state.confusionScore} />
            </div>
          )}

          {/* Live thought */}
          {state.status === 'running' && state.currentThought && (
            <div className="rounded-xl border border-[#1e1e2e] bg-[#0d0d14] px-3 py-2">
              <p className="text-xs text-[#8888aa] italic leading-relaxed line-clamp-3">
                "{state.currentThought}"
              </p>
            </div>
          )}

          {/* Result summary */}
          {state.result && (
            <div className="space-y-2">
              <p className="text-xs text-[#8888aa] leading-relaxed line-clamp-3">
                {state.result.reason}
              </p>
              <div className="flex items-center gap-3 text-[11px] text-[#555570]">
                <span>{state.result.steps_taken} steps</span>
                <span>·</span>
                <span>{state.result.confusion_events.length} confusion events</span>
                <span>·</span>
                <span>{state.result.duration_seconds}s</span>
              </div>
              {state.result.confusion_events.length > 0 && (
                <div className="flex items-center gap-1.5 text-[11px] text-amber-400">
                  <AlertTriangle size={11} />
                  <span>
                    Avg confusion: {state.result.total_confusion_score.toFixed(1)}/10
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
