'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Bot, Zap, MessageSquare, Globe, Shield, Layers } from 'lucide-react';

const features = [
  {
    icon: Bot,
    title: 'Multi-Agent Orchestration',
    description: 'Deploy and manage multiple AI agents that work together. Each agent handles a specific domain — support, sales, content, ops.',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
  },
  {
    icon: Zap,
    title: 'Modular Skills',
    description: 'Load custom skills onto any agent. Swap capabilities without rebuilding. Your agents evolve as your business does.',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
  },
  {
    icon: MessageSquare,
    title: 'Channel Adapters',
    description: 'Connect agents to Telegram, SMS, email, web chat, and more. One agent, every channel — no code changes needed.',
    color: 'text-green-400',
    bg: 'bg-green-500/10',
  },
  {
    icon: Globe,
    title: 'Campaign Engine',
    description: 'Build automated outreach sequences. Your agents don\'t just respond — they proactively engage across platforms.',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
  },
  {
    icon: Shield,
    title: 'Secure by Default',
    description: 'Role-based access, encrypted credentials, audit logs. Enterprise-grade security without enterprise complexity.',
    color: 'text-red-400',
    bg: 'bg-red-500/10',
  },
  {
    icon: Layers,
    title: 'Model Agnostic',
    description: 'Run on GPT-4, Claude, Llama, or any model. Switch providers per-agent. No vendor lock-in, ever.',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
  },
];

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Starfish AI',
  applicationCategory: 'BusinessApplication',
  url: 'https://bigstarfish.com',
  description:
    'Custom AI agent teams that handle outbound marketing, customer engagement, and content creation 24/7 for small business.',
  offers: {
    '@type': 'Offer',
    category: 'Custom AI Agent Development',
  },
  creator: {
    '@type': 'Organization',
    name: 'EntreArtists',
    url: 'https://entreartists.com',
    email: 'jesse@entreartists.com',
  },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 max-w-6xl mx-auto">
        <div className="flex items-center gap-3">
          <Image src="/starfish-logo.png" alt="Starfish" width={40} height={40} />
          <span className="text-xl font-bold text-white">Starfish</span>
        </div>
        <Link
          href="/login"
          className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Sign In
        </Link>
      </nav>

      {/* Hero */}
      <section className="max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
        <div className="inline-block px-4 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-blue-400 text-sm font-medium mb-6">
          AI Employees for Small Business
        </div>
        <h1 className="text-5xl md:text-6xl font-bold text-white leading-tight mb-6">
          We Build A.I. Employees<br />
          <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
            for Small Business that Crush It.
          </span>
        </h1>
        <p className="text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Custom AI agents that handle support, sales, scheduling, and outreach — across every channel your business touches.
          They work 24/7. They never quit. And they cost a fraction of a hire.
        </p>
        <div className="flex items-center justify-center gap-4">
          <a
            href="mailto:jesse@entreartists.com?subject=Starfish%20AI%20Inquiry"
            className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-lg"
          >
            Inquire Now
          </a>
          <Link
            href="/login"
            className="px-8 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium rounded-lg border border-slate-700 transition-colors text-lg"
          >
            Client Login
          </Link>
        </div>
      </section>

      {/* Features Grid */}
      <section className="max-w-6xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-white text-center mb-4">
          Everything you need to run AI at scale
        </h2>
        <p className="text-slate-400 text-center mb-12 max-w-xl mx-auto">
          From a single chatbot to a fleet of specialized agents — Starfish grows with you.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-6 hover:border-slate-600 transition-colors"
            >
              <div className={`inline-flex p-3 rounded-lg ${feature.bg} mb-4`}>
                <feature.icon className={`h-6 w-6 ${feature.color}`} />
              </div>
              <h3 className="text-lg font-semibold text-white mb-2">{feature.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works */}
      <section className="max-w-4xl mx-auto px-6 py-20">
        <h2 className="text-3xl font-bold text-white text-center mb-12">
          Three steps to your first agent
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { step: '01', title: 'Create an Agent', desc: 'Pick a model, give it a name and system prompt. Done in 30 seconds.' },
            { step: '02', title: 'Load Skills', desc: 'Attach pre-built or custom skills — booking, support, writing, analysis, anything.' },
            { step: '03', title: 'Connect Channels', desc: 'Wire it to Telegram, SMS, email, or your own app via API. Go live instantly.' },
          ].map((item) => (
            <div key={item.step} className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-600/20 text-blue-400 font-bold text-lg mb-4">
                {item.step}
              </div>
              <h3 className="text-white font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-slate-400 text-sm">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <div className="bg-gradient-to-r from-blue-600/20 to-cyan-600/20 border border-blue-500/20 rounded-2xl p-12">
          <h2 className="text-3xl font-bold text-white mb-4">Ready to put AI to work for your business?</h2>
          <p className="text-slate-400 mb-8">Tell us your use case. We'll build the agent.</p>
          <a
            href="mailto:jesse@entreartists.com?subject=Starfish%20AI%20Inquiry"
            className="inline-block px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors text-lg"
          >
            Get in Touch
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-8 border-t border-slate-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-500 text-sm">
            <Image src="/starfish-logo.png" alt="Starfish" width={20} height={20} />
            <span>&copy; 2026 EntreArtists. All rights reserved.</span>
          </div>
          <a
            href="mailto:jesse@entreartists.com"
            className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
          >
            jesse@entreartists.com
          </a>
        </div>
      </footer>
    </div>
  );
}
