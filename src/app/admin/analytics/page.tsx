'use client'

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_CONFIG, STATUS_CONFIG, PRIORITY_CONFIG } from '@/lib/constants';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Calendar, AlertTriangle, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [timePeriod, setTimePeriod] = useState('month'); // week, month, all
  
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [statusData, setStatusData] = useState<any[]>([]);
  const [hotspots, setHotspots] = useState<any[]>([]);
  const [deptBacklog, setDeptBacklog] = useState<any[]>([]);
  
  const supabase = createClient();

  useEffect(() => {
    fetchAnalyticsData();
  }, [timePeriod]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    try {
      // Setup time filter
      let startDate = new Date();
      if (timePeriod === 'week') startDate.setDate(startDate.getDate() - 7);
      if (timePeriod === 'month') startDate.setMonth(startDate.getMonth() - 1);
      if (timePeriod === 'all') startDate = new Date(0); // Beginning of time

      const { data: issues } = await supabase
        .from('issues')
        .select('*, location:locations(name), department:departments(name)')
        .gte('created_at', startDate.toISOString());

      if (!issues) return;

      // 1. Issues by Category
      const catCount: Record<string, number> = {};
      issues.forEach(i => {
        catCount[i.category] = (catCount[i.category] || 0) + 1;
      });
      setCategoryData(Object.keys(catCount).map(k => ({
        name: CATEGORY_CONFIG[k as keyof typeof CATEGORY_CONFIG]?.label || k,
        value: catCount[k],
        color: CATEGORY_CONFIG[k as keyof typeof CATEGORY_CONFIG]?.color || '#cbd5e1'
      })).sort((a, b) => b.value - a.value));

      // 2. Issues by Status
      const statusCount: Record<string, number> = {};
      issues.forEach(i => {
        statusCount[i.status] = (statusCount[i.status] || 0) + 1;
      });
      setStatusData(Object.keys(statusCount).map(k => ({
        name: STATUS_CONFIG[k as keyof typeof STATUS_CONFIG]?.label || k,
        value: statusCount[k],
        color: STATUS_CONFIG[k as keyof typeof STATUS_CONFIG]?.color || '#94a3b8'
      })));

      // 3. Hotspots
      const locCount: Record<string, { count: number, locName: string, category: string }> = {};
      issues.forEach(i => {
        if (!i.location_id) return;
        if (!locCount[i.location_id]) {
          locCount[i.location_id] = { count: 0, locName: i.location?.name || 'Unknown', category: i.category };
        }
        locCount[i.location_id].count++;
      });
      setHotspots(Object.values(locCount).sort((a, b) => b.count - a.count).slice(0, 5));

      // 4. Department Backlog
      const deptCount: Record<string, { name: string, count: number }> = {};
      issues.forEach(i => {
        if (!i.assigned_department_id || ['resolved', 'verified'].includes(i.status)) return;
        if (!deptCount[i.assigned_department_id]) {
          deptCount[i.assigned_department_id] = { name: i.department?.name || 'Unknown', count: 0 };
        }
        deptCount[i.assigned_department_id].count++;
      });
      setDeptBacklog(Object.values(deptCount).sort((a, b) => b.count - a.count));

    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-navy-900">Analytics & Insights</h1>
          <p className="text-slate-500">Track and analyze campus issues</p>
        </div>
        
        <div className="flex items-center gap-2 bg-white rounded-xl p-1 shadow-sm border border-slate-200">
          {['week', 'month', 'all'].map((p) => (
            <button
              key={p}
              onClick={() => setTimePeriod(p)}
              className={`px-4 py-2 text-sm font-medium rounded-lg capitalize transition-colors ${
                timePeriod === p ? 'bg-teal-50 text-teal-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              {p === 'all' ? 'All Time' : `This ${p}`}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          <div className="h-96 bg-slate-200 rounded-2xl"></div>
          <div className="h-96 bg-slate-200 rounded-2xl"></div>
          <div className="h-96 bg-slate-200 rounded-2xl"></div>
          <div className="h-96 bg-slate-200 rounded-2xl"></div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Chart */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl border border-white/20 shadow-sm"
            >
              <h3 className="text-lg font-bold text-navy-900 mb-6">Issues by Category</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryData} layout="vertical" margin={{ left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#f1f5f9' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {categoryData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>

            {/* Status Chart */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl border border-white/20 shadow-sm"
            >
              <h3 className="text-lg font-bold text-navy-900 mb-6">Issue Status Distribution</h3>
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={80}
                      outerRadius={110}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Hotspots Insight */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl border border-white/20 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-6">
                <AlertTriangle className="h-6 w-6 text-amber-500" />
                <h3 className="text-lg font-bold text-navy-900">Recurring Hotspots</h3>
              </div>
              
              <div className="space-y-4">
                {hotspots.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No significant hotspots identified.</p>
                ) : (
                  hotspots.map((spot, idx) => (
                    <div 
                      key={idx} 
                      className={`p-4 rounded-xl border ${spot.count >= 3 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}
                    >
                      <div className="flex justify-between items-start mb-2">
                        <span className="font-semibold text-slate-900">{spot.locName}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${spot.count >= 3 ? 'bg-amber-200 text-amber-800' : 'bg-slate-200 text-slate-700'}`}>
                          {spot.count} Issues
                        </span>
                      </div>
                      <p className="text-sm text-slate-600">
                        {spot.count >= 3 
                          ? `${spot.count} ${CATEGORY_CONFIG[spot.category as keyof typeof CATEGORY_CONFIG]?.label || spot.category} reports in ${spot.locName} this ${timePeriod}. Consider inspecting underlying infrastructure.`
                          : `Normal volume of reports for this area.`}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </motion.div>

            {/* Department Backlog */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/70 backdrop-blur-xl p-6 rounded-2xl border border-white/20 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="h-6 w-6 text-blue-500" />
                <h3 className="text-lg font-bold text-navy-900">Department Backlogs</h3>
              </div>
              
              <div className="space-y-4">
                {deptBacklog.length === 0 ? (
                  <p className="text-slate-500 text-center py-4">No pending department backlogs.</p>
                ) : (
                  deptBacklog.map((dept, idx) => (
                    <div key={idx} className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="font-medium text-slate-700">{dept.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-2xl font-bold text-navy-900">{dept.count}</span>
                        <span className="text-xs text-slate-500">Open</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </div>
  );
}
