'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Issue } from '@/types/database';
import { STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PlusCircle, AlertTriangle, Clock, CheckCircle2, ArrowRight, ClipboardList } from 'lucide-react';
import { motion } from 'framer-motion';
import StatusBadge from '@/components/ui/StatusBadge';
import PriorityBadge from '@/components/ui/PriorityBadge';

export default function StudentHome() {
  const { profile } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const [stats, setStats] = useState({ open: 0, inProgress: 0, resolved: 0, total: 0 });
  const [recentIssues, setRecentIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      const { data: issues } = await supabase
        .from('issues')
        .select('*, location:locations(*), department:departments(*)')
        .eq('reporter_id', profile?.id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (issues) {
        const typedIssues = issues as unknown as Issue[];
        setRecentIssues(typedIssues);
        setStats({
          open: typedIssues.filter(i => ['reported', 'acknowledged', 'assigned', 'reopened'].includes(i.status)).length,
          inProgress: typedIssues.filter(i => i.status === 'in_progress').length,
          resolved: typedIssues.filter(i => ['resolved', 'verified'].includes(i.status)).length,
          total: typedIssues.length,
        });
      }

      // Also get total counts
      const { count: totalOpen } = await supabase
        .from('issues')
        .select('*', { count: 'exact', head: true })
        .eq('reporter_id', profile?.id)
        .in('status', ['reported', 'acknowledged', 'assigned', 'reopened']);

      const { count: totalInProgress } = await supabase
        .from('issues')
        .select('*', { count: 'exact', head: true })
        .eq('reporter_id', profile?.id)
        .eq('status', 'in_progress');

      const { count: totalResolved } = await supabase
        .from('issues')
        .select('*', { count: 'exact', head: true })
        .eq('reporter_id', profile?.id)
        .in('status', ['resolved', 'verified']);

      setStats({
        open: totalOpen || 0,
        inProgress: totalInProgress || 0,
        resolved: totalResolved || 0,
        total: (totalOpen || 0) + (totalInProgress || 0) + (totalResolved || 0),
      });
    } catch (err) {
      console.error('Error fetching dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const firstName = profile?.full_name?.split(' ')[0] || 'there';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <h1 className="text-2xl font-bold text-navy-900">
          {greeting}, {firstName} 👋
        </h1>
        <p className="text-slate-500 text-sm mt-1">
          Report campus issues and track their resolution.
        </p>
      </motion.div>

      {/* Report Issue CTA */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <Link href="/student/report">
          <div className="relative overflow-hidden bg-gradient-to-br from-navy-900 to-navy-800 rounded-2xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow">
            <div className="relative z-10 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Report an Issue</h2>
                <p className="text-white/70 text-sm mt-1">
                  See something? Report it in 30 seconds.
                </p>
              </div>
              <div className="w-12 h-12 rounded-2xl bg-teal-500 flex items-center justify-center shadow-lg">
                <PlusCircle className="w-6 h-6 text-white" />
              </div>
            </div>
            {/* Decorative circles */}
            <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full bg-teal-500/10" />
            <div className="absolute -right-4 -bottom-12 w-24 h-24 rounded-full bg-white/5" />
          </div>
        </Link>
      </motion.div>

      {/* Status Summary */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="grid grid-cols-3 gap-3"
      >
        <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-amber-50 flex items-center justify-center mx-auto mb-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-navy-900">{stats.open}</p>
          <p className="text-xs text-slate-500 mt-0.5">Open</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold text-navy-900">{stats.inProgress}</p>
          <p className="text-xs text-slate-500 mt-0.5">In Progress</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-100 p-4 text-center shadow-sm">
          <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          </div>
          <p className="text-2xl font-bold text-navy-900">{stats.resolved}</p>
          <p className="text-xs text-slate-500 mt-0.5">Resolved</p>
        </div>
      </motion.div>

      {/* Recent Reports */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-navy-900">Recent Reports</h2>
          <Link href="/student/issues" className="text-sm text-teal-600 font-medium flex items-center gap-1 hover:text-teal-700">
            View all <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-xl bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-slate-100 rounded w-3/4" />
                    <div className="h-3 bg-slate-100 rounded w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : recentIssues.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center">
            <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <h3 className="font-medium text-slate-500">No reports yet</h3>
            <p className="text-sm text-slate-400 mt-1">
              Your campus looks clear here. Report an issue when something needs attention.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {recentIssues.map((issue, index) => (
              <motion.div
                key={issue.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 * index }}
              >
                <Link href={`/student/issues/${issue.id}`}>
                  <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm hover:shadow-md transition-all active:scale-[0.98]">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-mono text-slate-400">{issue.human_id}</span>
                          <PriorityBadge priority={issue.priority} size="sm" />
                        </div>
                        <h3 className="font-medium text-navy-900 text-sm line-clamp-1">{issue.title}</h3>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                          <span>{issue.location?.name}</span>
                          <span>·</span>
                          <span>{formatRelativeTime(issue.created_at)}</span>
                        </p>
                      </div>
                      <StatusBadge status={issue.status} size="sm" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}
      </motion.div>
    </div>
  );
}
