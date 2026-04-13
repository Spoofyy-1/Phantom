'use client'

import { motion } from 'framer-motion'
import { Check } from 'lucide-react'
import type { Archetype } from '@/types'
import clsx from 'clsx'

interface Props {
  persona: Archetype
  selected: boolean
  onToggle: (id: string) => void
  index?: number
}

export function PersonaCard({ persona, selected, onToggle, index = 0 }: Props) {
  return (
    <motion.button
      onClick={() => onToggle(persona.id)}
      initial={{ opacity: 0, y: 20, filter: 'blur(4px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      transition={{ duration: 0.45, delay: index * 0.055, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -3, transition: { duration: 0.2, ease: 'easeOut' } }}
      whileTap={{ scale: 0.97, transition: { duration: 0.1 } }}
      className="group relative w-full text-left rounded-2xl p-5 cursor-pointer transition-colors duration-200"
      style={{
        background: selected
          ? `linear-gradient(135deg, ${persona.color}12, ${persona.color}06)`
          : 'rgba(255,255,255,0.025)',
        border: `1px solid ${selected ? persona.color + '55' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: selected
          ? `0 0 0 1px ${persona.color}30, 0 8px 32px ${persona.color}18, inset 0 1px 0 ${persona.color}20`
          : '0 1px 0 rgba(255,255,255,0.04)',
      }}
    >
      {/* Hover glow overlay */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, ${persona.color}10, transparent 70%)` }}
      />

      {/* Selected checkmark */}
      {selected && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          className="absolute top-3.5 right-3.5 flex h-5 w-5 items-center justify-center rounded-full"
          style={{ background: persona.color }}
        >
          <Check size={10} strokeWidth={3} className="text-white" />
        </motion.span>
      )}

      {/* Avatar + name */}
      <div className="flex items-start gap-3 mb-3.5">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl"
          style={{
            background: `linear-gradient(135deg, ${persona.color}25, ${persona.color}10)`,
            border: `1px solid ${persona.color}30`,
            boxShadow: `inset 0 1px 0 ${persona.color}20`,
          }}
        >
          {persona.avatar}
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="font-semibold text-[#e8e8f0] text-[15px] leading-tight truncate">
            {persona.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: persona.color + 'cc' }}>
            {persona.age} · {persona.occupation}
          </p>
        </div>
      </div>

      {/* Short desc */}
      <p className="text-[13px] text-[#6666a0] leading-relaxed mb-3.5 line-clamp-2">
        {persona.short_desc}
      </p>

      {/* Traits */}
      <div className="flex flex-wrap gap-1.5">
        {persona.traits.slice(0, 3).map((trait) => (
          <span
            key={trait}
            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide"
            style={{
              background: `${persona.color}12`,
              color: `${persona.color}cc`,
              border: `1px solid ${persona.color}20`,
            }}
          >
            {trait}
          </span>
        ))}
        {persona.traits.length > 3 && (
          <span className="rounded-full px-2.5 py-0.5 text-[11px] text-[#3a3a60] border border-white/5">
            +{persona.traits.length - 3}
          </span>
        )}
      </div>

      {/* Custom badge */}
      {persona.custom && (
        <span className="absolute bottom-3.5 right-3.5 text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider"
          style={{ background: `${persona.color}20`, color: persona.color, border: `1px solid ${persona.color}30` }}>
          AI Built
        </span>
      )}
    </motion.button>
  )
}
