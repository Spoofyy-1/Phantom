'use client'

import { useState } from 'react'
import { Sparkles, Loader2, Plus } from 'lucide-react'
import { expandPersona } from '@/lib/api'
import type { Archetype } from '@/types'

interface Props {
  onPersonaCreated: (persona: Archetype & { system_prompt: string }) => void
}

export function CustomPersonaBuilder({ onPersonaCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const examples = [
    'A visually impaired nurse who uses her phone during 10-minute breaks',
    'A retired veteran, 68, first time using online banking',
    'A Mandarin-speaking student, limited English, trying to sign up',
    'A busy startup founder who speed-reads and hates friction',
  ]

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
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border border-dashed border-[#2a2a3e] bg-[#0d0d14] p-5 text-left transition-all hover:border-purple-500/40 hover:bg-[#111118] group"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#2a2a3e] bg-[#111118] group-hover:border-purple-500/40 transition-colors">
            <Plus size={18} className="text-[#555570] group-hover:text-purple-400 transition-colors" />
          </span>
          <div>
            <p className="text-sm font-medium text-[#8888aa] group-hover:text-[#e2e2f0] transition-colors">
              Build a custom persona
            </p>
            <p className="text-xs text-[#444455] mt-0.5">Describe your user — AI fills in the rest</p>
          </div>
        </div>
      </button>
    )
  }

  return (
    <div className="rounded-2xl border border-purple-500/30 bg-[#111118] p-5 animate-fade-in">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={16} className="text-purple-400" />
        <span className="text-sm font-semibold text-[#e2e2f0]">Custom Persona Builder</span>
      </div>

      <p className="text-xs text-[#8888aa] mb-3">
        Describe your persona briefly — Claude will generate a full cognitive model.
      </p>

      {/* Example chips */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {examples.map((ex) => (
          <button
            key={ex}
            onClick={() => setDescription(ex)}
            className="text-[11px] px-2 py-1 rounded-lg border border-[#1e1e2e] text-[#555570] hover:border-purple-500/30 hover:text-purple-400 transition-colors"
          >
            {ex.slice(0, 40)}…
          </button>
        ))}
      </div>

      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="e.g. A visually impaired nurse who uses her phone on break and relies on VoiceOver"
        rows={3}
        maxLength={500}
        className="w-full resize-none mb-1"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleBuild()
        }}
      />
      <p className="text-[11px] text-[#444455] text-right mb-3">{description.length}/500</p>

      {error && (
        <p className="text-xs text-red-400 bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={handleBuild}
          disabled={!description.trim() || loading}
          className="flex items-center gap-2 rounded-xl bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Building persona…
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Build with AI
            </>
          )}
        </button>
        <button
          onClick={() => { setOpen(false); setDescription(''); setError(null) }}
          className="px-4 py-2 text-sm text-[#555570] hover:text-[#e2e2f0] transition-colors"
        >
          Cancel
        </button>
        <span className="ml-auto text-[11px] text-[#444455]">⌘↵ to build</span>
      </div>
    </div>
  )
}
