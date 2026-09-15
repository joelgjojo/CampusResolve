'use client'

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Issue, Department, IssueNote, IssueImage, IssueStatusHistory } from '@/types/database';
import { STATUS_CONFIG, PRIORITY_CONFIG, CATEGORY_CONFIG, IMPACT_FLAGS } from '@/lib/constants';
import { formatRelativeTime, cn } from '@/lib/utils';
import { ArrowLeft, MapPin, Clock, User, Building, AlertTriangle, MessageSquare, Check, X, ShieldAlert, Upload, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';

const StatusBadge = ({ status }: { status: keyof typeof STATUS_CONFIG }) => {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ${config.bgColor} ${config.textColor}`}>
      {config.label}
    </span>
  );
};

export default function IssueDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const supabase = createClient();

  const [issue, setIssue] = useState<Issue | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [notes, setNotes] = useState<IssueNote[]>([]);
  const [images, setImages] = useState<IssueImage[]>([]);
  const [statusHistory, setStatusHistory] = useState<IssueStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states
  const [newNote, setNewNote] = useState('');
  const [noteVisibility, setNoteVisibility] = useState<'public' | 'internal'>('internal');
  const [selectedDept, setSelectedDept] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionPhoto, setResolutionPhoto] = useState<File | null>(null);

  useEffect(() => {
    if (!id) return;
    
    fetchIssueData();
    fetchDepartments();

    // Subscribe to changes
    const channel = supabase.channel(`issue_${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues', filter: `id=eq.${id}` }, () => {
        fetchIssueData();
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'issue_notes', filter: `issue_id=eq.${id}` }, () => {
        fetchNotes();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id]);

  const fetchIssueData = async () => {
    try {
      const { data, error } = await supabase
        .from('issues')
        .select(`
          *,
          location:locations(*),
          department:departments(*),
          reporter:profiles!reporter_id(*)
        `)
        .eq('id', id)
        .single();
      
      if (error) throw error;
      setIssue(data as any);
      if (data.assigned_department_id) {
        setSelectedDept(data.assigned_department_id);
      }
      fetchNotes();
      fetchImages();
      fetchStatusHistory();
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchImages = async () => {
    const { data } = await supabase
      .from('issue_images')
      .select('*')
      .eq('issue_id', id)
      .order('created_at', { ascending: true });
    if (data) setImages(data as IssueImage[]);
  };

  const fetchStatusHistory = async () => {
    const { data } = await supabase
      .from('issue_status_history')
      .select('*, changer:profiles!changed_by(*)')
      .eq('issue_id', id)
      .order('created_at', { ascending: true });
    if (data) setStatusHistory(data as any);
  };

  const fetchNotes = async () => {
    const { data } = await supabase
      .from('issue_notes')
      .select('*, author:profiles!author_id(*)')
      .eq('issue_id', id)
      .order('created_at', { ascending: true });
    if (data) setNotes(data as any);
  };

  const fetchDepartments = async () => {
    const { data } = await supabase.from('departments').select('*').eq('active', true);
    if (data) setDepartments(data);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setActionLoading(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('issue_notes').insert({
      issue_id: id,
      author_id: user.id,
      note: newNote,
      visibility: noteVisibility
    });

    setNewNote('');
    fetchNotes();
    setActionLoading(false);
  };

  const updateStatus = async (newStatus: string, historyNote?: string) => {
    setActionLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const updateData: any = { status: newStatus };
    if (newStatus === 'resolved') {
      updateData.resolved_at = new Date().toISOString();
    }

    // 1. Update issue
    await supabase.from('issues').update(updateData).eq('id', id);

    // 2. Upload resolution photo if provided
    if (newStatus === 'resolved' && resolutionPhoto) {
      const fileExt = resolutionPhoto.name.split('.').pop();
      const filePath = `${id}/resolution/proof.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('issue-images')
        .upload(filePath, resolutionPhoto, { cacheControl: '3600', upsert: true });
      
      if (!uploadError) {
        const { data: publicUrl } = supabase.storage.from('issue-images').getPublicUrl(filePath);
        await supabase.from('issue_images').insert({
          issue_id: id,
          image_url: publicUrl.publicUrl,
          image_type: 'resolution',
          uploaded_by: user.id,
        });
      }
    }

    // 2. Insert history
    await supabase.from('issue_status_history').insert({
      issue_id: id,
      old_status: issue?.status,
      new_status: newStatus,
      changed_by: user.id,
      note: historyNote || null
    });

    // 3. Notification (mocking insert here for reporter)
    if (issue?.reporter_id) {
      await supabase.from('notifications').insert({
        user_id: issue.reporter_id,
        title: `Issue Status Updated`,
        message: `Your issue ${issue.human_id} is now ${STATUS_CONFIG[newStatus as keyof typeof STATUS_CONFIG].label}`,
        issue_id: id
      });
    }

    fetchIssueData();
    setActionLoading(false);
  };

  const handleAssign = async () => {
    if (!selectedDept) return alert('Please select a department');
    setActionLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    await supabase.from('issues').update({ 
      status: 'assigned', 
      assigned_department_id: selectedDept 
    }).eq('id', id);

    await supabase.from('issue_status_history').insert({
      issue_id: id,
      old_status: issue?.status,
      new_status: 'assigned',
      changed_by: user?.id,
      note: `Assigned to department`
    });

    fetchIssueData();
    setActionLoading(false);
  };

  if (loading) return <div className="p-8 text-center">Loading issue details...</div>;
  if (!issue) return <div className="p-8 text-center text-red-500">Issue not found</div>;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/issues" className="p-2 rounded-full hover:bg-slate-200 transition-colors">
          <ArrowLeft className="h-5 w-5 text-slate-600" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-3">
            {issue.title}
            <span className="text-sm font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
              {issue.human_id}
            </span>
          </h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left/Main Column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Info Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Issue Images */}
            {images.length > 0 && (
              <div className="relative aspect-video bg-slate-100">
                <Image
                  src={images[0].image_url}
                  alt="Issue photo"
                  fill
                  className="object-cover"
                  unoptimized
                />
                {images.length > 1 && (
                  <div className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded-lg">
                    +{images.length - 1} more
                  </div>
                )}
              </div>
            )}
            
            <div className="p-6">
            <p className="text-slate-600 text-lg mb-6 whitespace-pre-wrap">{issue.description}</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="flex items-center gap-3 text-slate-600">
                  <User className="h-5 w-5 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-900">{issue.reporter?.full_name}</p>
                    <p className="text-xs">{issue.reporter?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <MapPin className="h-5 w-5 text-slate-400" />
                  <span className="text-sm">{issue.location?.name}</span>
                </div>
                <div className="flex items-center gap-3 text-slate-600">
                  <Clock className="h-5 w-5 text-slate-400" />
                  <span className="text-sm">Reported {formatRelativeTime(issue.created_at)}</span>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Category</p>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-sm font-medium text-slate-700">
                    {CATEGORY_CONFIG[issue.category]?.label || issue.category}
                  </span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Impact Flags</p>
                  <div className="flex flex-wrap gap-2">
                    {issue.impact_flags.length > 0 ? (
                      issue.impact_flags.map(flagId => {
                        const flag = IMPACT_FLAGS.find(f => f.id === flagId);
                        return flag ? (
                          <span key={flag.id} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                            {flag.label}
                          </span>
                        ) : null;
                      })
                    ) : <span className="text-sm text-slate-400">None</span>}
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>

          {/* Priority Explanation */}
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-navy-900 mb-4 flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-red-500" /> Why {PRIORITY_CONFIG[issue.priority]?.label}?
            </h3>
            <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
              <p className="text-sm text-slate-600 mb-2">
                Priority Score: <span className="font-bold text-slate-900">{issue.priority_score}</span>
              </p>
              <ul className="list-disc pl-5 text-sm text-slate-600 space-y-1">
                {issue.impact_flags.map(flagId => {
                   const flag = IMPACT_FLAGS.find(f => f.id === flagId);
                   return flag ? <li key={flag.id}>{flag.label} (+{flag.score})</li> : null;
                })}
                {issue.confirmation_count > 0 && (
                  <li>Confirmed by {issue.confirmation_count} students (+{issue.confirmation_count * 2} max)</li>
                )}
              </ul>
            </div>
          </div>

          {/* Notes Section */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
            <h3 className="text-lg font-bold text-navy-900 flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-slate-400" /> Notes & Updates
            </h3>
            
            <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
              {notes.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">No notes yet.</p>
              ) : (
                notes.map(note => (
                  <div key={note.id} className={cn("p-4 rounded-xl border text-sm", note.visibility === 'internal' ? 'bg-amber-50 border-amber-100' : 'bg-slate-50 border-slate-100')}>
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-semibold text-slate-900">{note.author?.full_name}</span>
                      <span className="text-xs text-slate-500">{new Date(note.created_at).toLocaleString()}</span>
                    </div>
                    <p className="text-slate-700 whitespace-pre-wrap">{note.note}</p>
                    {note.visibility === 'internal' && (
                      <span className="inline-block mt-2 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">Internal Only</span>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-slate-200 pt-4 space-y-3">
              <textarea
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="Add a note..."
                className="w-full rounded-xl border border-slate-200 p-3 text-sm focus:border-teal-500 focus:ring-1 focus:ring-teal-500 outline-none resize-none h-24 bg-slate-50"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={noteVisibility === 'public'} 
                      onChange={() => setNoteVisibility('public')}
                      className="text-teal-600 focus:ring-teal-500"
                    />
                    Public
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                    <input 
                      type="radio" 
                      checked={noteVisibility === 'internal'} 
                      onChange={() => setNoteVisibility('internal')}
                      className="text-amber-600 focus:ring-amber-500"
                    />
                    Internal Only
                  </label>
                </div>
                <button
                  onClick={handleAddNote}
                  disabled={actionLoading || !newNote.trim()}
                  className="rounded-lg bg-navy-900 px-4 py-2 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50 transition-colors"
                >
                  Post Note
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right/Sidebar Column */}
        <div className="space-y-6">
          {/* Status & Actions Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-6">
            <div className="mb-6 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Current Status</p>
              <StatusBadge status={issue.status} />
              
              {issue.confirmation_count > 0 && (
                <p className="mt-3 text-sm font-medium text-teal-700 bg-teal-50 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Check className="h-4 w-4" /> Confirmed by {issue.confirmation_count} students
                </p>
              )}
            </div>

            <div className="space-y-4">
              <h4 className="font-semibold text-slate-900">Admin Actions</h4>
              
              <AnimatePresence mode="wait">
                {issue.status === 'reported' && (
                  <motion.button
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    onClick={() => updateStatus('acknowledged')}
                    disabled={actionLoading}
                    className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Acknowledge Issue
                  </motion.button>
                )}

                {(issue.status === 'acknowledged' || issue.status === 'reopened') && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200"
                  >
                    <label className="text-sm font-medium text-slate-700">Assign to Department</label>
                    <select
                      value={selectedDept}
                      onChange={(e) => setSelectedDept(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 p-2 text-sm outline-none focus:border-teal-500"
                    >
                      <option value="">Select Department...</option>
                      {departments.map(d => (
                        <option key={d.id} value={d.id}>{d.name}</option>
                      ))}
                    </select>
                    <button
                      onClick={handleAssign}
                      disabled={actionLoading || !selectedDept}
                      className="w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-700 transition-colors disabled:opacity-50"
                    >
                      Assign Issue
                    </button>
                  </motion.div>
                )}

                {issue.status === 'assigned' && (
                  <motion.button
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => updateStatus('in_progress')}
                    disabled={actionLoading}
                    className="w-full rounded-xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    Start Work
                  </motion.button>
                )}

                {issue.status === 'in_progress' && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3 bg-green-50 p-4 rounded-xl border border-green-200"
                  >
                    <label className="text-sm font-bold text-green-900 flex items-center gap-2">
                      <Check className="h-4 w-4" /> Mark as Resolved
                    </label>
                    <textarea
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder="Explain how it was resolved..."
                      className="w-full rounded-lg border border-green-200 p-2 text-sm outline-none focus:border-green-500 h-20"
                    />
                    <label className="flex items-center gap-2 text-sm text-green-800 cursor-pointer">
                      <Upload className="h-4 w-4" />
                      {resolutionPhoto ? resolutionPhoto.name : 'Upload resolution photo (optional)'}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => setResolutionPhoto(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                    </label>
                    <button
                      onClick={() => updateStatus('resolved', resolutionNote)}
                      disabled={actionLoading || !resolutionNote.trim()}
                      className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {actionLoading ? 'Resolving...' : 'Resolve Issue'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {issue.department && (
              <div className="mt-6 pt-6 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Assigned To</p>
                <div className="flex items-center gap-2 text-slate-700">
                  <Building className="h-5 w-5 text-slate-400" />
                  <span className="font-medium">{issue.department.name}</span>
                </div>
              </div>
            )}
          </div>

          {/* Status Timeline */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-sm font-bold text-navy-900 uppercase tracking-wider mb-4">Status Timeline</h3>
            <div className="space-y-0">
              {statusHistory.map((entry, index) => {
                const config = STATUS_CONFIG[entry.new_status] || { label: entry.new_status, color: '#94a3b8' };
                const isLast = index === statusHistory.length - 1;
                return (
                  <div key={entry.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={cn('rounded-full flex-shrink-0', isLast ? 'w-3 h-3' : 'w-2.5 h-2.5')}
                        style={{ backgroundColor: config.color }}
                      />
                      {!isLast && <div className="w-0.5 h-full min-h-[32px] bg-slate-200" />}
                    </div>
                    <div className="pb-4 -mt-0.5">
                      <p className="text-sm font-medium text-navy-900">{config.label}</p>
                      {entry.note && <p className="text-xs text-slate-500 mt-0.5">{entry.note}</p>}
                      <p className="text-xs text-slate-400 mt-0.5">
                        {entry.changer?.full_name} · {formatRelativeTime(entry.created_at)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
