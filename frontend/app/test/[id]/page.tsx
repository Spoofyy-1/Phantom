'use client'

import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, Circle,
  AlertTriangle, RefreshCw, ChevronRight
} from 'lucide-react'
import { subscribeToTest, getTestResults, respondToQuestion } from '@/lib/api'
import { ResultsView } from '@/components/ResultsView'
import type { LiveEvent, TestResults, PersonaResult } from '@/types'
import clsx from 'clsx'

// ─── Per-persona live state ───────────────────────────────────────────────────
interface PersonaLive {
  id: string
  name: string
  avatar: string
  color: string
  status: 'waiting' | 'running' | 'done' | 'failed'
  step: number
  thought: string
  action: string
  confusionScore: number
  url: string
  screenshot: string | null
  result?: PersonaResult
  feed: Array<{ step: number; thought: string; action: string; confusion: number }>
}

const COLORS: Record<string, string> = {
  eleanor: '#7c3aed', marcus: '#0ea5e9', alex: '#10b981',
  priya: '#f59e0b', bob: '#ef4444', sarah: '#ec4899',
  derek: '#6366f1', amara: '#14b8a6',
}

function statusDot(status: PersonaLive['status']) {
  if (status === 'running') return <span className="h-2 w-2 rounded-full bg-purple-400 animate-pulse" />
  if (status === 'done')    return <span className="h-2 w-2 rounded-full bg-emerald-400" />
  if (status === 'failed')  return <span className="h-2 w-2 rounded-full bg-red-400" />
  return <span className="h-2 w-2 rounded-full bg-[#2a2a42]" />
}

