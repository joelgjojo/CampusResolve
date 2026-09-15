'use client'

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Issue, Profile, Location, Department } from '@/types/database';
import { AlertTriangle, ShieldAlert, Clock, CheckCircle2, ChevronRight, MapPin } from 'lucide-react';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { STATUS_CONFIG, PRIORITY_CONFIG, CATEGORY_CONFIG } from '@/lib/constants';
import Link from 'next/link';
import { motion } from 'framer-motion';

// Mock components to fulfill requirement if they don't exist
const MetricCard = ({ title, value, icon: Icon, color, iconBg }: any) => (
  <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 backdrop-blur-xl shadow-sm">
    <div className="flex items-center gap-4">
      <div className={`rounded-xl p-3 ${iconBg}`}>
        <Icon className={`h-6 w-6 ${color}`} />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-500">{title}</p>
        <p className="text-2xl font-bold text-slate-900">{value}</p>
      </div>
    </div>
  </div>
);

const StatusBadge = ({ status }: { status: keyof typeof STATUS_CONFIG }) => {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgColor} ${config.textColor}`}>
      {config.label}
    </span>
  );
};

const PriorityBadge = ({ priority }: { priority: keyof typeof PRIORITY_CONFIG }) => {
  const config = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${config.bgColor} ${config.textColor}`}>
      {config.label}
    </span>
  );
};

export default function AdminDashboard() {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    open: 0,
    highPriority: 0,
    inProgress: 0,
    resolvedWeek: 0,
  });
  const [urgentIssues, setUrgentIssues] = useState<Issue[]>([]);
  const [recentIssues, setRecentIssues] = useState<Issue[]>([]);
  
  const supabase = createClient();

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // 1. Metrics - Open Issues
        const { count: openCount } = await supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .in('status', ['reported', 'acknowledged', 'assigned', 'reopened']);

        // 2. Metrics - High Priority
        const { count: highPriorityCount } = await supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .in('priority', ['high', 'critical'])
          .not('status', 'in', '("resolved","verified")');

        // 3. Metrics - In Progress
        const { count: inProgressCount } = await supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'in_progress');

        // 4. Metrics - Resolved This Week
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const { count: resolvedCount } = await supabase
          .from('issues')
          .select('*', { count: 'exact', head: true })
          .in('status', ['resolved', 'verified'])
          .gte('resolved_at', sevenDaysAgo.toISOString());

        setMetrics({
          open: openCount || 0,
          highPriority: highPriorityCount || 0,
          inProgress: inProgressCount || 0,
          resolvedWeek: resolvedCount || 0,
        });

        // Fetch Urgent Issues
        const { data: urgentData } = await supabase
          .from('issues')
          .select('*, location:locations(*), department:departments(*)')
          .in('priority', ['critical', 'high'])
          .not('status', 'in', '("resolved","verified")')
          .order('created_at', { ascending: false })
          .limit(5);

        if (urgentData) setUrgentIssues(urgentData as any);

        // Fetch Recent Reports
        const { data: recentData } = await supabase
          .from('issues')
          .select('*, location:locations(*), department:departments(*)')
          .order('created_at', { ascending: false })
          .limit(5);

        if (recentData) setRecentIssues(recentData as any);

      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, [supabase]);

  const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">Dashboard</h1>
        <p className="text-slate-500">{today}</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-slate-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-4 md:grid-cols-4"
        >
          <MetricCard 
            title="Open Issues" 
            value={metrics.open} 
            icon={AlertTriangle} 
            color="text-amber-600" 
            iconBg="bg-amber-100" 
          />
          <MetricCard 
            title="High Priority" 
            value={metrics.highPriority} 
            icon={ShieldAlert} 
            color="text-red-600" 
            iconBg="bg-red-100" 
          />
          <MetricCard 
            title="In Progress" 
            value={metrics.inProgress} 
            icon={Clock} 
            color="text-blue-600" 
            iconBg="bg-blue-100" 
          />
          <MetricCard 
            title="Resolved This Week" 
            value={metrics.resolvedWeek} 
            icon={CheckCircle2} 
            color="text-green-600" 
            iconBg="bg-green-100" 
          />
        </motion.div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Urgent Issues */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-navy-900">Urgent Issues</h2>
            <Link href="/admin/issues?priority=high,critical" className="text-sm font-medium text-teal-600 hover:text-teal-700 flex items-center">
              View all <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          
          <div className="space-y-3">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-slate-200 animate-pulse" />)
            ) : urgentIssues.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                No urgent issues at the moment.
              </div>
            ) : (
              urgentIssues.map((issue) => (
                <IssueCompactCard key={issue.id} issue={issue} />
              ))
            )}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-navy-900">Recent Reports</h2>
            <Link href="/admin/issues" className="text-sm font-medium text-teal-600 hover:text-teal-700 flex items-center">
              View all <ChevronRight className="h-4 w-4 ml-1" />
            </Link>
          </div>
          
          <div className="space-y-3">
            {loading ? (
              [1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-slate-200 animate-pulse" />)
            ) : recentIssues.length === 0 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
                No recent reports.
              </div>
            ) : (
              recentIssues.map((issue) => (
                <IssueCompactCard key={issue.id} issue={issue} />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function IssueCompactCard({ issue }: { issue: Issue }) {
  return (
    <Link href={`/admin/issues/${issue.id}`}>
      <motion.div 
        whileHover={{ scale: 1.01 }}
        className="group flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 transition-shadow hover:shadow-md"
      >
        <div className="mb-2 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500">{issue.human_id}</span>
            <PriorityBadge priority={issue.priority} />
            <StatusBadge status={issue.status} />
          </div>
          <span className="text-xs text-slate-400">{formatRelativeTime(issue.created_at)}</span>
        </div>
        <h3 className="mb-2 font-semibold text-slate-900 line-clamp-1 group-hover:text-teal-600 transition-colors">
          {issue.title}
        </h3>
        <div className="flex items-center text-sm text-slate-500 gap-4">
          {issue.location && (
            <div className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              <span>{issue.location.name}</span>
            </div>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
