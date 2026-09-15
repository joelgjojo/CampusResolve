'use client'

import { useAuth } from '@/contexts/AuthContext'
import { LogOut, User, Mail, Hash, BookOpen, Calendar } from 'lucide-react'

export default function ProfilePage() {
  const { profile, signOut } = useAuth()

  if (!profile) {
    return <div className="p-8 text-center text-slate-500 animate-pulse">Loading profile...</div>
  }

  const initials = profile.full_name
    .split(' ')
    .map(n => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase()

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-8">
      <h1 className="text-2xl font-bold text-navy-900">Profile</h1>

      <div className="bg-white rounded-3xl p-6 md:p-8 border border-slate-100 shadow-sm flex flex-col items-center text-center space-y-4">
        <div className="w-24 h-24 rounded-full bg-teal-500 text-white flex items-center justify-center text-3xl font-bold shadow-md">
          {initials}
        </div>
        
        <div>
          <h2 className="text-2xl font-bold text-navy-900">{profile.full_name}</h2>
          <div className="text-slate-500 mt-1">{profile.email}</div>
        </div>
        
        <div className="inline-flex px-3 py-1 bg-teal-50 text-teal-700 rounded-full text-sm font-medium capitalize">
          {profile.role}
        </div>
      </div>

      <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-6">
        <h3 className="text-lg font-semibold text-navy-900 border-b border-slate-100 pb-3">Academic Details</h3>
        
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
              <Hash className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm text-slate-400 font-medium">Roll Number</div>
              <div className="text-navy-900 font-medium">{profile.roll_number || 'Not provided'}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm text-slate-400 font-medium">Department</div>
              <div className="text-navy-900 font-medium">{profile.department || 'Not provided'}</div>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-500 shrink-0">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm text-slate-400 font-medium">Year</div>
              <div className="text-navy-900 font-medium">{profile.year ? `Year ${profile.year}` : 'Not provided'}</div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={signOut}
        className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl border-2 border-red-100 text-red-600 font-medium hover:bg-red-50 hover:border-red-200 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        Sign Out
      </button>
    </div>
  )
}
