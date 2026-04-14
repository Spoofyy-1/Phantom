'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRight, Loader2, Sparkles, Users, Sun, Moon } from 'lucide-react'
import { fetchArchetypes, startTest } from '@/lib/api'
import { PersonaCard } from '@/components/PersonaCard'
import { CustomPersonaBuilder } from '@/components/CustomPersonaBuilder'
import type { Archetype, PersonaRef } from '@/types'

const PRESET_TASKS = [
  { label: 'Explore',         value: 'You are visiting this website for the first time. Explore it as a curious new visitor: understand what the product or service does, find the main value proposition, discover key features or sections, and identify any calls-to-action. Note anything confusing, unclear, or hard to find.' },
  { label: 'Sign up',         value: 'Try to create a new account or sign up for this service. Go through the full registration flow and note any friction, confusing fields, or unexpected steps.' },
  { label: 'Find pricing',    value: 'Find out how much this service costs and what plans are available. Look for a pricing page, compare tiers if they exist, and note anything that is unclear or hard to find.' },
  { label: 'Contact support', value: 'Try to contact the support team or find help documentation. Look for a contact form, chat widget, help centre, or FAQ. Note how easy or hard it is to get help.' },
  { label: 'Make a purchase', value: 'Try to purchase a product or complete a checkout flow. Add something to your cart, proceed to checkout, and go as far as you can without real payment details. Note any friction points.' },
]

