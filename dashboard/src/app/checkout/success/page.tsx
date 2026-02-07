'use client';

import { CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function CheckoutSuccess() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="h-8 w-8 text-green-400" />
        </div>
        <h1 className="text-3xl font-bold text-white mb-3">You're in.</h1>
        <p className="text-slate-400 mb-6">
          Payment received. WJ will be in touch within 24 hours to kick off your audit. Check your email for confirmation.
        </p>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-6 text-left">
          <h3 className="text-sm font-medium text-white mb-2">What happens next:</h3>
          <ol className="space-y-2 text-sm text-slate-400">
            <li className="flex gap-2"><span className="text-blue-400 font-medium">1.</span> WJ reviews your business and online presence</li>
            <li className="flex gap-2"><span className="text-blue-400 font-medium">2.</span> You get a full audit report + AI employee blueprint</li>
            <li className="flex gap-2"><span className="text-blue-400 font-medium">3.</span> If you're ready, your $500 applies toward the build</li>
          </ol>
        </div>
        <Link href="/talk" className="inline-flex items-center gap-2 text-blue-400 hover:text-blue-300 text-sm">
          Back to Boss B <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
