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
          : 'var(--bg-card)',
        border: `1px solid ${selected ? persona.color + '55' : 'var(--border-primary)'}`,
        boxShadow: selected
          ? `0 0 0 1px ${persona.color}30, 0 8px 32px ${persona.color}18, inset 0 1px 0 ${persona.color}20`
          : 'var(--shadow-card)',
      }}
    >
      {/* Hover glow overlay */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
        style={{ background: `radial-gradient(circle at 50% 0%, ${persona.color}10, transparent 70%)` }}
      />

      {/* Shimmer/shine sweep on hover */}
      <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
        <div
          className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out"
          style={{ background: 'linear-gradient(115deg, transparent 30%, rgba(255,255,255,0.04) 50%, transparent 70%)' }}
        />
      </div>

      {/* Selected checkmark */}
      {selected && (
        <motion.span
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 500, damping: 25 }}
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
          <p className="font-semibold text-[15px] leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
            {persona.name}
          </p>
          <p className="text-xs mt-0.5" style={{ color: persona.color + 'cc' }}>
            {persona.age} · {persona.occupation}
          </p>
        </div>
      </div>

      {/* Short desc */}
      <p className="text-[13px] leading-relaxed mb-3.5 line-clamp-2" style={{ color: 'var(--text-secondary)' }}>
        {persona.short_desc}
      </p>

      {/* Traits */}
      <div className="flex flex-wrap gap-1.5">
        {persona.traits.slice(0, 3).map((trait, i) => (
          <motion.span
            key={trait}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: index * 0.055 + i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-wide"
            style={{
              background: `${persona.color}12`,
              color: `${persona.color}cc`,
              border: `1px solid ${persona.color}20`,
            }}
          >
            {trait}
          </motion.span>
        ))}
        {persona.traits.length > 3 && (
          <span className="rounded-full px-2.5 py-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)', border: '1px solid var(--border-secondary)' }}>
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
