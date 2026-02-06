'use client';

import { useTeam } from '@/hooks/useTeam';
import { Bot, Users, Activity, Zap, ChevronRight } from 'lucide-react';
import Link from 'next/link';

export default function TeamPage() {
  const { agents, count, isLoading } = useTeam();

  const runningCount = agents?.filter((a: any) => a.running).length || 0;
  const totalSkills = agents?.reduce((sum: number, a: any) => sum + (a.skills?.length || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Team</h1>
        <p className="text-muted-foreground mt-1">Your AI agent team at a glance</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{count || 0}</p>
              <p className="text-xs text-muted-foreground">Total Agents</p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Activity className="h-5 w-5 text-green-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{runningCount}</p>
              <p className="text-xs text-muted-foreground">Running</p>
            </div>
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-500/10">
              <Zap className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-2xl font-bold">{totalSkills}</p>
              <p className="text-xs text-muted-foreground">Skills Loaded</p>
            </div>
          </div>
        </div>
      </div>

      {/* Agent Cards */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading team...</div>
      ) : !agents?.length ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No agents on the team yet</p>
          <p className="text-muted-foreground mt-1">
            <Link href="/agents" className="text-primary hover:underline">Create your first agent</Link> to get started
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {agents.map((agent: any) => (
            <div key={agent.id} className="bg-card border rounded-lg p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${agent.running ? 'bg-green-500/10' : 'bg-muted'}`}>
                    <Bot className={`h-6 w-6 ${agent.running ? 'text-green-500' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-lg">{agent.name}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${agent.running ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                        {agent.running ? 'Active' : 'Idle'}
                      </span>
                    </div>
                    {agent.description && (
                      <p className="text-sm text-muted-foreground mt-0.5">{agent.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">{agent.model}</span>
                      {agent.skills?.map((skill: string) => (
                        <span key={skill} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/chat?agent=${agent.id}`}
                  className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                >
                  <ChevronRight className="h-5 w-5" />
                </Link>
              </div>

              {/* Sub-agents */}
              {agent.subAgents?.length > 0 && (
                <div className="mt-4 ml-12 space-y-2 border-l-2 border-muted pl-4">
                  {agent.subAgents.map((sub: any) => (
                    <div key={sub.id} className="flex items-center gap-3 py-2">
                      <Bot className={`h-4 w-4 ${sub.running ? 'text-green-500' : 'text-muted-foreground'}`} />
                      <span className="text-sm font-medium">{sub.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${sub.running ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                        {sub.running ? 'Active' : 'Idle'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
