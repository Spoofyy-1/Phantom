'use client'

import { Check } from 'lucide-react'
import type { Archetype } from '@/types'
import clsx from 'clsx'

interface Props {
  persona: Archetype
  selected: boolean
  onToggle: (id: string) => void
}

export function PersonaCard({ persona, selected, onToggle }: Props) {
  return (
    <button
      onClick={() => onToggle(persona.id)}
      className={clsx(
        'group relative w-full text-left rounded-2xl border p-5 transition-all duration-200 cursor-pointer',
        'hover:border-purple-500/60 hover:-translate-y-0.5',
        selected
          ? 'border-purple-500 bg-purple-600/10 shadow-lg shadow-purple-500/10'
          : 'border-[#1e1e2e] bg-[#111118]'
      )}
      style={selected ? { boxShadow: `0 0 0 1px ${persona.color}40, 0 8px 24px ${persona.color}15` } : {}}
    >
      {/* Selected check */}
      {selected && (
        <span
          className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full"
          style={{ backgroundColor: persona.color }}
        >
          <Check size={11} strokeWidth={3} className="text-white" />
        </span>
      )}

      {/* Avatar + name */}
      <div className="flex items-start gap-3 mb-3">
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{ backgroundColor: `${persona.color}20`, border: `1px solid ${persona.color}30` }}
        >
          {persona.avatar}
        </span>
        <div className="min-w-0">
          <p className="font-semibold text-[#e2e2f0] leading-tight truncate">{persona.name}</p>
          <p className="text-xs text-[#8888aa] mt-0.5">
            {persona.age} · {persona.occupation}
          </p>
        </div>
      </div>

      {/* Short desc */}
      <p className="text-[13px] text-[#8888aa] leading-relaxed mb-3 line-clamp-2">
        {persona.short_desc}
      </p>

      {/* Trait tags */}
      <div className="flex flex-wrap gap-1.5">
        {persona.traits.slice(0, 3).map((trait) => (
          <span
            key={trait}
            className="rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{
              backgroundColor: `${persona.color}15`,
              color: persona.color,
              border: `1px solid ${persona.color}25`,
            }}
          >
            {trait}
          </span>
        ))}
        {persona.traits.length > 3 && (
          <span className="rounded-full px-2 py-0.5 text-[11px] text-[#555570] border border-[#1e1e2e]">
            +{persona.traits.length - 3}
          </span>
        )}
      </div>

      {/* Custom badge */}
      {persona.custom && (
        <span className="absolute bottom-3 right-3 text-[10px] font-medium px-1.5 py-0.5 rounded bg-purple-600/20 text-purple-400 border border-purple-600/30">
          AI BUILT
        </span>
      )}
    </button>
  )
}
