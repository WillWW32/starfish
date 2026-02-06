'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useAgents } from '@/hooks/useAgents';
import { useSkills } from '@/hooks/useSkills';
import { Bot, Zap, MessageSquare, Activity } from 'lucide-react';
import Link from 'next/link';
import LandingPage from '@/components/LandingPage';

export default function Home() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) return null;
  if (!isAuthenticated) return <LandingPage />;

  return <Dashboard />;
}

function Dashboard() {
  const { agents, isLoading: agentsLoading } = useAgents();
  const { skills, isLoading: skillsLoading } = useSkills();

  const stats = [
    {
      name: 'Active Agents',
      value: agents?.filter((a: any) => a.running).length || 0,
      total: agents?.length || 0,
      icon: Bot,
      href: '/agents',
      color: 'text-blue-500'
    },
    {
      name: 'Skills Loaded',
      value: skills?.filter((s: any) => s.enabled).length || 0,
      total: skills?.length || 0,
      icon: Zap,
      href: '/skills',
      color: 'text-yellow-500'
    },
    {
      name: 'Messages Today',
      value: '\u2014',
      total: null,
      icon: MessageSquare,
      href: '#',
      color: 'text-green-500'
    },
    {
      name: 'System Status',
      value: 'Online',
      total: null,
      icon: Activity,
      href: '#',
      color: 'text-emerald-500'
    }
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage your Starfish AI agents and automations</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Link
            key={stat.name}
            href={stat.href}
            className="bg-card border rounded-lg p-6 hover:border-primary/50 transition-colors"
          >
            <div className="flex items-center justify-between">
              <stat.icon className={`h-8 w-8 ${stat.color}`} />
              {stat.total !== null && (
                <span className="text-xs text-muted-foreground">
                  {stat.value}/{stat.total}
                </span>
              )}
            </div>
            <div className="mt-4">
              <p className="text-2xl font-semibold">{stat.value}</p>
              <p className="text-sm text-muted-foreground">{stat.name}</p>
            </div>
          </Link>
        ))}
      </div>

      <div className="bg-card border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/agents/new" className="flex items-center gap-3 p-4 bg-primary/10 rounded-lg hover:bg-primary/20 transition-colors">
            <Bot className="h-5 w-5 text-primary" />
            <span>Create New Agent</span>
          </Link>
          <Link href="/skills" className="flex items-center gap-3 p-4 bg-yellow-500/10 rounded-lg hover:bg-yellow-500/20 transition-colors">
            <Zap className="h-5 w-5 text-yellow-500" />
            <span>Upload Skills</span>
          </Link>
          <Link href="/settings" className="flex items-center gap-3 p-4 bg-emerald-500/10 rounded-lg hover:bg-emerald-500/20 transition-colors">
            <Activity className="h-5 w-5 text-emerald-500" />
            <span>Configure Channels</span>
          </Link>
        </div>
      </div>

      <div className="bg-card border rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Agents</h2>
          <Link href="/agents" className="text-sm text-primary hover:underline">View All</Link>
        </div>
        {agentsLoading ? (
          <p className="text-muted-foreground">Loading...</p>
        ) : agents?.length === 0 ? (
          <p className="text-muted-foreground">No agents created yet. Create your first agent to get started.</p>
        ) : (
          <div className="space-y-3">
            {agents?.slice(0, 5).map((agent: any) => (
              <Link
                key={agent.id}
                href={`/agents/${agent.id}`}
                className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${agent.running ? 'bg-green-500' : 'bg-gray-500'}`} />
                  <div>
                    <p className="font-medium">{agent.name}</p>
                    <p className="text-xs text-muted-foreground">{agent.model}</p>
                  </div>
                </div>
                <span className="text-xs text-muted-foreground">{agent.skills?.length || 0} skills</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
