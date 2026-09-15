'use client'

import React from 'react'
import { PRIORITY_CONFIG } from '@/lib/constants'
import { IssuePriority } from '@/types/database'
import { cn } from '@/lib/utils'

interface PriorityBadgeProps {
  priority: IssuePriority
  size?: 'sm' | 'md'
}

export function PriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  const config = PRIORITY_CONFIG[priority] || { label: priority, bgColor: 'bg-slate-100', textColor: 'text-slate-700' }
  const isCritical = priority === 'critical'

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
        config.bgColor,
        config.textColor
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {isCritical && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75"></span>
        )}
        <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current opacity-75"></span>
      </span>
      {config.label}
    </span>
  )
}

export default PriorityBadge
