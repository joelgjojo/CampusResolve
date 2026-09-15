'use client'

import React from 'react'
import { IssueCategory } from '@/types/database'
import { CATEGORY_CONFIG } from '@/lib/constants'
import { cn } from '@/lib/utils'
import { 
  Zap, 
  Droplets, 
  Trash2, 
  BookOpen, 
  FlaskConical, 
  Wifi, 
  Armchair, 
  ShieldAlert, 
  Accessibility, 
  MoreHorizontal 
} from 'lucide-react'

const iconMap: Record<string, any> = { 
  Zap, 
  Droplets, 
  Trash2, 
  BookOpen, 
  FlaskConical, 
  Wifi, 
  Armchair, 
  ShieldAlert, 
  Accessibility, 
  MoreHorizontal 
}

interface CategoryIconProps {
  category: IssueCategory
  size?: number
  showLabel?: boolean
  className?: string
}

export function CategoryIcon({ category, size = 20, showLabel = false, className }: CategoryIconProps) {
  const config = CATEGORY_CONFIG[category] || { icon: 'MoreHorizontal', color: '#64748b', label: category }
  const IconComponent = iconMap[config.icon] || MoreHorizontal

  return (
    <div className={cn("flex flex-col items-center gap-2", className)}>
      <div 
        className={cn(
          "flex items-center justify-center rounded-xl", 
        )}
        style={{ width: size * 2, height: size * 2, backgroundColor: `${config.color}15`, color: config.color }}
      >
        <IconComponent size={size} />
      </div>
      {showLabel && (
        <span className={cn("text-xs font-medium text-slate-700")}>
          {config.label}
        </span>
      )}
    </div>
  )
}

export default CategoryIcon
