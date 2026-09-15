'use client'

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Issue } from '@/types/database';
import { Search, Filter, MapPin, Clock, ArrowUpDown } from 'lucide-react';
import { STATUS_CONFIG, PRIORITY_CONFIG, CATEGORY_CONFIG } from '@/lib/constants';
import { formatRelativeTime } from '@/lib/utils';
import Link from 'next/link';
import { motion } from 'framer-motion';

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

export default function IssueManagementPage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState('newest');

  const supabase = createClient();

  useEffect(() => {
    fetchIssues();
    
    const subscription = supabase
      .channel('public:issues')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, () => {
        fetchIssues();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [statusFilter, priorityFilter, categoryFilter, sortBy, searchTerm]); // re-fetch when filters change

  const fetchIssues = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('issues')
        .select('*, location:locations(*), department:departments(*), reporter:profiles!reporter_id(*)');

      if (statusFilter !== 'All') {
        const statusKey = Object.keys(STATUS_CONFIG).find(key => STATUS_CONFIG[key as keyof typeof STATUS_CONFIG].label === statusFilter);
        if (statusKey) query = query.eq('status', statusKey);
      }
      if (priorityFilter !== 'All') {
        const priorityKey = Object.keys(PRIORITY_CONFIG).find(key => PRIORITY_CONFIG[key as keyof typeof PRIORITY_CONFIG].label === priorityFilter);
        if (priorityKey) query = query.eq('priority', priorityKey);
      }
      if (categoryFilter !== 'All') {
        const categoryKey = Object.keys(CATEGORY_CONFIG).find(key => CATEGORY_CONFIG[key as keyof typeof CATEGORY_CONFIG].label === categoryFilter);
        if (categoryKey) query = query.eq('category', categoryKey);
      }

      if (searchTerm) {
        query = query.or(`human_id.ilike.%${searchTerm}%,title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`);
      }

      switch (sortBy) {
        case 'newest':
          query = query.order('created_at', { ascending: false });
          break;
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'highest_priority':
          query = query.order('priority_score', { ascending: false });
          break;
        case 'longest_unresolved':
          query = query.in('status', ['reported', 'acknowledged', 'assigned', 'in_progress']).order('created_at', { ascending: true });
          break;
      }

      // Limit for demo purposes
      query = query.limit(50);

      const { data, error } = await query;
      
      if (error) throw error;
      if (data) setIssues(data as any);
    } catch (error) {
      console.error('Error fetching issues:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight text-navy-900">Issue Management</h1>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search ID, title..."
            className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-10 pr-4 outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 sm:w-64 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-slate-400" />
          <span className="text-sm font-medium text-slate-700">Filters:</span>
        </div>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-teal-500"
        >
          <option>All</option>
          {Object.values(STATUS_CONFIG).map(config => <option key={config.label}>{config.label}</option>)}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => setPriorityFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-teal-500"
        >
          <option>All</option>
          {Object.values(PRIORITY_CONFIG).map(config => <option key={config.label}>{config.label}</option>)}
        </select>

        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-teal-500"
        >
          <option>All</option>
          {Object.values(CATEGORY_CONFIG).map(config => <option key={config.label}>{config.label}</option>)}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <ArrowUpDown className="h-4 w-4 text-slate-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm outline-none focus:border-teal-500"
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
            <option value="highest_priority">Highest Priority</option>
            <option value="longest_unresolved">Longest Unresolved</option>
          </select>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading issues...</div>
        ) : issues.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No issues found matching your criteria.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">ID / Issue</th>
                  <th className="hidden px-6 py-4 font-semibold md:table-cell">Location</th>
                  <th className="hidden px-6 py-4 font-semibold md:table-cell">Category</th>
                  <th className="px-6 py-4 font-semibold">Status & Priority</th>
                  <th className="hidden px-6 py-4 font-semibold lg:table-cell">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {issues.map((issue) => (
                  <tr key={issue.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link href={`/admin/issues/${issue.id}`} className="block">
                        <div className="font-medium text-teal-600 mb-1">{issue.human_id}</div>
                        <div className="font-semibold text-slate-900 line-clamp-1 group-hover:text-teal-700">{issue.title}</div>
                      </Link>
                    </td>
                    <td className="hidden px-6 py-4 md:table-cell">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span className="line-clamp-1">{issue.location?.name || 'Unknown'}</span>
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 md:table-cell">
                      {CATEGORY_CONFIG[issue.category]?.label}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2 items-start">
                        <StatusBadge status={issue.status} />
                        <PriorityBadge priority={issue.priority} />
                      </div>
                    </td>
                    <td className="hidden px-6 py-4 lg:table-cell">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span>{formatRelativeTime(issue.created_at)}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
