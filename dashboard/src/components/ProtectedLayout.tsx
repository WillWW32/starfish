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
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    if (isLoading) {
      return;
    }

    const isPublicPage = pathname === '/login' || pathname === '/' || pathname === '/talk' || pathname.startsWith('/checkout') || pathname === '/pricing';

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

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

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
  if (pathname === '/login' || pathname === '/talk' || pathname.startsWith('/checkout') || pathname === '/pricing' || (pathname === '/' && !isAuthenticated)) {
    return children;
  }

  // Protected layout - with sidebar
  return (
    <div className="flex h-screen bg-slate-900">
      <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
      <main className="flex-1 min-w-0 overflow-auto p-4 md:p-8 pt-16 md:pt-8">{children}</main>
    </div>
  );
}
