import useSWR from 'swr';
import { apiFetch } from '@/lib/utils';

interface Skill {
  id: string;
  name: string;
  description: string;
  version: string;
  enabled: boolean;
  parameters: Record<string, any>;
}

interface SkillsResponse {
  skills: Skill[];
  count: number;
}

export function useSkills() {
  const { data, error, isLoading, mutate } = useSWR<SkillsResponse>(
    '/api/skills',
    apiFetch,
    { refreshInterval: 10000 }
  );

  return {
    skills: data?.skills,
    count: data?.count,
    isLoading,
    isError: error,
    mutate
  };
}

export async function toggleSkill(id: string, enabled: boolean) {
  return apiFetch<{ skill: Skill }>(`/api/skills/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled })
  });
}

export async function uploadSkills(files: FileList) {
  const formData = new FormData();
  Array.from(files).forEach((file) => {
    formData.append('files', file);
  });

  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/skills/upload`, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    throw new Error('Upload failed');
  }

  return response.json();
}
