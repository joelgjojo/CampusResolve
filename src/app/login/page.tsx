'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import Image from 'next/image';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { signIn } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await signIn(email, password);

      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) {
        throw new Error('Failed to get user session');
      }

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userData.user.id)
        .single();

      if (profileError) {
        throw profileError;
      }

      if (profile.role === 'admin') {
        router.push('/admin');
      } else {
        router.push('/student');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-100 to-teal-50/30 p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }} 
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white/80 backdrop-blur-xl rounded-3xl shadow-xl border border-white/20 p-8"
      >
        <div className="flex flex-col items-center mb-8">
          <Image 
            src="/images/logo.png" 
            alt="CampusResolve Logo" 
            width={180} 
            height={60} 
            className="mb-2"
          />
          <p className="text-slate-500 font-medium">See it. Report it. Resolve it.</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="email">Email</label>
            <input 
              id="email"
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1" htmlFor="password">Password</label>
            <input 
              id="password"
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full h-12 px-4 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
              placeholder="Enter your password"
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="w-full bg-navy-900 hover:bg-navy-800 text-white rounded-xl h-12 font-semibold flex items-center justify-center transition-colors disabled:opacity-70"
          >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : 'Sign In'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-teal-600 font-semibold hover:underline">
            Sign up
          </Link>
        </div>

        <div className="mt-6 pt-5 border-t border-slate-200/80">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider text-center mb-2.5">
            ⚡ Quick Demo Sign-In
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setEmail('student@campus.edu');
                setPassword('demo1234');
              }}
              className="px-3 py-2 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-navy-900 rounded-xl transition-colors text-center"
            >
              Fill Student Demo
            </button>
            <button
              type="button"
              onClick={() => {
                setEmail('admin@campus.edu');
                setPassword('admin1234');
              }}
              className="px-3 py-2 text-xs font-medium bg-teal-50 hover:bg-teal-100 text-teal-800 rounded-xl transition-colors text-center"
            >
              Fill Admin Demo
            </button>
          </div>
          <p className="text-[11px] text-slate-400 text-center mt-2">
            student@campus.edu (demo1234) · admin@campus.edu (admin1234)
          </p>
        </div>
      </motion.div>
    </div>
  );
}
