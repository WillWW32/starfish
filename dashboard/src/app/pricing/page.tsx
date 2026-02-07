'use client';

import { CheckCircle, ArrowRight, Bot, Zap, Users } from 'lucide-react';
import Link from 'next/link';

const tiers = [
  {
    name: 'Starter',
    price: '$4,000',
    icon: Bot,
    description: 'One AI employee trained on your business.',
    features: [
      '1 custom AI agent',
      '6 skills (email, social, scheduling, etc.)',
      'Trained on your brand voice & workflows',
      'Dashboard access',
      '30-day tuning & support',
      'Monthly maintenance available'
    ],
    cta: 'Start with Audit',
    popular: false
  },
  {
    name: 'Growth',
    price: '$6,000',
    icon: Zap,
    description: 'AI employee with advanced capabilities.',
    features: [
      '1 custom AI agent',
      '10 skills including browser & video',
      'Agent delegation to sub-agents',
      'Knowledge base with auto-learning',
      'Dashboard + analytics',
      '60-day tuning & support'
    ],
    cta: 'Start with Audit',
    popular: true
  },
  {
    name: 'Enterprise',
    price: '$10,000',
    icon: Users,
    description: 'Full AI team for your business.',
    features: [
      'Multi-agent team (3+ agents)',
      'All skills unlocked',
      'Agent-to-agent communication',
      'Knowledge base + folder sync',
      'Custom integrations',
      '90-day tuning & priority support'
    ],
    cta: 'Start with Audit',
    popular: false
  }
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-4 py-16">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4">Your AI Employee</h1>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Not a chatbot. An actual digital employee trained on your business, your voice, your workflows. Working 24/7.
          </p>
        </div>

        {/* Audit CTA */}
        <div className="bg-blue-600/10 border border-blue-500/20 rounded-2xl p-6 mb-12 text-center max-w-2xl mx-auto">
          <p className="text-blue-300 text-sm mb-1">Every build starts here</p>
          <h2 className="text-2xl font-bold text-white mb-2">$500 Site Audit</h2>
          <p className="text-slate-400 text-sm mb-4">
            We analyze your business, competitors, and online presence. You get a full blueprint of what your AI employee would do day one. The $500 applies as a deposit toward any tier.
          </p>
          <Link
            href="/checkout/audit"
            className="inline-flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-500 transition-colors"
          >
            Get Your Audit <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* Tiers */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`bg-slate-800/50 border rounded-2xl p-6 relative ${
                tier.popular ? 'border-blue-500 ring-1 ring-blue-500/20' : 'border-slate-700'
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full">
                  Most Popular
                </span>
              )}
              <div className="flex items-center gap-2 mb-3">
                <tier.icon className="h-5 w-5 text-blue-400" />
                <h3 className="text-lg font-bold text-white">{tier.name}</h3>
              </div>
              <div className="mb-3">
                <span className="text-3xl font-bold text-white">{tier.price}</span>
                <span className="text-slate-500 text-sm ml-1">one-time</span>
              </div>
              <p className="text-sm text-slate-400 mb-5">{tier.description}</p>
              <div className="space-y-2.5 mb-6">
                {tier.features.map((f, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-slate-300">{f}</span>
                  </div>
                ))}
              </div>
              <Link
                href="/checkout/audit"
                className={`block text-center py-2.5 rounded-lg font-medium text-sm transition-colors ${
                  tier.popular
                    ? 'bg-blue-600 text-white hover:bg-blue-500'
                    : 'bg-slate-700 text-white hover:bg-slate-600'
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-slate-500 space-y-1">
          <p>All builds include custom training, skill configuration, dashboard access, and hands-on tuning.</p>
          <p>Questions? <Link href="/talk" className="text-blue-400 hover:text-blue-300">Talk to Boss B</Link></p>
        </div>
      </div>
    </div>
  );
}
