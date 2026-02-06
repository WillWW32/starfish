'use client';

import { useState } from 'react';
import { useAgents, createAgent, deleteAgent } from '@/hooks/useAgents';
import { Bot, Plus, Trash2, Play, Square } from 'lucide-react';
import { toast } from 'sonner';

export default function AgentsPage() {
  const { agents, isLoading, mutate } = useAgents();
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: '',
    description: '',
    model: 'claude-sonnet-4-5-20250929',
    systemPrompt: 'You are a helpful AI assistant.',
    skills: [] as string[]
  });

  const handleCreate = async () => {
    if (!newAgent.name.trim()) {
      toast.error('Agent name is required');
      return;
    }
    setCreating(true);
    try {
      await createAgent(newAgent);
      toast.success(`Agent "${newAgent.name}" created`);
      setShowCreate(false);
      setNewAgent({ name: '', description: '', model: 'claude-sonnet-4-5-20250929', systemPrompt: 'You are a helpful AI assistant.', skills: [] });
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create agent');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete agent "${name}"?`)) return;
    try {
      await deleteAgent(id);
      toast.success(`Agent "${name}" deleted`);
      mutate();
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete agent');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agents</h1>
          <p className="text-muted-foreground mt-1">Create and manage your AI agents</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Agent
        </button>
      </div>

      {/* Create Agent Form */}
      {showCreate && (
        <div className="bg-card border rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-semibold">Create New Agent</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Name</label>
              <input
                type="text"
                value={newAgent.name}
                onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })}
                placeholder="My Agent"
                className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Model</label>
              <select
                value={newAgent.model}
                onChange={(e) => setNewAgent({ ...newAgent, model: e.target.value })}
                className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5</option>
                <option value="claude-opus-4-5-20251101">Claude Opus 4.5</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input
              type="text"
              value={newAgent.description}
              onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })}
              placeholder="What does this agent do?"
              className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">System Prompt</label>
            <textarea
              value={newAgent.systemPrompt}
              onChange={(e) => setNewAgent({ ...newAgent, systemPrompt: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50"
            >
              {creating ? 'Creating...' : 'Create Agent'}
            </button>
            <button
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Agents List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">Loading agents...</div>
      ) : !agents?.length ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-lg font-medium">No agents yet</p>
          <p className="text-muted-foreground mt-1">Create your first agent to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {agents.map((agent: any) => (
            <div key={agent.id} className="bg-card border rounded-lg p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${agent.running ? 'bg-green-500/10' : 'bg-muted'}`}>
                    <Bot className={`h-5 w-5 ${agent.running ? 'text-green-500' : 'text-muted-foreground'}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold">{agent.name}</h3>
                    {agent.description && (
                      <p className="text-sm text-muted-foreground mt-1">{agent.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs bg-muted px-2 py-0.5 rounded">{agent.model}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${agent.running ? 'bg-green-500/10 text-green-500' : 'bg-muted text-muted-foreground'}`}>
                        {agent.running ? 'Running' : 'Stopped'}
                      </span>
                      {agent.skills?.length > 0 && (
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                          {agent.skills.length} skills
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(agent.id, agent.name)}
                  className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
