'use client'

import React from 'react'
import Image from 'next/image'
import { MapPin } from 'lucide-react'
import { Issue } from '@/types/database'
import { formatRelativeTime, cn } from '@/lib/utils'
import { StatusBadge } from './StatusBadge'
import { PriorityBadge } from './PriorityBadge'
import { CategoryIcon } from './CategoryIcon'

interface IssueCardProps {
  issue: Issue
  onClick?: () => void
  className?: string
}

export function IssueCard({ issue, onClick, className }: IssueCardProps) {
  return (
    <div 
      onClick={onClick}
      className={cn(
        "group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md transition-all p-4 cursor-pointer",
        className
      )}
    >
      <div className="flex gap-4">
        {/* Thumbnail */}
        <div className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden bg-slate-50 flex items-center justify-center">
          {issue.images && issue.images.length > 0 ? (
            <Image 
              src={issue.images[0].image_url} 
              alt={issue.title} 
              fill 
              className="object-cover"
              unoptimized
            />
          ) : (
            <CategoryIcon category={issue.category} size={24} />
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 flex flex-col justify-between">
          <div className="flex justify-between items-start gap-2">
            <div>
              <span className="text-[10px] font-mono font-medium text-slate-500 uppercase">
                {issue.human_id}
              </span>
              <h3 className="text-sm font-semibold text-slate-900 line-clamp-2 leading-tight mt-0.5">
                {issue.title}
              </h3>
            </div>
            <div className="text-[10px] text-slate-400 whitespace-nowrap shrink-0">
              {formatRelativeTime(issue.created_at)}
            </div>
          </div>

          <div className="flex items-center text-xs text-slate-500 mt-2">
            <MapPin size={12} className="mr-1 shrink-0" />
            <span className="truncate">{issue.location?.name || 'Unknown location'}</span>
          </div>

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <StatusBadge status={issue.status} size="sm" />
            <PriorityBadge priority={issue.priority} size="sm" />
          </div>
        </div>
      </div>
    </div>
  )
}

export default IssueCard
