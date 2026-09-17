'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Issue } from '@/types/database'
import { formatRelativeTime } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import PriorityBadge from '@/components/ui/PriorityBadge'
import { ClipboardList, Search, MapPin } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function StudentIssuesPage() {
  const { user } = useAuth()
  const supabase = createClient()
  
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'All' | 'Open' | 'In Progress' | 'Resolved'>('All')
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    if (!user) return

    const fetchIssues = async () => {
      setLoading(true)
      let query = supabase
        .from('issues')
        .select('*, location:locations(*), department:departments(*)')
        .eq('reporter_id', user.id)
        .order('created_at', { ascending: false })

      if (activeTab === 'Open') {
        query = query.in('status', ['reported', 'acknowledged', 'assigned', 'reopened'])
      } else if (activeTab === 'In Progress') {
        query = query.eq('status', 'in_progress')
      } else if (activeTab === 'Resolved') {
        query = query.in('status', ['resolved', 'verified'])
      }

      const { data, error } = await query
      if (!error && data) {
        setIssues(data as Issue[])
      }
      setLoading(false)
    }

    fetchIssues()
  }, [user, activeTab, supabase])

  const filteredIssues = issues.filter(issue => 
    issue.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
    issue.human_id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-navy-900">My Issues</h1>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex w-full md:w-auto overflow-x-auto hide-scrollbar space-x-2 pb-1">
          {['All', 'Open', 'In Progress', 'Resolved'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`whitespace-nowrap px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'bg-teal-500 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div className="relative w-full md:w-64 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search by ID or title..."
            aria-label="Search my issues by ID or title"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded w-1/4 mb-3"></div>
              <div className="h-5 bg-slate-200 rounded w-3/4 mb-4"></div>
              <div className="flex gap-2">
                <div className="h-6 bg-slate-200 rounded w-20"></div>
                <div className="h-6 bg-slate-200 rounded w-20"></div>
              </div>
            </div>
          ))}
        </div>
      ) : filteredIssues.length > 0 ? (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-4"
        >
          {filteredIssues.map((issue) => (
            <Link key={issue.id} href={`/student/issues/${issue.id}`} className="block group">
              <motion.div
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 transition-all hover:shadow-md hover:border-teal-100"
              >
                <div className="flex justify-between items-start mb-2">
                  <span className="text-xs font-semibold text-slate-500">{issue.human_id}</span>
                  <span className="text-xs text-slate-400">{formatRelativeTime(issue.created_at)}</span>
                </div>
                <h3 className="font-semibold text-navy-900 text-lg mb-2 line-clamp-1 group-hover:text-teal-600 transition-colors">
                  {issue.title}
                </h3>
                <div className="flex items-center text-sm text-slate-500 mb-4">
                  <MapPin className="w-4 h-4 mr-1 shrink-0" />
                  <span className="truncate">{issue.location?.name || 'Unknown Location'}</span>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  <StatusBadge status={issue.status} />
                  <PriorityBadge priority={issue.priority} />
                </div>
              </motion.div>
            </Link>
          ))}
        </motion.div>
      ) : (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-100 border-dashed">
          <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <ClipboardList className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-navy-900 mb-1">No issues found</h3>
          <p className="text-slate-500">
            {searchQuery || activeTab !== 'All' 
              ? 'Try adjusting your filters or search query.' 
              : "You haven't reported any issues yet."}
          </p>
        </div>
      )}
    </div>
  )
}
