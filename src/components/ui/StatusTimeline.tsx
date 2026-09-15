'use client'

import React from 'react'
import { STATUS_CONFIG } from '@/lib/constants'
import { IssueStatus, IssueStatusHistory } from '@/types/database'
import { formatRelativeTime, cn } from '@/lib/utils'

interface StatusTimelineProps {
  history: IssueStatusHistory[]
  currentStatus: IssueStatus
}

export function StatusTimeline({ history, currentStatus }: StatusTimelineProps) {
  // Sort history: latest first
  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="relative space-y-4 before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
      {sortedHistory.map((entry, index) => {
        const isLatest = index === 0
        const config = STATUS_CONFIG[entry.new_status] || { label: entry.new_status, textColor: 'text-slate-500', bgColor: 'bg-slate-100' }
        
        return (
          <div key={entry.id} className="relative flex items-start">
            <div className="flex flex-col items-center mr-4">
              <div 
                className={cn(
                  "flex items-center justify-center rounded-full border-2 border-white ring-1 ring-slate-100 z-10",
                  config.bgColor,
                  isLatest ? 'w-6 h-6' : 'w-4 h-4 mt-1'
                )}
              >
                <div className={cn("rounded-full bg-current opacity-75", config.textColor, isLatest ? 'w-2 h-2' : 'w-1.5 h-1.5')} />
              </div>
            </div>
            <div className="flex-1 pb-4">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-1">
                <span className={cn("text-sm font-semibold", config.textColor)}>
                  {config.label}
                </span>
                <span className="text-xs text-slate-400">
                  {formatRelativeTime(entry.created_at)}
                </span>
              </div>
              {entry.note && (
                <p className="mt-1 text-sm text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  {entry.note}
                </p>
              )}
              {entry.changer && (
                <p className="mt-1 text-xs text-slate-500">
                  By {entry.changer.full_name}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default StatusTimeline
