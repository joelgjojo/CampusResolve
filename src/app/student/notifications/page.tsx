'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Notification } from '@/types/database'
import { formatRelativeTime } from '@/lib/utils'
import { Bell, CheckCircle2, Info, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { motion } from 'framer-motion'

export default function NotificationsPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return

    const fetchNotifications = async () => {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
      
      if (data) {
        setNotifications(data as Notification[])
      }
      setLoading(false)
    }

    fetchNotifications()

    const sub = supabase.channel(`notifications-${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, () => {
        fetchNotifications()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(sub)
    }
  }, [user, supabase])

  const markAllAsRead = async () => {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id).eq('read', false)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  const markAsRead = async (id: string) => {
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }

  const getIcon = (title: string) => {
    if (title.toLowerCase().includes('resolved') || title.toLowerCase().includes('verified')) return <CheckCircle2 className="w-5 h-5 text-emerald-500" />
    if (title.toLowerCase().includes('urgent') || title.toLowerCase().includes('critical')) return <AlertTriangle className="w-5 h-5 text-red-500" />
    return <Info className="w-5 h-5 text-blue-500" />
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-navy-900">Notifications</h1>
        {notifications.some(n => !n.read) && (
          <button 
            onClick={markAllAsRead}
            className="text-sm font-medium text-teal-600 hover:text-teal-700 bg-teal-50 px-3 py-1.5 rounded-full transition-colors"
          >
            Mark all as read
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm animate-pulse h-24"></div>
          ))}
        </div>
      ) : notifications.length > 0 ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          {notifications.map((notification) => {
            const content = (
              <motion.div 
                whileHover={{ scale: 1.01 }}
                className={`p-4 rounded-2xl border transition-all ${
                  notification.read ? 'bg-white border-slate-100' : 'bg-teal-50/30 border-teal-100 shadow-sm'
                } flex gap-4`}
              >
                <div className="mt-1 shrink-0">{getIcon(notification.title)}</div>
                <div className="flex-1">
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <h3 className={`font-semibold ${notification.read ? 'text-slate-700' : 'text-navy-900'}`}>
                      {notification.title}
                    </h3>
                    <span className="text-xs text-slate-400 whitespace-nowrap">
                      {formatRelativeTime(notification.created_at)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">{notification.message}</p>
                </div>
                {!notification.read && (
                  <div className="w-2 h-2 rounded-full bg-teal-500 mt-2 shrink-0"></div>
                )}
              </motion.div>
            )

            return notification.issue_id ? (
              <Link 
                href={`/student/issues/${notification.issue_id}`} 
                key={notification.id} 
                className="block"
                onClick={() => !notification.read && markAsRead(notification.id)}
              >
                {content}
              </Link>
            ) : (
              <div key={notification.id} onClick={() => !notification.read && markAsRead(notification.id)}>
                {content}
              </div>
            )
          })}
        </motion.div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 border-dashed">
          <div className="mx-auto w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
            <Bell className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-medium text-navy-900 mb-1">No notifications yet</h3>
          <p className="text-slate-500">When your issues are updated, you&apos;ll see notifications here.</p>
        </div>
      )}
    </div>
  )
}
