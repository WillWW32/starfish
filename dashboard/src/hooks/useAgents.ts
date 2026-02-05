import useSWR from 'swr';
import { apiFetch } from '@/lib/utils';

interface Agent {
  id: string;
  name: string;
  description?: string;
  model: string;
  systemPrompt: string;
  skills: string[];
  running: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AgentsResponse {
  agents: Agent[];
  count: number;
}

export function useAgents() {
  const { data, error, isLoading, mutate } = useSWR<AgentsResponse>(
    '/api/agents',
    apiFetch,
    { refreshInterval: 5000 }
  );

  return {
    agents: data?.agents,
    count: data?.count,
    isLoading,
    isError: error,
    mutate
  };
}

export function useAgent(id: string) {
  const { data, error, isLoading, mutate } = useSWR<{ agent: Agent }>(
    id ? `/api/agents/${id}` : null,
    apiFetch
  );

  return {
    agent: data?.agent,
    isLoading,
    isError: error,
    mutate
  };
}

export async function createAgent(config: Partial<Agent>) {
  return apiFetch<{ agent: Agent }>('/api/agents', {
    method: 'POST',
    body: JSON.stringify(config)
  });
}

export async function updateAgent(id: string, updates: Partial<Agent>) {
  return apiFetch<{ agent: Agent }>(`/api/agents/${id}`, {
    method: 'PUT',
    body: JSON.stringify(updates)
  });
}

export async function deleteAgent(id: string) {
  return apiFetch<{ deleted: boolean }>(`/api/agents/${id}`, {
    method: 'DELETE'
  });
}

export async function sendMessage(agentId: string, content: string) {
  return apiFetch<{ response: string }>(`/api/agents/${agentId}/message`, {
    method: 'POST',
    body: JSON.stringify({ content })
  });
}

export async function spawnSubAgent(parentId: string, config: Partial<Agent>) {
  return apiFetch<{ subAgent: any }>(`/api/agents/${parentId}/spawn`, {
    method: 'POST',
    body: JSON.stringify(config)
  });
}
