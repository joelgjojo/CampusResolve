'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Image from 'next/image';

export default function RootPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (profile) {
        if (profile.role === 'admin') {
          router.push('/admin');
        } else {
          router.push('/student');
        }
      }
    }
  }, [user, profile, loading, router]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
      <div className="flex flex-col items-center animate-pulse">
        <Image 
          src="/images/logo.png" 
          alt="CampusResolve Logo" 
          width={240} 
          height={80} 
          className="mb-4 opacity-80"
          priority
        />
        <p className="text-slate-500 font-medium">Loading...</p>
      </div>
    </div>
  );
}
