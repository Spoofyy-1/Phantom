'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Activity, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { subscribeToTest, getTestResults } from '@/lib/api'
import { TestProgress } from '@/components/TestProgress'
import { ResultsView } from '@/components/ResultsView'
import type { LiveEvent, TestResults, PersonaResult } from '@/types'

interface PersonaMeta {
  id: string
  name: string
  avatar: string
  color: string
}

const AVATAR_COLORS: Record<string, string> = {
  eleanor: '#7c3aed',
  marcus: '#0ea5e9',
  alex: '#10b981',
  priya: '#f59e0b',
  bob: '#ef4444',
  sarah: '#ec4899',
  derek: '#6366f1',
  amara: '#14b8a6',
}

export default function TestPage() {
  const { id: testId } = useParams<{ id: string }>()
  const router = useRouter()

  const [events, setEvents] = useState<LiveEvent[]>([])
  const [personas, setPersonas] = useState<PersonaMeta[]>([])
  const [status, setStatus] = useState<'connecting' | 'running' | 'complete' | 'error'>('connecting')
  const [results, setResults] = useState<TestResults | null>(null)
  const [testUrl, setTestUrl] = useState('')
  const [task, setTask] = useState('')
  const [streamError, setStreamError] = useState<string | null>(null)

  const unsubRef = useRef<(() => void) | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Extract persona meta from events
  const handleEvent = (event: LiveEvent) => {
    setEvents((prev) => [...prev, event])

    if (event.type === 'test_start') {
      setTestUrl(event.url)
      setTask(event.task)
      setStatus('running')
    }

    if (event.type === 'persona_start') {
      setPersonas((prev) => {
        if (prev.find((p) => p.id === event.persona_id)) return prev
        return [
          ...prev,
          {
            id: event.persona_id,
            name: event.persona_name,
            avatar: '👤',
            color: AVATAR_COLORS[event.persona_id] || '#7c3aed',
          },
        ]
      })
    }

    if (event.type === 'persona_complete') {
      // Update avatar from result
      setPersonas((prev) =>
        prev.map((p) =>
          p.id === event.persona_id
            ? { ...p, avatar: event.result?.persona_avatar || p.avatar }
            : p
        )
      )
    }

    if (event.type === 'test_complete') {
      setResults(event.results)
      setStatus('complete')
      // Update personas from results
      const resultPersonas = event.results.personas.map((r: PersonaResult) => ({
        id: r.persona_id,
        name: r.persona_name,
        avatar: r.persona_avatar,
        color: AVATAR_COLORS[r.persona_id] || '#7c3aed',
      }))
      setPersonas(resultPersonas)
    }

    if (event.type === 'error') {
      setStatus('error')
      setStreamError(event.message)
    }
  }

  useEffect(() => {
    if (!testId) return

    // Start SSE subscription
    const unsub = subscribeToTest(
      testId,
      handleEvent,
      (err) => {
        // On stream drop, try to poll for results once
        getTestResults(testId)
          .then(({ status: s, results: r }) => {
            if (s === 'complete' && r) {
              setResults(r)
              setStatus('complete')
            } else {
              setStatus('error')
              setStreamError(err.message)
            }
          })
          .catch(() => {
            setStatus('error')
            setStreamError(err.message)
          })
      }
    )

    unsubRef.current = unsub
    return () => unsub()
  }, [testId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-scroll live feed
  useEffect(() => {
    if (scrollRef.current && status === 'running') {
      scrollRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [events.length, status])

  const stepEvents = events.filter((e) => e.type === 'step')
  const latestSteps = stepEvents.slice(-8)

  return (
    <main className="min-h-screen bg-[#09090f]">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#1e1e2e] bg-[#09090f]/90 backdrop-blur-sm px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="flex items-center gap-1.5 text-sm text-[#555570] hover:text-[#e2e2f0] transition-colors"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="h-6 w-6 rounded bg-purple-600 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">P</span>
            </div>
            <span className="text-sm font-medium text-[#e2e2f0] truncate">
              {testUrl || 'Loading…'}
            </span>
          </div>

          {/* Status pill */}
          <div className="flex items-center gap-1.5 shrink-0">
            {status === 'connecting' && (
              <span className="flex items-center gap-1.5 text-xs text-[#555570]">
                <Loader2 size={12} className="animate-spin" />
                Connecting…
              </span>
            )}
            {status === 'running' && (
              <span className="flex items-center gap-1.5 text-xs text-purple-400 bg-purple-400/10 border border-purple-400/20 rounded-full px-3 py-1">
                <Activity size={11} className="animate-pulse" />
                Running
              </span>
            )}
            {status === 'complete' && (
              <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-3 py-1">
                <CheckCircle2 size={11} />
                Complete
              </span>
            )}
            {status === 'error' && (
              <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-full px-3 py-1">
                <AlertCircle size={11} />
                Error
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-8 space-y-8">
        {/* Task */}
        {task && (
          <div className="rounded-xl border border-[#1e1e2e] bg-[#111118] px-5 py-3 flex items-center gap-3">
            <span className="text-xs font-medium text-[#555570] uppercase tracking-wider">Task</span>
            <span className="text-sm text-[#e2e2f0]">{task}</span>
          </div>
        )}

        {/* Error */}
        {streamError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-5 py-4 text-sm text-red-400">
            {streamError}
          </div>
        )}

        {/* Persona progress cards */}
        {personas.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-[#555570] uppercase tracking-wider mb-4">
              Personas
            </h2>
            <TestProgress personas={personas} events={events} />
          </section>
        )}

        {/* Live thought stream */}
        {status === 'running' && latestSteps.length > 0 && (
          <section>
            <h2 className="text-sm font-medium text-[#555570] uppercase tracking-wider mb-4">
              Live stream
            </h2>
            <div className="space-y-2">
              {latestSteps.map((event, i) => {
                if (event.type !== 'step') return null
                const isLatest = i === latestSteps.length - 1
                return (
                  <div
                    key={`${event.persona_id}-${event.step}`}
                    className={`rounded-xl border border-[#1e1e2e] px-4 py-3 flex items-start gap-3 transition-opacity ${
                      isLatest ? 'opacity-100 bg-[#111118]' : 'opacity-40 bg-transparent'
                    }`}
                  >
                    <span className="text-xs font-mono text-[#555570] shrink-0 mt-0.5">
                      {event.persona_name.split(' ')[0]} {event.step}
                    </span>
                    <p className="text-sm text-[#8888aa] italic leading-relaxed">
                      "{event.thought}"
                    </p>
                    {event.confusion_score >= 4 && (
                      <span className="shrink-0 text-[11px] text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-full px-2 py-0.5">
                        confused
                      </span>
                    )}
                  </div>
                )
              })}
              <div ref={scrollRef} />
            </div>
          </section>
        )}

        {/* Waiting */}
        {status === 'connecting' && (
          <div className="flex flex-col items-center py-24 gap-4">
            <Loader2 size={32} className="text-purple-400 animate-spin" />
            <p className="text-[#555570]">Connecting to test session…</p>
          </div>
        )}

        {/* Results */}
        {status === 'complete' && results && (
          <section>
            <h2 className="text-sm font-medium text-[#555570] uppercase tracking-wider mb-6">
              Results
            </h2>
            <ResultsView results={results} />
          </section>
        )}
      </div>
    </main>
  )
}
