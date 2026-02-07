'use client';

import { useState } from 'react';
import { Bot, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export default function AuditCheckout() {
  const [email, setEmail] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleCheckout = async () => {
    if (!email.trim()) { setError('Email is required'); return; }
    setLoading(true);
    setError('');

    try {
      let visitorId = '';
      if (typeof window !== 'undefined') {
        visitorId = localStorage.getItem('starfish_visitor') || '';
      }

      const res = await fetch(`${API_URL}/api/checkout/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), businessName: businessName.trim(), visitorId })
      });

      if (!res.ok) throw new Error('Checkout failed');
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
      setLoading(false);
    }
  };

  const benefits = [
    'Full competitive analysis of your online presence',
    'AI employee blueprint — exactly what it would do day one',
    'Revenue opportunity mapping for automation',
    'Custom implementation roadmap',
    '$500 applies as deposit toward your AI employee build'
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="max-w-lg w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <Bot className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Site Audit</h1>
          <p className="text-slate-400">See exactly what an AI employee would do for your business</p>
        </div>

        {/* Price Card */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-6 mb-6">
          <div className="flex items-baseline justify-between mb-6">
            <div>
              <span className="text-4xl font-bold text-white">$500</span>
              <span className="text-slate-400 ml-2">one-time</span>
            </div>
            <span className="text-xs bg-green-500/10 text-green-400 px-2 py-1 rounded-full">Applies as deposit</span>
          </div>

          <div className="space-y-3 mb-6">
            {benefits.map((b, i) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                <span className="text-sm text-slate-300">{b}</span>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Your email"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
            />
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="Business name"
              className="w-full px-4 py-3 bg-slate-900 border border-slate-600 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-500"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={handleCheckout}
              disabled={loading}
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
              ) : (
                <>Start My Audit <ArrowRight className="h-4 w-4" /></>
              )}
            </button>
          </div>
        </div>

        <div className="text-center space-y-2">
          <p className="text-xs text-slate-500">Secure payment via Stripe. Cancel anytime before audit delivery.</p>
          <Link href="/pricing" className="text-xs text-blue-400 hover:text-blue-300">View full pricing</Link>
          <span className="text-xs text-slate-600 mx-2">·</span>
          <Link href="/talk" className="text-xs text-blue-400 hover:text-blue-300">Talk to Boss B first</Link>
        </div>
      </div>
    </div>
  );
}
