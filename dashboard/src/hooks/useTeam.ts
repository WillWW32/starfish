import useSWR from 'swr';
import { apiFetch } from '@/lib/utils';

interface TeamAgent {
  id: string;
  name: string;
  description?: string;
  model: string;
  skills: string[];
  running: boolean;
  parentId?: string;
  subAgents?: TeamAgent[];
  metadata?: {
    role?: string;
    lastActivity?: string;
    messagesProcessed?: number;
  };
}

interface TeamResponse {
  agents: TeamAgent[];
  count: number;
}

export function useTeam() {
  const { data, error, isLoading, mutate } = useSWR<TeamResponse>(
    '/api/agents/team-status',
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
