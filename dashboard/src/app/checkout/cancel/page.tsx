'use client';

import { XCircle } from 'lucide-react';
import Link from 'next/link';

export default function CheckoutCancel() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-slate-700/50 flex items-center justify-center mx-auto mb-6">
          <XCircle className="h-8 w-8 text-slate-400" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-3">No worries.</h1>
        <p className="text-slate-400 mb-6">
          Payment was cancelled. No charge was made. Come back anytime — Boss B will be here.
        </p>
        <div className="flex gap-3 justify-center">
          <Link href="/talk" className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-500">Talk to Boss B</Link>
          <Link href="/checkout/audit" className="px-4 py-2 bg-slate-700 text-white rounded-lg text-sm hover:bg-slate-600">Try Again</Link>
        </div>
      </div>
    </div>
  );
}
