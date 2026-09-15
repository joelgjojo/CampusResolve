'use client'

import React from 'react'
import { STATUS_CONFIG } from '@/lib/constants'
import { IssueStatus } from '@/types/database'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  status: IssueStatus
  size?: 'sm' | 'md'
}

export function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status] || { label: status, bgColor: 'bg-slate-100', textColor: 'text-slate-700' }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs',
        config.bgColor,
        config.textColor
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75" />
      {config.label}
    </span>
  )
}

export default StatusBadge
