'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Globe, Loader2, Sparkles, Users } from 'lucide-react'
import { fetchArchetypes, startTest } from '@/lib/api'
import { PersonaCard } from '@/components/PersonaCard'
import { CustomPersonaBuilder } from '@/components/CustomPersonaBuilder'
import type { Archetype, PersonaRef } from '@/types'

const PRESET_TASKS = [
  { label: 'Explore the site',  value: 'Explore this website. Understand what it offers and find the main features.' },
  { label: 'Sign up',           value: 'Try to create a new account or sign up for this service.' },
  { label: 'Find pricing',      value: 'Find out how much this service costs and what plans are available.' },
  { label: 'Contact support',   value: 'Try to contact support or find help documentation.' },
  { label: 'Make a purchase',   value: 'Try to purchase a product or complete a checkout flow.' },
]

const fadeUp = {
  hidden: { opacity: 0, y: 24, filter: 'blur(6px)' },
  show:   { opacity: 1, y: 0,  filter: 'blur(0px)', transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
}

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
}

export default function Home() {
  const router = useRouter()
  const [archetypes, setArchetypes]       = useState<Archetype[]>([])
  const [customPersonas, setCustomPersonas] = useState<Array<Archetype & { system_prompt: string }>>([])
  const [selectedIds, setSelectedIds]     = useState<Set<string>>(new Set())
  const [url, setUrl]                     = useState('')
  const [task, setTask]                   = useState(PRESET_TASKS[0].value)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [archetypesLoading, setArchetypesLoading] = useState(true)

  useEffect(() => {
    fetchArchetypes()
      .then(setArchetypes)
      .catch(() => setError('Backend offline — set NEXT_PUBLIC_API_URL and redeploy.'))
      .finally(() => setArchetypesLoading(false))
  }, [])

  const togglePersona = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 4) next.add(id)
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
    if (!url.trim() || selectedIds.size === 0 || !task.trim()) return
    setLoading(true)
    setError(null)
    try {
      // Auto-prepend https:// if the user omitted the protocol
      let finalUrl = url.trim()
      if (!finalUrl.startsWith('http://') && !finalUrl.startsWith('https://')) {
        finalUrl = 'https://' + finalUrl
        setUrl(finalUrl)
      }
      const allPersonas: PersonaRef[] = Array.from(selectedIds).map((id) => {
        const custom = customPersonas.find((p) => p.id === id)
        return custom ? { id, custom_persona: custom } : { id }
      })
      const testId = await startTest(finalUrl, task, allPersonas)
      router.push(`/test/${testId}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start test')
      setLoading(false)
    }
  }

  const allPersonas = [...archetypes, ...customPersonas]
  const canRun      = url.trim() && selectedIds.size > 0 && task.trim() && !loading

  return (
    <>
      {/* Background layers */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />
      <div className="dot-grid" />
      <div className="grain" />

      <main className="relative z-10 min-h-screen">
        {/* ── Header ─────────────────────────────────────────────────── */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y:  0  }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="border-b border-white/[0.05] px-6 py-4 backdrop-blur-sm sticky top-0 z-50"
          style={{ background: 'rgba(5,5,8,0.8)' }}
        >
          <div className="mx-auto max-w-5xl flex items-center justify-between">
            <span className="text-lg font-bold tracking-tight text-white">Phantom</span>
            <span className="text-xs text-white/20 hidden sm:block font-medium">Synthetic user testing</span>
          </div>
        </motion.header>

        <div className="mx-auto max-w-5xl px-6 space-y-16 py-16">

          {/* ── Hero ──────────────────────────────────────────────────── */}
          <motion.section
            variants={stagger}
            initial="hidden"
            animate="show"
            className="text-center space-y-6"
          >
            <motion.div variants={fadeUp}>
              <span className="inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-xs font-medium"
                style={{ background: 'rgba(124,58,237,0.12)', border: '1px solid rgba(124,58,237,0.25)', color: '#c084fc' }}>
                <span className="h-1.5 w-1.5 rounded-full bg-purple-400 animate-pulse" />
                GPT-4o vision · Real browser automation
              </span>
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-5xl sm:text-6xl font-black tracking-tight leading-[1.1] text-white">
              See your site through<br />
              <span className="gradient-text">different eyes</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-base sm:text-lg max-w-md mx-auto leading-relaxed" style={{ color: 'rgba(255,255,255,0.38)' }}>
              AI agents with real cognitive models browse your site and report exactly where different kinds of users get stuck.
            </motion.p>
          </motion.section>

          {/* ── URL ───────────────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y:  0 }}
            transition={{ duration: 0.55, delay: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-2.5"
          >
            <label className="text-sm font-semibold text-white/60 uppercase tracking-wider">Website URL</label>
            <div className="relative">
              <Globe size={15} className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: 'rgba(255,255,255,0.2)' }} />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-website.com"
                className="input-phantom pl-12 h-14 text-base"
                onKeyDown={(e) => e.key === 'Enter' && canRun && handleRun()}
              />
            </div>
          </motion.section>

          {/* ── Task ──────────────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y:  0 }}
            transition={{ duration: 0.55, delay: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-3"
          >
            <label className="text-sm font-semibold text-white/60 uppercase tracking-wider">What should they try to do?</label>

            {/* Direct text input */}
            <input
              type="text"
              value={task}
              onChange={(e) => setTask(e.target.value)}
              placeholder="e.g. Try to sign up for an account and complete onboarding"
              className="input-phantom h-12"
              onKeyDown={(e) => e.key === 'Enter' && canRun && handleRun()}
            />

            {/* Preset quick-fill chips */}
            <div className="flex flex-wrap gap-2">
              {PRESET_TASKS.map((t) => (
                <motion.button
                  key={t.value}
                  onClick={() => setTask(t.value)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="rounded-full px-3 py-1.5 text-xs font-medium border transition-all duration-200"
                  style={task === t.value ? {
                    background: 'rgba(124,58,237,0.2)',
                    borderColor: 'rgba(124,58,237,0.5)',
                    color: '#c084fc',
                    boxShadow: '0 0 12px rgba(124,58,237,0.15)',
                  } : {
                    background: 'rgba(255,255,255,0.03)',
                    borderColor: 'rgba(255,255,255,0.08)',
                    color: 'rgba(255,255,255,0.35)',
                  }}
                >
                  {t.label}
                </motion.button>
              ))}
            </div>
          </motion.section>

          {/* ── Personas ──────────────────────────────────────────────── */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y:  0 }}
            transition={{ duration: 0.55, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="space-y-5"
          >
            <div className="flex items-end justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Users size={14} style={{ color: 'rgba(255,255,255,0.3)' }} />
                  <label className="text-sm font-semibold text-white/60 uppercase tracking-wider">Choose personas</label>
                </div>
                <p className="text-xs pl-5" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  Select up to 4 · <span style={{ color: selectedIds.size > 0 ? '#c084fc' : undefined }}>{selectedIds.size} selected</span>
                </p>
              </div>
              <AnimatePresence>
                {selectedIds.size > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    onClick={() => setSelectedIds(new Set())}
                    className="text-xs transition-colors"
                    style={{ color: 'rgba(255,255,255,0.25)' }}
                    whileHover={{ color: 'rgba(255,255,255,0.7)' } as never}
                  >
                    Clear all
                  </motion.button>
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-xl px-4 py-3 text-sm text-red-400 overflow-hidden"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading skeleton */}
            {archetypesLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="shimmer rounded-2xl h-40" style={{ animationDelay: `${i * 0.1}s` }} />
                ))}
              </div>
            )}

            {!archetypesLoading && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {allPersonas.map((p, i) => (
                  <PersonaCard
                    key={p.id}
                    persona={p}
                    selected={selectedIds.has(p.id)}
                    onToggle={togglePersona}
                    index={i}
                  />
                ))}
                {selectedIds.size < 4 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.45, delay: allPersonas.length * 0.055, ease: [0.22, 1, 0.36, 1] }}
                  >
                    <CustomPersonaBuilder onPersonaCreated={handleCustomPersona} />
                  </motion.div>
                )}
              </div>
            )}
          </motion.section>

          {/* ── CTA ───────────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y:  0 }}
            transition={{ duration: 0.55, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col items-center gap-4 pb-16"
          >
            <motion.button
              onClick={handleRun}
              disabled={!canRun}
              whileHover={canRun ? { scale: 1.03 } : {}}
              whileTap={canRun ? { scale: 0.97 } : {}}
              className="glow-btn relative flex items-center gap-3 rounded-2xl px-10 py-4 text-[15px] font-bold text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
              style={{ transition: 'box-shadow 0.3s, transform 0.15s' }}
            >
              {loading ? (
                <><Loader2 size={17} className="animate-spin" />Starting test…</>
              ) : (
                <>
                  <Sparkles size={17} />
                  Run Phantom Test
                  <ArrowRight size={17} />
                </>
              )}
            </motion.button>
            <p className="text-xs" style={{ color: 'rgba(255,255,255,0.15)' }}>
              ~3–8 min per persona · GPT-4o · Screenshots at every step
            </p>
          </motion.div>

        </div>
      </main>
    </>
  )
}