export default function Home() {
  const router = useRouter()
  const testSectionRef = useRef<HTMLDivElement>(null)

  const [archetypes, setArchetypes]         = useState<Archetype[]>([])
  const [customPersonas, setCustomPersonas] = useState<Array<Archetype & { system_prompt: string }>>([])
  const [selectedIds, setSelectedIds]       = useState<Set<string>>(new Set())
  const [url, setUrl]                       = useState('')
  const [task, setTask]                     = useState('')
  const [loading, setLoading]               = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [archetypesLoading, setArchetypesLoading] = useState(true)
  const [theme, setTheme]                   = useState<'light' | 'dark'>('dark')

  useEffect(() => {
    const stored = localStorage.getItem('phantom-theme') as 'light' | 'dark' | null
    if (stored) setTheme(stored)
  }, [])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    localStorage.setItem('phantom-theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

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
      // Validate URL format
      try {
        new URL(finalUrl)
      } catch {
        setError('Please enter a valid URL (e.g. https://example.com)')
        setLoading(false)
        return
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
      {/* ── Section 1: Hero ──────────────────────────────────────────────── */}
      <section className="min-h-screen flex items-center justify-center relative">
        {/* Background layers */}
        <div className="hero-glow" />

        {/* Sticky header */}
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className="fixed top-0 left-0 right-0 px-6 py-4 backdrop-blur-sm z-50"
          style={{ background: 'var(--bg-primary)', opacity: 0.95, borderBottom: '1px solid var(--border-primary)' }}
        >
          <div className="mx-auto max-w-5xl flex items-center justify-between">
            <span className="text-lg font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>Phantom</span>
            <div className="flex items-center gap-4">
              <span className="text-xs hidden sm:block font-medium" style={{ color: 'var(--text-tertiary)' }}>Synthetic UX testing</span>
              <button onClick={toggleTheme} className="theme-toggle" aria-label="Toggle theme">
                {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              </button>
            </div>
          </div>
        </motion.header>

        {/* Hero content */}
        <div className="relative z-10 flex flex-col items-center text-center space-y-8 px-6 max-w-3xl mx-auto">

          {/* Tag chip */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          >
            <span className="tag-chip inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent-light)' }} />
              8 AI personas · Real browser · GPT-4o vision
            </span>
          </motion.div>

          {/* H1 */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className="text-6xl sm:text-7xl font-black leading-[1.05]"
            style={{ color: 'var(--text-primary)' }}
          >
            Your website, seen through{' '}
            <span className="gradient-text">different eyes</span>
          </motion.h1>

          {/* Subtext */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-lg mx-auto text-center text-lg leading-relaxed"
            style={{ color: 'var(--text-secondary)' }}
          >
            AI agents browse your site as real people — a confused grandparent, an impatient teen, a screen-reader user. See exactly where they get stuck.
          </motion.p>

          {/* Step pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="flex gap-3 justify-center flex-wrap"
          >
            {[
              { num: '\u2460', label: 'Drop a URL' },
              { num: '\u2461', label: 'Pick personas' },
              { num: '\u2462', label: 'Get insights' },
            ].map(({ num, label }) => (
              <motion.span
                key={label}
                whileHover={{ y: -2, scale: 1.05 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium cursor-default"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-primary)',
                  color: 'var(--text-secondary)',
                }}
              >
                <span style={{ color: 'var(--accent-light)', fontWeight: 700 }}>{num}</span>
                {label}
              </motion.span>
            ))}
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <button
              onClick={() => testSectionRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="glow-btn rounded-2xl px-10 py-4 text-base font-bold text-white"
            >
              Start testing →
            </button>
          </motion.div>

        </div>
      </section>

      {/* ── Section 2: Test section ───────────────────────────────────────── */}
      <div
        id="test-section"
        ref={testSectionRef}
        className="pt-24 pb-32 max-w-4xl mx-auto px-6 space-y-12 relative z-10"
      >

        {/* URL input block */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-3"
        >
          <label className="section-label block">Website URL</label>
          <div className="relative group">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-website.com"
              className="input-phantom h-14 text-base pl-5 transition-all duration-300"
              onKeyDown={(e) => e.key === 'Enter' && canRun && handleRun()}
            />
          </div>
        </motion.section>

        {/* Task block */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-3"
        >
          <label className="section-label block">What should they do?</label>
          <input
            type="text"
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="e.g. Try to sign up and complete onboarding"
            className="input-phantom h-12"
            onKeyDown={(e) => e.key === 'Enter' && canRun && handleRun()}
          />
          <div className="flex flex-wrap gap-2 pt-1">
            {PRESET_TASKS.map((t) => (
              <motion.button
                key={t.label}
                onClick={() => setTask(t.value)}
                whileHover={{ scale: 1.05, y: -1 }}
                whileTap={{ scale: 0.95 }}
                className="rounded-full text-xs px-3 py-1.5 border transition-all duration-200"
                style={task === t.value ? {
                  background: 'var(--accent-bg)',
                  borderColor: 'var(--accent-border)',
                  color: 'var(--accent-light)',
                  boxShadow: '0 0 12px rgba(124,58,237,0.15)',
                } : {
                  background: 'var(--bg-card)',
                  borderColor: 'var(--border-primary)',
                  color: 'var(--text-tertiary)',
                }}
              >
                {t.label}
              </motion.button>
            ))}
          </div>
        </motion.section>

        {/* Personas block */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="space-y-5"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Users size={14} style={{ color: 'var(--text-tertiary)' }} />
              <span className="section-label">Choose personas</span>
              {selectedIds.size > 0 && (
                <span className="text-xs font-semibold" style={{ color: 'var(--accent-light)' }}>
                  <motion.span
                    key={selectedIds.size}
                    initial={{ scale: 1.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 25 }}
                    className="inline-block"
                  >
                    {selectedIds.size}
                  </motion.span>
                  {' '}selected
                </span>
              )}
            </div>
            <AnimatePresence>
              {selectedIds.size > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs transition-colors hover:opacity-80"
                  style={{ color: 'var(--text-tertiary)' }}
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
                className="rounded-xl px-4 py-3 text-sm text-red-500 overflow-hidden"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <span className="flex items-center gap-2">
                  {error}
                  <button onClick={() => setError(null)} className="ml-auto text-xs underline" style={{ color: 'var(--text-tertiary)' }}>
                    Dismiss
                  </button>
                </span>
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

        {/* Run CTA */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center gap-4"
        >
          <motion.button
            onClick={handleRun}
            disabled={!canRun}
            whileHover={canRun ? { scale: 1.04 } : {}}
            whileTap={canRun ? { scale: 0.96 } : {}}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            className="glow-btn relative flex items-center gap-3 rounded-2xl px-10 py-4 text-[15px] font-bold text-white transition-all disabled:opacity-20 disabled:cursor-not-allowed"
            style={{ transition: 'box-shadow 0.3s' }}
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
          <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>
            All personas browse simultaneously · GPT-4o · ~2 min
          </p>
        </motion.div>

      </div>
    </>
  )
}
