import { z } from 'zod';

// Agent Configuration Schema
export const AgentConfigSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().optional(),
  model: z.enum(['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101', 'gpt-4o', 'gpt-4o-mini']).default('claude-sonnet-4-5-20250929'),
  systemPrompt: z.string(),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().default(4096),
  skills: z.array(z.string()).default([]),
  channels: z.record(z.string(), ChannelConfigSchema).default({}),
  memory: MemoryConfigSchema.default({}),
  parentAgentId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
  unrestricted: z.boolean().default(true), // No rate limits
  autoStart: z.boolean().default(true),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const ChannelConfigSchema = z.object({
  type: z.enum(['imessage', 'bluebubbles', 'telegram', 'whatsapp', 'slack', 'api']),
  enabled: z.boolean().default(true),
  url: z.string().url().optional(),
  token: z.string().optional(),
  phoneNumber: z.string().optional(),
  webhookSecret: z.string().optional(),
  config: z.record(z.string(), z.any()).default({})
});

export const MemoryConfigSchema = z.object({
  type: z.enum(['sqlite', 'redis', 'memory']).default('sqlite'),
  path: z.string().optional(),
  redisUrl: z.string().optional(),
  maxMessages: z.number().default(1000),
  summarizeAfter: z.number().default(50)
});

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string().default('1.0.0'),
  enabled: z.boolean().default(true),
  parameters: z.record(z.string(), z.any()).default({}),
  execute: z.function().args(z.any()).returns(z.promise(z.any())).optional()
});

export const MessageSchema = z.object({
  id: z.string().uuid(),
  agentId: z.string().uuid(),
  channel: z.string(),
  role: z.enum(['user', 'assistant', 'system', 'tool']),
  content: z.string(),
  toolCalls: z.array(z.any()).optional(),
  metadata: z.record(z.string(), z.any()).default({}),
  timestamp: z.string().datetime()
});

export const SubAgentSchema = z.object({
  id: z.string().uuid(),
  parentId: z.string().uuid(),
  name: z.string(),
  purpose: z.string(),
  config: AgentConfigSchema.partial(),
  status: z.enum(['running', 'stopped', 'error']).default('stopped'),
  pid: z.number().optional()
});

// Marketing/Outbound Types
export const EmailConfigSchema = z.object({
  provider: z.enum(['smtp', 'sendgrid', 'mailgun']),
  apiKey: z.string().optional(),
  smtpHost: z.string().optional(),
  smtpPort: z.number().optional(),
  smtpUser: z.string().optional(),
  smtpPass: z.string().optional(),
  fromEmail: z.string().email(),
  fromName: z.string()
});

export const SocialConfigSchema = z.object({
  platform: z.enum(['twitter', 'linkedin', 'instagram', 'facebook']),
  apiKey: z.string().optional(),
  apiSecret: z.string().optional(),
  accessToken: z.string().optional(),
  accessSecret: z.string().optional(),
  useBrowser: z.boolean().default(false), // Use Playwright instead of API
  browserProfile: z.string().optional()
});

export const OutboundCampaignSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  type: z.enum(['email', 'social', 'multi']),
  status: z.enum(['draft', 'scheduled', 'running', 'paused', 'completed']),
  targets: z.array(z.any()),
  template: z.string(),
  schedule: z.string().optional(), // Cron expression
  noRateLimit: z.boolean().default(true)
});

// Export types
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;
export type Skill = z.infer<typeof SkillSchema>;
export type Message = z.infer<typeof MessageSchema>;
export type SubAgent = z.infer<typeof SubAgentSchema>;
export type EmailConfig = z.infer<typeof EmailConfigSchema>;
export type SocialConfig = z.infer<typeof SocialConfigSchema>;
export type OutboundCampaign = z.infer<typeof OutboundCampaignSchema>;

// Tool Definition for LLM
export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

// Execution Context
export interface ExecutionContext {
  agentId: string;
  channel: string;
  userId?: string;
  sessionId?: string;
  memory: Message[];
  tools: ToolDefinition[];
}
