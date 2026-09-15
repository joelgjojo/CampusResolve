'use client'

import React from 'react'

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center p-8 rounded-3xl border border-dashed border-slate-200 bg-slate-50/50">
      <div className="text-slate-300 mb-4 [&>svg]:w-12 [&>svg]:h-12">
        {icon}
      </div>
      <h3 className="text-lg font-semibold text-slate-700 mb-1">
        {title}
      </h3>
      <p className="text-sm text-slate-500 mb-6 max-w-sm">
        {description}
      </p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-teal-600 transition-colors shadow-sm"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

export default EmptyState
