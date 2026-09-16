'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Issue, IssueStatusHistory, IssueNote } from '@/types/database'
import { STATUS_CONFIG, CATEGORY_CONFIG, PRIORITY_CONFIG } from '@/lib/constants'
import { cn, formatRelativeTime, formatDate } from '@/lib/utils'
import StatusBadge from '@/components/ui/StatusBadge'
import PriorityBadge from '@/components/ui/PriorityBadge'
import { 
  ArrowLeft, 
  Clock, 
  MapPin, 
  Building, 
  Users, 
  AlertCircle, 
  CheckCircle, 
  MessageSquare,
  RefreshCw,
  FileText
} from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

export default function IssueDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = (params?.id as string) || ''
  const { user } = useAuth()
  const supabase = createClient()
  
  const [issue, setIssue] = useState<Issue | null>(null)
  const [history, setHistory] = useState<IssueStatusHistory[]>([])
  const [publicNotes, setPublicNotes] = useState<IssueNote[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [reopenNote, setReopenNote] = useState('')
  const [isVerifying, setIsVerifying] = useState(false)
  const [showReopenInput, setShowReopenInput] = useState(false)

  const fetchIssueData = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setFetchError(null)

    try {
      const { data: issueData, error: issueError } = await supabase
        .from('issues')
        .select('*, location:locations(*), department:departments(*), images:issue_images(*), reporter:profiles!reporter_id(*)')
        .eq('id', id)
        .single()

      if (issueError) {
        console.error('Error fetching issue:', issueError)
        setFetchError('Issue not found or access denied.')
        setLoading(false)
        return
      }

      setIssue(issueData as Issue)

      const { data: historyData, error: historyError } = await supabase
        .from('issue_status_history')
        .select('*, changer:profiles!changed_by(*)')
        .eq('issue_id', id)
        .order('created_at', { ascending: true })

      if (historyError) {
        console.warn('Could not load status history:', historyError)
      } else if (historyData) {
        setHistory(historyData as IssueStatusHistory[])
      }

      const { data: notesData, error: notesError } = await supabase
        .from('issue_notes')
        .select('*, author:profiles!author_id(*)')
        .eq('issue_id', id)
        .eq('visibility', 'public')
        .order('created_at', { ascending: true })

      if (!notesError && notesData) {
        setPublicNotes(notesData as IssueNote[])
      }
    } catch (err: any) {
      console.error('Unexpected error loading issue:', err)
      setFetchError(err?.message || 'Failed to load issue details.')
    } finally {
      setLoading(false)
    }
  }, [id, supabase])

  useEffect(() => {
    fetchIssueData()
    
    if (!id) return

    const issueChannel = supabase.channel(`student-issue-${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues', filter: `id=eq.${id}` }, () => {
        fetchIssueData()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'issue_status_history', filter: `issue_id=eq.${id}` }, () => {
        fetchIssueData()
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'issue_notes', filter: `issue_id=eq.${id}` }, () => {
        fetchIssueData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(issueChannel)
    }
  }, [id, supabase, fetchIssueData])

  const handleVerify = async () => {
    if (!user || !issue) return
    setIsVerifying(true)
    
    try {
      const { error: updateError } = await supabase
        .from('issues')
        .update({ 
          status: 'verified', 
          verified_at: new Date().toISOString() 
        })
        .eq('id', id)

      if (updateError) throw updateError

      const { error: histError } = await supabase
        .from('issue_status_history')
        .insert({
          issue_id: id,
          old_status: issue.status,
          new_status: 'verified',
          changed_by: user.id,
          note: 'Reporter verified the resolution'
        })

      if (histError) console.warn('History insertion warning:', histError)

      toast.success('Issue verified! Thank you for confirming.')
      await fetchIssueData()
    } catch (err: any) {
      console.error('Verify error:', err)
      toast.error(err?.message || 'Could not verify issue resolution.')
    } finally {
      setIsVerifying(false)
    }
  }

  const handleReopen = async () => {
    if (!user || !issue || !reopenNote.trim()) return
    setIsVerifying(true)
    
    try {
      const { error: updateError } = await supabase
        .from('issues')
        .update({ 
          status: 'reopened', 
          is_reopened: true 
        })
        .eq('id', id)

      if (updateError) throw updateError

      const { error: histError } = await supabase
        .from('issue_status_history')
        .insert({
          issue_id: id,
          old_status: issue.status,
          new_status: 'reopened',
          changed_by: user.id,
          note: reopenNote.trim()
        })

      if (histError) console.warn('History insertion warning:', histError)

      toast.success('Issue reopened. Campus maintenance has been notified.')
      setShowReopenInput(false)
      setReopenNote('')
      await fetchIssueData()
    } catch (err: any) {
      console.error('Reopen error:', err)
      toast.error(err?.message || 'Could not reopen issue.')
    } finally {
      setIsVerifying(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="h-8 bg-slate-200 rounded w-1/3 animate-pulse"></div>
        <div className="h-64 bg-slate-200 rounded-2xl animate-pulse"></div>
        <div className="h-32 bg-slate-200 rounded-2xl animate-pulse"></div>
      </div>
    )
  }

  if (fetchError || !issue) {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-white rounded-3xl border border-slate-100 shadow-xl text-center space-y-4">
        <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
          <AlertCircle className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-navy-900 mb-1">We couldn&apos;t load this issue</h2>
          <p className="text-sm text-slate-500">{fetchError || 'This issue may not exist or you might not have permission to view it.'}</p>
        </div>
        <div className="flex justify-center gap-3 pt-2">
          <button
            onClick={() => fetchIssueData()}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-medium transition shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
          <Link
            href="/student/issues"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-medium transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to My Issues
          </Link>
        </div>
      </div>
    )
  }

  const categoryConfig = (issue.category && CATEGORY_CONFIG[issue.category]) || CATEGORY_CONFIG.other || {
    label: issue.category || 'Other',
    icon: 'AlertCircle',
    color: '#64748b',
  }

  const CategoryIcon = (LucideIcons as any)[categoryConfig.icon] || LucideIcons.AlertCircle
  const coverImage = issue.images?.find(img => img.image_type === 'report')?.image_url
  const resolutionImage = issue.images?.find(img => img.image_type === 'resolution')

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 pb-24 space-y-6">
      {/* Top Bar */}
      <div className="flex items-center gap-4">
        <button 
          onClick={() => router.push('/student/issues')} 
          className="p-2 -ml-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors"
          aria-label="Back to issues"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-slate-500 uppercase tracking-wider font-mono">{issue.human_id}</h1>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium">Student Report</span>
        </div>
      </div>

      {/* Cover Image */}
      {coverImage && (
        <div className="relative w-full aspect-video rounded-2xl overflow-hidden border border-slate-200 shadow-sm bg-slate-100">
          <Image src={coverImage} alt={issue.title} fill className="object-cover" unoptimized />
        </div>
      )}

      {/* Show Resolution Proof if available */}
      {resolutionImage && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50/90 border border-emerald-200 p-5 rounded-2xl space-y-3"
        >
          <div className="flex items-center gap-2 text-emerald-900 font-semibold">
            <CheckCircle className="w-5 h-5 text-emerald-600" />
            <span>Resolution Evidence (Photo Proof)</span>
          </div>
          <div className="relative w-full aspect-video rounded-xl overflow-hidden border border-emerald-200 bg-white">
            <Image src={resolutionImage.image_url} alt="Resolution proof" fill className="object-cover" unoptimized />
          </div>
        </motion.div>
      )}

      {/* Main Issue Card */}
      <motion.div 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6"
      >
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={issue.status} />
          <PriorityBadge priority={issue.priority} />
          {issue.is_reopened && (
            <span className="px-2.5 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-700">
              Previously Reopened
            </span>
          )}
        </div>

        <div>
          <h2 className="text-xl md:text-2xl font-bold text-navy-900 mb-2">{issue.title}</h2>
          <p className="text-sm md:text-base text-slate-600 whitespace-pre-wrap leading-relaxed">
            {issue.description}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
              <CategoryIcon className="w-4 h-4" style={{ color: categoryConfig.color }} />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Category</div>
              <div className="font-medium text-navy-900">{categoryConfig.label}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Location</div>
              <div className="font-medium text-navy-900">{issue.location?.name || 'Campus Location'}</div>
            </div>
          </div>

          <div className="flex items-center gap-3 text-sm text-slate-600">
            <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center shrink-0">
              <Building className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Department</div>
              <div className="font-medium text-navy-900">{issue.department?.name || 'General Maintenance'}</div>
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

      {/* Verification Card (Resolved state) */}
      {issue.status === 'resolved' && issue.reporter_id === user?.id && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }} 
          animate={{ opacity: 1, scale: 1 }} 
          className="bg-emerald-50 border border-emerald-200 p-5 rounded-2xl shadow-sm"
        >
          <div className="flex items-start gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div className="w-full">
              <h3 className="font-semibold text-emerald-900 text-lg mb-1">Has this issue been resolved?</h3>
              <p className="text-sm text-emerald-700 mb-4">
                The maintenance team has marked this issue as resolved. Please verify if the problem is fixed to close out the report.
              </p>
              
              {!showReopenInput ? (
                <div className="flex flex-wrap gap-3">
                  <button 
                    onClick={handleVerify} 
                    disabled={isVerifying} 
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm disabled:opacity-50"
                  >
                    {isVerifying ? 'Verifying...' : 'Yes, Verified'}
                  </button>
                  <button 
                    onClick={() => setShowReopenInput(true)} 
                    disabled={isVerifying} 
                    className="px-5 py-2.5 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-xl text-sm font-semibold transition-colors"
                  >
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
                    <button 
                      onClick={handleReopen} 
                      disabled={!reopenNote.trim() || isVerifying} 
                      className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
                    >
                      {isVerifying ? 'Reopening...' : 'Reopen Issue'}
                    </button>
                    <button 
                      onClick={() => setShowReopenInput(false)} 
                      disabled={isVerifying} 
                      className="px-4 py-2 bg-white text-slate-600 border border-slate-200 hover:bg-slate-50 rounded-xl text-sm font-medium transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Public Notes / Staff Updates */}
      {publicNotes.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-navy-900 px-1 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-teal-600" />
            Updates & Staff Notes
          </h3>
          <div className="space-y-2">
            {publicNotes.map(note => (
              <div key={note.id} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm text-sm">
                <div className="flex justify-between items-start mb-1">
                  <span className="font-semibold text-navy-900">{note.author?.full_name || 'Campus Maintenance'}</span>
                  <span className="text-xs text-slate-400">{formatRelativeTime(note.created_at)}</span>
                </div>
                <p className="text-slate-600 whitespace-pre-wrap">{note.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status Timeline */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-navy-900 px-1 flex items-center gap-2">
          <Clock className="w-5 h-5 text-slate-500" />
          Status Timeline
        </h3>
        <div className="bg-white p-5 md:p-6 rounded-2xl border border-slate-100 shadow-sm relative">
          {history.length === 0 ? (
            <div className="text-sm text-slate-500 text-center py-4 flex items-center justify-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <span>Reported {formatRelativeTime(issue.created_at)}</span>
            </div>
          ) : (
            <div className="space-y-6 relative">
              {history.map((entry, index) => {
                const isLast = index === history.length - 1
                const statusConfig = (entry.new_status && STATUS_CONFIG[entry.new_status]) || {
                  label: entry.new_status || 'Reported',
                  color: '#94a3b8',
                  bgColor: 'bg-slate-100',
                  textColor: 'text-slate-600',
                  description: ''
                }
                const changerName = entry.changer?.full_name || (entry.new_status === 'reported' ? 'Alex Rivera' : 'Campus Operations')

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
                      {!isLast && <div className="w-0.5 h-full min-h-[28px] bg-slate-100 mt-1" />}
                    </div>
                    <div className="flex-1 pb-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                        <span className="font-semibold text-navy-900">{statusConfig.label}</span>
                        <span className="text-xs text-slate-400">
                          {formatDate(entry.created_at)} at {new Date(entry.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className="text-xs text-slate-500 mb-1">by {changerName}</div>
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
          )}
        </div>
      </div>
    </div>
  )
}
