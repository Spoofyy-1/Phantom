'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, Globe, Loader2, ChevronDown } from 'lucide-react'
import { fetchArchetypes, startTest } from '@/lib/api'
import { PersonaCard } from '@/components/PersonaCard'
import { CustomPersonaBuilder } from '@/components/CustomPersonaBuilder'
import type { Archetype, PersonaRef } from '@/types'

const PRESET_TASKS = [
  { label: 'Explore the site', value: 'Explore this website. Understand what it offers and try to find the main features.' },
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
      .catch(() => setError('Failed to load personas — is the backend running?'))
  }, [])

  const togglePersona = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        if (next.size >= 4) return prev // max 4
        next.add(id)
      }
      return next
    })
  }, [])

  const handleCustomPersona = (p: Archetype & { system_prompt: string }) => {
    setCustomPersonas((prev) => [...prev, p])
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.add(p.id)
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
      {/* Header */}
      <header className="border-b border-[#1e1e2e] px-6 py-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-purple-600 flex items-center justify-center">
              <span className="text-white text-sm font-bold">P</span>
            </div>
            <span className="text-lg font-semibold text-[#e2e2f0] tracking-tight">Phantom</span>
          </div>
          <p className="text-xs text-[#555570] hidden sm:block">
            Synthetic user testing with AI personas
          </p>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-12 space-y-12">
        {/* Hero */}
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-1.5 text-xs font-medium text-purple-400">
            <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
            Powered by Claude
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold text-[#e2e2f0] tracking-tight leading-tight">
            See your site through
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              different eyes
            </span>
          </h1>
          <p className="text-[#8888aa] text-lg max-w-xl mx-auto leading-relaxed">
            AI agents with real cognitive models navigate your site and report exactly where
            different kinds of users get stuck.
          </p>
        </div>

        {/* URL Input */}
        <section>
          <label className="block text-sm font-medium text-[#e2e2f0] mb-2">
            Website URL
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[#555570]" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-website.com"
                className="pl-10"
                onKeyDown={(e) => e.key === 'Enter' && canRun && handleRun()}
              />
            </div>
          </div>
        </section>

        {/* Task */}
        <section>
          <label className="block text-sm font-medium text-[#e2e2f0] mb-3">
            What should they try to do?
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {PRESET_TASKS.map((t) => (
              <button
                key={t.value}
                onClick={() => { setTask(t.value); setCustomTaskMode(false) }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-all ${
                  !customTaskMode && task === t.value
                    ? 'border-purple-500 bg-purple-600/20 text-purple-300'
                    : 'border-[#1e1e2e] text-[#8888aa] hover:border-[#2a2a3e] hover:text-[#e2e2f0]'
                }`}
              >
                {t.label}
              </button>
            ))}
            <button
              onClick={() => setCustomTaskMode(true)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium border transition-all ${
                customTaskMode
                  ? 'border-purple-500 bg-purple-600/20 text-purple-300'
                  : 'border-[#1e1e2e] text-[#8888aa] hover:border-[#2a2a3e] hover:text-[#e2e2f0]'
              }`}
            >
              Custom…
            </button>
          </div>
          {customTaskMode && (
            <input
              type="text"
              value={customTask}
              onChange={(e) => setCustomTask(e.target.value)}
              placeholder="Describe what the persona should try to accomplish…"
              className="animate-fade-in"
              autoFocus
            />
          )}
          {!customTaskMode && (
            <p className="text-xs text-[#555570] mt-2 italic">"{task}"</p>
          )}
        </section>

        {/* Persona selection */}
        <section>
          <div className="flex items-baseline justify-between mb-4">
            <div>
              <label className="text-sm font-medium text-[#e2e2f0]">
                Choose personas
              </label>
              <p className="text-xs text-[#555570] mt-0.5">
                Select up to 4 · {selectedIds.size} selected
              </p>
            </div>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="text-xs text-[#555570] hover:text-[#e2e2f0] transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400 mb-4">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {allPersonas.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                selected={selectedIds.has(p.id)}
                onToggle={togglePersona}
              />
            ))}
            {selectedIds.size < 4 && (
              <CustomPersonaBuilder onPersonaCreated={handleCustomPersona} />
            )}
          </div>
        </section>

        {/* CTA */}
        <div className="flex flex-col items-center gap-4 pb-8">
          <button
            onClick={handleRun}
            disabled={!canRun}
            className="flex items-center gap-3 rounded-2xl bg-purple-600 px-8 py-4 text-base font-semibold text-white transition-all hover:bg-purple-500 hover:shadow-xl hover:shadow-purple-500/25 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-purple-600 disabled:hover:shadow-none"
          >
            {loading ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                Starting test…
              </>
            ) : (
              <>
                Run Phantom Test
                <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="text-xs text-[#444455]">
            Each persona runs ~25 steps · Takes 3–8 minutes per persona
          </p>
        </div>
      </div>
    </main>
  )
}
