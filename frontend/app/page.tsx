'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Globe, Loader2, Zap } from 'lucide-react'
import { fetchArchetypes, startTest } from '@/lib/api'
import { PersonaCard } from '@/components/PersonaCard'
import { CustomPersonaBuilder } from '@/components/CustomPersonaBuilder'
import type { Archetype, PersonaRef } from '@/types'

const PRESET_TASKS = [
  { label: 'Explore the site', value: 'Explore this website. Understand what it offers and find the main features.' },
  { label: 'Sign up', value: 'Try to create a new account or sign up for this service.' },
  { label: 'Find pricing', value: 'Find out how much this service costs and what plans are available.' },
  { label: 'Contact support', value: 'Try to contact support or find help documentation.' },
  { label: 'Make a purchase', value: 'Try to purchase a product or complete a checkout flow.' },
]

export default function Home() {
  const router = useRouter()
  const [archetypes, setArchetypes] = useState<Archetype[]>([])
  const [customPersonas, setCustomPersonas] = useState<Array<Archetype & { system_prompt: string }>>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [url, setUrl] = useState('')
  const [task, setTask] = useState(PRESET_TASKS[0].value)
  const [customTaskMode, setCustomTaskMode] = useState(false)
  const [customTask, setCustomTask] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchArchetypes()
      .then(setArchetypes)
      .catch(() => setError('Backend offline — set NEXT_PUBLIC_API_URL and redeploy.'))
  }, [])

  const togglePersona = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) }
      else if (next.size < 4) { next.add(id) }
      return next
    })
  }, [])

  const handleCustomPersona = (p: Archetype & { system_prompt: string }) => {
    setCustomPersonas((prev) => [...prev, p])
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.size < 4) next.add(p.id)
      return next
    })
  }

  const handleRun = async () => {
    const finalTask = customTaskMode ? customTask : task
    if (!url.trim() || selectedIds.size === 0 || !finalTask.trim()) return
    setLoading(true)
    setError(null)
    try {
      const allPersonas: PersonaRef[] = Array.from(selectedIds).map((id) => {
        const custom = customPersonas.find((p) => p.id === id)
        return custom ? { id, custom_persona: custom } : { id }
      })
      const testId = await startTest(url, finalTask, allPersonas)
      router.push(`/test/${testId}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start test')
      setLoading(false)
    }
  }

  const allPersonas = [...archetypes, ...customPersonas]
  const finalTask = customTaskMode ? customTask : task
  const canRun = url.trim() && selectedIds.size > 0 && finalTask.trim() && !loading

  return (
    <main className="min-h-screen bg-[#09090f]">
      {/* Header — no logo, just wordmark */}
      <header className="border-b border-[#1a1a2e] px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <span className="text-lg font-semibold tracking-tight text-white">Phantom</span>
          <span className="text-xs text-[#444460] hidden sm:block">Synthetic user testing</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-14 space-y-14">

        {/* Hero */}
        <div className="text-center space-y-5">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#2a2a42] bg-[#111120] px-4 py-1.5 text-xs font-medium text-[#8888bb]">
            <Zap size={11} className="text-purple-400" />
            GPT-4o vision · Real browser automation
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-white tracking-tight leading-[1.15]">
            See your site through<br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 via-purple-400 to-pink-400">
              different eyes
            </span>
          </h1>
          <p className="text-[#6666aa] text-base max-w-lg mx-auto leading-relaxed">
            AI agents with detailed cognitive models browse your site and report where real users get stuck.
          </p>
        </div>

        {/* URL */}
        <section className="space-y-2">
          <label className="text-sm font-medium text-[#ccccee]">Website URL</label>
          <div className="relative">
            <Globe size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#444460]" />
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-website.com"
              className="pl-10 h-12 rounded-xl border border-[#1e1e32] bg-[#0d0d18] text-white placeholder:text-[#444460] focus:border-purple-500 focus:outline-none w-full text-sm transition-colors"
              onKeyDown={(e) => e.key === 'Enter' && canRun && handleRun()}
            />
          </div>
        </section>

        {/* Task */}
        <section className="space-y-3">
          <label className="text-sm font-medium text-[#ccccee]">What should they try to do?</label>
          <div className="flex flex-wrap gap-2">
            {PRESET_TASKS.map((t) => (
              <button
                key={t.value}
                onClick={() => { setTask(t.value); setCustomTaskMode(false) }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-all ${
                  !customTaskMode && task === t.value
                    ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                    : 'border-[#1e1e32] text-[#666688] hover:border-[#2e2e4a] hover:text-[#ccccee]'
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => setCustomTaskMode(true)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-all ${
                customTaskMode
                  ? 'border-purple-500 bg-purple-500/15 text-purple-300'
                  : 'border-[#1e1e32] text-[#666688] hover:border-[#2e2e4a] hover:text-[#ccccee]'
              }`}
            >
              Custom…
            </button>
          </div>
          {customTaskMode ? (
            <input
              type="text"
              value={customTask}
              onChange={(e) => setCustomTask(e.target.value)}
              placeholder="Describe what the persona should try to accomplish…"
              className="h-11 rounded-xl border border-[#1e1e32] bg-[#0d0d18] text-white placeholder:text-[#444460] focus:border-purple-500 focus:outline-none w-full px-4 text-sm transition-colors"
              autoFocus
            />
          ) : (
            <p className="text-xs text-[#444460] italic">"{task}"</p>
          )}
        </section>

        {/* Persona grid */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <label className="text-sm font-medium text-[#ccccee]">Choose personas</label>
              <p className="text-xs text-[#444460] mt-0.5">Select up to 4 · {selectedIds.size} selected</p>
            </div>
            {selectedIds.size > 0 && (
              <button onClick={() => setSelectedIds(new Set())} className="text-xs text-[#444460] hover:text-[#ccccee] transition-colors">
                Clear all
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/8 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allPersonas.map((p) => (
              <PersonaCard key={p.id} persona={p} selected={selectedIds.has(p.id)} onToggle={togglePersona} />
            ))}
            {selectedIds.size < 4 && (
              <CustomPersonaBuilder onPersonaCreated={handleCustomPersona} />
            )}
          </div>
        </section>

        {/* CTA */}
        <div className="flex flex-col items-center gap-3 pb-10">
          <button
            onClick={handleRun}
            disabled={!canRun}
            className="group flex items-center gap-3 rounded-2xl bg-purple-600 px-8 py-4 text-sm font-semibold text-white transition-all hover:bg-purple-500 hover:shadow-2xl hover:shadow-purple-500/20 disabled:opacity-25 disabled:cursor-not-allowed"
          >
            {loading ? (
              <><Loader2 size={16} className="animate-spin" />Starting…</>
            ) : (
              <><span>Run Phantom Test</span><ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" /></>
            )}
          </button>
          <p className="text-xs text-[#333350]">~3–8 min per persona · Screenshots at every step</p>
        </div>

      </div>
    </main>
  )
}
