'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Issue, IssueStatusHistory } from '@/types/database'
import { STATUS_CONFIG, CATEGORY_CONFIG, PRIORITY_CONFIG } from '@/lib/constants'
import { cn, formatRelativeTime, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import PriorityBadge from '@/components/ui/PriorityBadge'
import { ArrowLeft, Clock, MapPin, Building, Users, AlertCircle, CheckCircle } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'

export default function IssueDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const id = resolvedParams.id
  const { user } = useAuth()
  const supabase = createClient()
  const router = useRouter()
  
  const [issue, setIssue] = useState<Issue | null>(null)
  const [history, setHistory] = useState<IssueStatusHistory[]>([])
  const [loading, setLoading] = useState(true)
  const [reopenNote, setReopenNote] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [showReopenInput, setShowReopenInput] = useState(false)

  const fetchIssueData = async () => {
    const { data: issueData } = await supabase
      .from('issues')
      .select('*, location:locations(*), department:departments(*), images:issue_images(*), reporter:profiles!reporter_id(*)')
      .eq('id', id)
      .single()

    const { data: historyData } = await supabase
      .from('issue_status_history')
      .select('*, changer:profiles!changed_by(*)')
      .eq('issue_id', id)
      .order('created_at', { ascending: true })

    if (issueData) setIssue(issueData as Issue)
    if (historyData) setHistory(historyData as IssueStatusHistory[])
    setLoading(false)
  }

  useEffect(() => {
    fetchIssueData()
    
    const issueSub = supabase.channel(`issue-${id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'issues', filter: `id=eq.${id}` }, () => {
        fetchIssueData()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'issue_status_history', filter: `issue_id=eq.${id}` }, () => {
        fetchIssueData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(issueSub)
    }
  }, [id, supabase])

  const handleVerify = async () => {
    if (!user || !issue) return
    setIsVerifying(true)
    
    await supabase.from('issues').update({ status: 'verified', verified_at: new Date().toISOString() }).eq('id', id)
    await supabase.from('issue_status_history').insert({
      issue_id: id,
      old_status: issue.status,
      new_status: 'verified',
      changed_by: user.id,
      note: 'Reporter verified the resolution'
    })
    
    setIsVerifying(false)
  }

  const handleReopen = async () => {
    if (!user || !issue || !reopenNote.trim()) return
    setIsVerifying(true)
    
    await supabase.from('issues').update({ status: 'reopened', is_reopened: true }).eq('id', id)
    await supabase.from('issue_status_history').insert({
      issue_id: id,
      old_status: issue.status,
      new_status: 'reopened',
      changed_by: user.id,
      note: reopenNote.trim()
    })
    
    setIsVerifying(false)
    setShowReopenInput(false)
    setReopenNote('')
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading issue details...</div>
  }

  if (!issue) {
    return <div className="p-8 text-center text-slate-500">Issue not found</div>
  }

  const CategoryIcon = (LucideIcons as any)[CATEGORY_CONFIG[issue.category].icon] || LucideIcons.AlertCircle
  const coverImage = issue.images?.find(img => img.image_type === 'report')?.image_url
  const resolutionImage = issue.images?.find(img => img.image_type === 'resolution')

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-lg font-bold text-slate-500 uppercase tracking-wider">{issue.human_id}</h1>
      </div>

      {coverImage && (
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200">
          <Image src={coverImage} alt="Issue cover" fill className="object-cover" unoptimized />
        </div>
      )}

      {/* Show Resolution Proof if resolved or verified */}
      {resolutionImage && (
        <div className="bg-emerald-50/80 border border-emerald-200 p-5 rounded-2xl space-y-3">
          <div className="flex items-center gap-2 text-emerald-900 font-semibold">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>Resolution Evidence (Photo Proof)</span>
          </div>
          <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-emerald-200">
            <Image src={resolutionImage.image_url} alt="Resolution proof" fill className="object-cover" unoptimized />
          </div>
        </div>
      )}

      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
        </div>

        <div>
          <h2 className="text-xl md:text-2xl font-bold text-navy-900 mb-2">{issue.title}</h2>
          <p className="text-sm md:text-base text-slate-600 whitespace-pre-wrap leading-relaxed">{issue.description}</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
              <CategoryIcon className="w-4 h-4" style={{ color: CATEGORY_CONFIG[issue.category].color }} />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Category</div>
              <div className="font-medium text-navy-900">{CATEGORY_CONFIG[issue.category].label}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Location</div>
              <div className="font-medium text-navy-900">{issue.location?.name || 'Unknown'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
              <Building className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Department</div>
              <div className="font-medium text-navy-900">{issue.department?.name || 'Unassigned'}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Reported</div>
              <div className="font-medium text-navy-900">{formatRelativeTime(issue.created_at)}</div>
            </div>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
              <Users className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Confirmations</div>
              <div className="font-medium text-navy-900">{issue.confirmation_count} students</div>
            </div>
          </div>
        </div>
      </motion.div>

      {issue.status === 'resolved' && issue.reporter_id === user?.id && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="w-full">
              <h3 className="font-semibold text-emerald-900 text-lg mb-1">Has this issue been resolved?</h3>
              <p className="text-sm text-emerald-700 mb-4">The maintenance team has marked this issue as resolved. Please verify if the problem is fixed.</p>
              
              {!showReopenInput ? (
                <div className="flex flex-wrap gap-3">
                  <button onClick={handleVerify} disabled={isVerifying} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-medium transition-colors shadow-sm disabled:opacity-50">
                    Yes, Verified
                  </button>
                  <button onClick={() => setShowReopenInput(true)} disabled={isVerifying} className="px-5 py-2.5 bg-white border border-emerald-200 text-emerald-700 hover:bg-emerald-100 rounded-xl text-sm font-medium transition-colors">
                    Still a Problem
                  </button>
                </div>
              ) : (
                <div className="space-y-3 mt-2">
                  <textarea
                    placeholder="Please explain what is still wrong..."
                    value={reopenNote}
                    onChange={(e) => setReopenNote(e.target.value)}
                    className="w-full p-3 rounded-xl border border-emerald-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                    rows={3}
                  />
                  <div className="flex gap-2">
                    <button onClick={handleReopen} disabled={!reopenNote.trim() || isVerifying} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50">
                      Reopen Issue
                    </button>
                    <button onClick={() => setShowReopenInput(false)} disabled={isVerifying} className="px-4 py-2 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      <div className="space-y-4">
        <h3 className="text-lg font-bold text-navy-900 px-1">Status Timeline</h3>
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm relative">
          <div className="absolute left-8 top-8 bottom-8 w-px bg-slate-100"></div>
          <div className="space-y-8 relative">
            {history.map((entry, index) => {
              const isLast = index === history.length - 1
              const statusConfig = STATUS_CONFIG[entry.new_status]
              return (
                <div key={entry.id} className="flex gap-4 group">
                  <div className="relative flex flex-col items-center">
                    <div 
                      className={cn(
                        "w-4 h-4 rounded-full border-2 border-white shadow-sm shrink-0 z-10 transition-transform group-hover:scale-110",
                        isLast ? "w-5 h-5 ring-4 ring-white" : ""
                      )}
                      style={{ backgroundColor: statusConfig.color }}
                    />
                  </div>
                  <div className="flex-1 pb-1">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                      <span className="font-semibold text-navy-900">{statusConfig.label}</span>
                      <span className="text-xs text-slate-400">{formatDate(entry.created_at)} at {new Date(entry.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                    </div>
                    {entry.changer && (
                      <div className="text-xs text-slate-500 mb-1">by {entry.changer.full_name}</div>
                    )}
                    {entry.note && (
                      <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-xl mt-2 border border-slate-100">
                        {entry.note}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