// ─── Browser chrome wrapper ───────────────────────────────────────────────────
function BrowserFrame({ url, screenshot, loading }: { url: string; screenshot: string | null; loading: boolean }) {
  return (
    <div className="rounded-2xl border border-[#1e1e32] overflow-hidden bg-[#0a0a14] shadow-2xl shadow-black/40">
      {/* Chrome bar */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#111120] border-b border-[#1a1a2e]">
        <div className="flex gap-1.5">
          <span className="h-3 w-3 rounded-full bg-[#2a2a42]" />
          <span className="h-3 w-3 rounded-full bg-[#2a2a42]" />
          <span className="h-3 w-3 rounded-full bg-[#2a2a42]" />
        </div>
        <div className="flex-1 mx-2 bg-[#0d0d18] border border-[#1e1e32] rounded-lg px-3 py-1.5 flex items-center gap-2 min-w-0">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
          <span className="text-xs text-[#666688] truncate font-mono">{url || 'about:blank'}</span>
        </div>
        {loading && <RefreshCw size={13} className="text-[#444460] animate-spin shrink-0" />}
      </div>

      {/* Screenshot or skeleton */}
      <div className="relative w-full" style={{ minHeight: 320 }}>
        {screenshot ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:image/png;base64,${screenshot}`}
            alt="Live browser view"
            className="w-full block"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-80 gap-3">
            {loading ? (
              <>
                <Loader2 size={24} className="text-[#2a2a42] animate-spin" />
                <p className="text-xs text-[#333350]">Waiting for first screenshot…</p>
              </>
            ) : (
              <p className="text-xs text-[#333350]">Waiting to start…</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Thought bubble ───────────────────────────────────────────────────────────
function ThoughtBubble({ persona, thought, action, confusionScore, step }: {
  persona: PersonaLive; thought: string; action: string; confusionScore: number; step: number
}) {
  if (!thought) return null
  const confColor = confusionScore >= 7 ? '#ef4444' : confusionScore >= 4 ? '#f59e0b' : '#10b981'

  return (
    <div className="rounded-xl border border-[#1e1e32] bg-[#0d0d18] p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-base">{persona.avatar}</span>
        <span className="text-xs font-medium text-[#ccccee]">{persona.name} is thinking…</span>
        {step > 0 && <span className="ml-auto text-[11px] text-[#444460]">step {step}</span>}
      </div>
      <p className="text-sm text-[#8888bb] italic leading-relaxed">"{thought}"</p>
      {action && action !== 'done' && action !== 'give_up' && (
        <div className="flex items-center gap-2 pt-1">
          <ChevronRight size={12} className="text-[#444460]" />
          <span className="text-xs text-[#555570]">{action}</span>
          {confusionScore > 0 && (
            <span className="ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ color: confColor, backgroundColor: `${confColor}15` }}>
              confused {confusionScore}/10
            </span>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Event feed ───────────────────────────────────────────────────────────────
function EventFeed({ feed }: { feed: PersonaLive['feed'] }) {
  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth' })
  }, [feed.length])

  if (feed.length === 0) return (
    <div className="rounded-xl border border-[#1e1e32] bg-[#0d0d18] p-4 text-center text-xs text-[#333350]">
      No steps yet
    </div>
  )

  return (
    <div className="rounded-xl border border-[#1e1e32] bg-[#0d0d18] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#1a1a2e]">
        <p className="text-xs font-medium text-[#444460] uppercase tracking-wider">Step history</p>
      </div>
      <div className="max-h-64 overflow-y-auto p-2 space-y-1">
        {feed.map((f, i) => {
          const confColor = f.confusion >= 7 ? '#ef4444' : f.confusion >= 4 ? '#f59e0b' : 'transparent'
          return (
            <div key={i} className="flex items-start gap-2.5 px-2 py-2 rounded-lg hover:bg-[#111120] transition-colors">
              <span className="text-[11px] text-[#333350] tabular-nums mt-0.5 shrink-0 w-6 text-right">{f.step}</span>
              <p className="text-xs text-[#666688] leading-relaxed flex-1 min-w-0 truncate">{f.thought}</p>
              {f.confusion >= 4 && (
                <AlertTriangle size={11} style={{ color: confColor }} className="shrink-0 mt-0.5" />
              )}
            </div>
          )
        })}
        <div ref={bottom} />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function TestPage() {
  const { id: testId } = useParams<{ id: string }>()
  const router = useRouter()

  const [personaMap, setPersonaMap] = useState<Map<string, PersonaLive>>(new Map())
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [status, setStatus] = useState<'connecting' | 'running' | 'complete' | 'error'>('connecting')
  const [results, setResults] = useState<TestResults | null>(null)
  const [testUrl, setTestUrl] = useState('')
  const [task, setTask] = useState('')
  const [streamError, setStreamError] = useState<string | null>(null)
  const [pendingQuestion, setPendingQuestion] = useState<{
    personaId: string;
    personaName: string;
    question: string;
  } | null>(null)
  const [userResponse, setUserResponse] = useState('')

  const handleEvent = (event: LiveEvent) => {
    if (event.type === 'test_start') {
      setTestUrl(event.url)
      setTask(event.task)
      setStatus('running')
    }

    if (event.type === 'persona_start') {
      setPersonaMap((prev) => {
        const next = new Map(prev)
        if (!next.has(event.persona_id)) {
          next.set(event.persona_id, {
            id: event.persona_id,
            name: event.persona_name,
            avatar: '👤',
            color: COLORS[event.persona_id] || '#7c3aed',
            status: 'running',
            step: 0, thought: '', action: '', confusionScore: 0,
            url: '', screenshot: null, feed: [],
          })
        } else {
          next.get(event.persona_id)!.status = 'running'
        }
        return next
      })
      setActiveTab((prev) => prev ?? event.persona_id)
    }

    if (event.type === 'step') {
      setPersonaMap((prev) => {
        const next = new Map(prev)
        const p = next.get(event.persona_id)
        if (p) {
          p.step = event.step
          p.thought = event.thought
          p.action = event.action_type
          p.confusionScore = event.confusion_score
          p.url = event.url
          p.screenshot = event.screenshot
          p.feed = [...p.feed, {
            step: event.step,
            thought: event.thought,
            action: event.action_type,
            confusion: event.confusion_score,
          }].slice(-50) // keep last 50 steps
        }
        return next
      })
    }

    if (event.type === 'ask_user') {
      setPendingQuestion({
        personaId: event.persona_id,
        personaName: event.persona_name,
        question: event.question,
      })
      setActiveTab(event.persona_id)
    }

    if (event.type === 'persona_complete') {
      setPersonaMap((prev) => {
        const next = new Map(prev)
        const p = next.get(event.persona_id)
        if (p) {
          p.status = event.success ? 'done' : 'failed'
          p.result = event.result
          p.avatar = event.result?.persona_avatar || p.avatar
        }
        return next
      })
    }

    if (event.type === 'persona_error') {
      setPersonaMap((prev) => {
        const next = new Map(prev)
        const p = next.get(event.persona_id)
        if (p) p.status = 'failed'
        return next
      })
    }

    if (event.type === 'test_complete') {
      setResults(event.results)
      setStatus('complete')
      setPersonaMap((prev) => {
        const next = new Map(prev)
        for (const r of event.results.personas) {
          const p = next.get(r.persona_id)
          if (p) {
            p.avatar = r.persona_avatar
            p.status = r.success ? 'done' : 'failed'
            p.result = r
          }
        }
        return next
      })
    }

    if (event.type === 'error') {
      setStatus('error')
      setStreamError(event.message)
    }
  }

  const handleRespond = async () => {
    if (!pendingQuestion || !userResponse.trim()) return
    try {
      await respondToQuestion(testId, pendingQuestion.personaId, userResponse)
      setPendingQuestion(null)
      setUserResponse('')
    } catch {
      // silently fail — agent will timeout and continue
    }
  }

  useEffect(() => {
    if (!testId) return
    const unsub = subscribeToTest(testId, handleEvent, (err) => {
      getTestResults(testId)
        .then(({ status: s, results: r }) => {
          if (s === 'complete' && r) { setResults(r); setStatus('complete') }
          else { setStatus('error'); setStreamError(err.message) }
        })
        .catch(() => { setStatus('error'); setStreamError(err.message) })
    })
    return () => unsub()
  }, [testId]) // eslint-disable-line react-hooks/exhaustive-deps

  const personas = Array.from(personaMap.values())
  const active = activeTab ? personaMap.get(activeTab) : null

  return (
    <main className="min-h-screen bg-[#09090f] flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#1a1a2e] bg-[#09090f]/95 backdrop-blur-sm px-5 py-3.5">
        <div className="mx-auto max-w-6xl flex items-center gap-4">
          <button onClick={() => router.push('/')} className="flex items-center gap-1.5 text-sm text-[#444460] hover:text-[#ccccee] transition-colors shrink-0">
            <ArrowLeft size={15} />
            Back
          </button>
          <span className="text-sm font-semibold text-white shrink-0">Phantom</span>
          {testUrl && (
            <span className="text-xs text-[#444460] truncate hidden sm:block font-mono">
              → {testUrl}
            </span>
          )}
          <div className="ml-auto shrink-0">
            {status === 'connecting' && <span className="flex items-center gap-1.5 text-xs text-[#444460]"><Loader2 size={12} className="animate-spin" />Connecting</span>}
            {status === 'running'    && <span className="flex items-center gap-1.5 text-xs text-purple-400 bg-purple-400/10 border border-purple-400/20 rounded-full px-3 py-1"><Circle size={6} className="fill-purple-400" />Running</span>}
            {status === 'complete'   && <span className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded-full px-3 py-1"><CheckCircle2 size={11} />Complete</span>}
            {status === 'error'      && <span className="flex items-center gap-1.5 text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-full px-3 py-1"><XCircle size={11} />Error</span>}
          </div>
        </div>
      </header>

      {/* Task bar */}
      {task && (
        <div className="border-b border-[#1a1a2e] bg-[#0a0a12] px-5 py-2.5">
          <div className="mx-auto max-w-6xl flex items-center gap-3">
            <span className="text-[10px] font-semibold text-[#333350] uppercase tracking-widest shrink-0">Task</span>
            <span className="text-xs text-[#8888bb]">{task}</span>
          </div>
        </div>
      )}

      {/* Persona tabs */}
      {personas.length > 0 && (
        <div className="border-b border-[#1a1a2e] bg-[#09090f] px-5">
          <div className="mx-auto max-w-6xl flex overflow-x-auto gap-1 py-1 scrollbar-hide">
            {personas.map((p) => (
              <button
                key={p.id}
                onClick={() => setActiveTab(p.id)}
                className={clsx(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all shrink-0',
                  activeTab === p.id
                    ? 'bg-[#111120] text-white border border-[#2a2a42]'
                    : 'text-[#555570] hover:text-[#ccccee] hover:bg-[#0d0d18]'
                )}
              >
                <span className="text-base leading-none">{p.avatar}</span>
                <span>{p.name.split(' ')[0]}</span>
                {statusDot(p.status)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 mx-auto w-full max-w-6xl px-5 py-6">

        {/* Connecting state */}
        {status === 'connecting' && (
          <div className="flex flex-col items-center justify-center py-32 gap-4">
            <Loader2 size={28} className="text-purple-400 animate-spin" />
            <p className="text-sm text-[#444460]">Connecting to test session…</p>
          </div>
        )}

        {/* Error */}
        {streamError && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-5 py-4 text-sm text-red-400 mb-6">
            {streamError}
          </div>
        )}

        {/* Live view — active persona */}
        {active && status !== 'complete' && (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-5">
            {/* Left: browser frame */}
            <div className="space-y-4">
              {pendingQuestion && activeTab === pendingQuestion.personaId && (
                <div className="rounded-xl border border-purple-500/30 bg-purple-500/8 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-purple-300">
                      {pendingQuestion.personaName} is asking:
                    </span>
                  </div>
                  <p className="text-sm text-white/80">&quot;{pendingQuestion.question}&quot;</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={userResponse}
                      onChange={(e) => setUserResponse(e.target.value)}
                      placeholder="Type your response..."
                      className="flex-1 rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-white/30 outline-none focus:border-purple-500/50"
                      onKeyDown={(e) => e.key === 'Enter' && handleRespond()}
                      autoFocus
                    />
                    <button
                      onClick={handleRespond}
                      className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-500 transition-colors"
                    >
                      Send
                    </button>
                  </div>
                </div>
              )}
              <BrowserFrame
                url={active.url || testUrl}
                screenshot={active.screenshot}
                loading={active.status === 'running'}
              />
              <ThoughtBubble
                persona={active}
                thought={active.thought}
                action={active.action}
                confusionScore={active.confusionScore}
                step={active.step}
              />
            </div>

            {/* Right: steps + all persona mini-status */}
            <div className="space-y-4">
              <EventFeed feed={active.feed} />

              {/* Other personas summary */}
              {personas.length > 1 && (
                <div className="rounded-xl border border-[#1e1e32] bg-[#0d0d18] overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-[#1a1a2e]">
                    <p className="text-xs font-medium text-[#444460] uppercase tracking-wider">All personas</p>
                  </div>
                  <div className="p-2 space-y-1">
                    {personas.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setActiveTab(p.id)}
                        className={clsx(
                          'w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors text-left',
                          activeTab === p.id ? 'bg-[#111120]' : 'hover:bg-[#111120]'
                        )}
                      >
                        <span className="text-lg leading-none">{p.avatar}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-[#ccccee] truncate">{p.name}</p>
                          {p.step > 0 && <p className="text-[11px] text-[#444460]">step {p.step}</p>}
                        </div>
                        {statusDot(p.status)}
                        {p.status === 'done' && <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />}
                        {p.status === 'failed' && <XCircle size={14} className="text-red-400 shrink-0" />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Completed — show final screenshot + results */}
        {status === 'complete' && results && (
          <div className="space-y-8">
            {/* Final screenshots row */}
            {personas.length > 0 && (
              <div>
                <h2 className="text-xs font-semibold text-[#444460] uppercase tracking-wider mb-4">Final state per persona</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {personas.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setActiveTab(p.id)}
                      className={clsx(
                        'rounded-xl border overflow-hidden text-left transition-all hover:-translate-y-0.5',
                        activeTab === p.id ? 'border-purple-500/50' : 'border-[#1e1e32]'
                      )}
                    >
                      {p.screenshot ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`data:image/png;base64,${p.screenshot}`} alt={p.name} className="w-full aspect-video object-cover object-top" />
                      ) : (
                        <div className="w-full aspect-video bg-[#0d0d18] flex items-center justify-center">
                          <span className="text-2xl">{p.avatar}</span>
                        </div>
                      )}
                      <div className="px-3 py-2 bg-[#0d0d18] flex items-center gap-2">
                        <span className="text-sm">{p.avatar}</span>
                        <span className="text-xs text-[#ccccee] flex-1 truncate">{p.name.split(' ')[0]}</span>
                        {p.status === 'done' ? <CheckCircle2 size={12} className="text-emerald-400" /> : <XCircle size={12} className="text-red-400" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <ResultsView results={results} />
          </div>
        )}
      </div>
    </main>
  )
}
