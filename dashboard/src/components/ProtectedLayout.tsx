'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Sidebar from '@/components/ui/sidebar';

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading } = useAuth();
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const isPublicPage = pathname === '/login' || pathname === '/';

    if (!isAuthenticated && !isPublicPage) {
      router.push('/login');
      return;
    }

    if (isAuthenticated && pathname === '/login') {
      router.push('/');
      return;
    }

    setShouldRender(true);
  }, [isAuthenticated, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-3 border-slate-700 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!shouldRender) {
    return null;
  }

  // Public pages - no sidebar
  if (pathname === '/login' || (pathname === '/' && !isAuthenticated)) {
    return children;
  }

  // Protected layout - with sidebar
  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar />
      <main className="flex-1 overflow-auto p-8">{children}</main>
    </div>
  );
}
