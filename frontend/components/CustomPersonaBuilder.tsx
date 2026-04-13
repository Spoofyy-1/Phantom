'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, Loader2, Plus, X } from 'lucide-react'
import { expandPersona } from '@/lib/api'
import type { Archetype } from '@/types'

interface Props {
  onPersonaCreated: (persona: Archetype & { system_prompt: string }) => void
}

const EXAMPLES = [
  'A visually impaired nurse using her phone on break',
  'Retired veteran, 68, first time using online banking',
  'Mandarin-speaking student, limited English',
  'Busy startup founder who speed-reads everything',
]

export function CustomPersonaBuilder({ onPersonaCreated }: Props) {
  const [open, setOpen]           = useState(false)
  const [description, setDescription] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)

  const handleBuild = async () => {
    if (!description.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const persona = await expandPersona(description)
      onPersonaCreated(persona)
      setDescription('')
      setOpen(false)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <motion.button
        onClick={() => setOpen(true)}
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        className="group w-full rounded-2xl p-5 text-left h-full min-h-[160px] flex items-center transition-colors duration-200"
        style={{
          background: 'rgba(255,255,255,0.015)',
          border: '1px dashed rgba(255,255,255,0.1)',
        }}
      >
        <div className="flex items-center gap-3 w-full">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors duration-200"
            style={{ background: 'rgba(124,58,237,0.1)', border: '1px solid rgba(124,58,237,0.2)' }}>
            <Plus size={18} style={{ color: 'rgba(192,132,252,0.6)' }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.5)' }}>
              Build a custom persona
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.2)' }}>
              Describe your user — AI fills in the rest
            </p>
          </div>
        </div>
      </motion.button>
    )
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 8 }}
        transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        className="rounded-2xl p-5 space-y-4"
        style={{
          background: 'rgba(124,58,237,0.06)',
          border: '1px solid rgba(124,58,237,0.25)',
          boxShadow: '0 0 32px rgba(124,58,237,0.08)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={14} style={{ color: '#c084fc' }} />
            <span className="text-sm font-semibold text-white">Custom Persona</span>
          </div>
          <button onClick={() => { setOpen(false); setDescription(''); setError(null) }}
            className="rounded-lg p-1 transition-colors"
            style={{ color: 'rgba(255,255,255,0.3)' }}>
            <X size={14} />
          </button>
        </div>

        {/* Example chips */}
        <div className="flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              onClick={() => setDescription(ex)}
              className="text-[11px] px-2.5 py-1 rounded-full transition-all duration-150"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.35)' }}
            >
              {ex.slice(0, 36)}…
            </button>
          ))}
        </div>

        {/* Input */}
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. A visually impaired nurse who uses VoiceOver on break"
          rows={3}
          maxLength={500}
          className="input-phantom resize-none text-sm"
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleBuild() }}
          style={{ borderRadius: '12px' }}
        />
        <div className="flex justify-between items-center">
          <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.2)' }}>{description.length}/500 · ⌘↵ to build</span>
        </div>

        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="text-xs text-red-400 rounded-lg px-3 py-2 overflow-hidden"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        <motion.button
          onClick={handleBuild}
          disabled={!description.trim() || loading}
          whileHover={!loading ? { scale: 1.02 } : {}}
          whileTap={!loading ? { scale: 0.97 } : {}}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          style={{ background: loading ? 'rgba(124,58,237,0.4)' : 'rgba(124,58,237,0.8)' }}
        >
          {loading ? (
            <><Loader2 size={14} className="animate-spin" />Building persona…</>
          ) : (
            <><Sparkles size={14} />Build with AI</>
          )}
        </motion.button>
      </motion.div>
    </AnimatePresence>
  )
}
