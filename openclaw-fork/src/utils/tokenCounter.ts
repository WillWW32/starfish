/**
 * Token estimation utility.
 * Uses a character-based heuristic (avg 4 chars per token for English).
 * No external deps — accurate enough for context budget decisions.
 */

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateMessagesTokens(messages: { role: string; content: string }[]): number {
  let total = 0;
  for (const msg of messages) {
    total += estimateTokens(msg.content) + 4; // overhead per message (role, formatting)
  }
  return total;
}

export function estimateToolsTokens(tools: { name: string; description: string; parameters: any }[]): number {
  let total = 0;
  for (const tool of tools) {
    total += estimateTokens(tool.name + tool.description + JSON.stringify(tool.parameters));
  }
  return total;
}

export interface ContextBudget {
  systemTokens: number;
  historyTokens: number;
  toolTokens: number;
  knowledgeTokens: number;
  total: number;
  limit: number;
  remaining: number;
  shouldSummarize: boolean;
}

/**
 * Estimate full context usage and determine if summarization is needed.
 * Default limit: 180K tokens (leaves 20K buffer for response in 200K window)
 */
export function estimateContextBudget(
  systemPrompt: string,
  history: { role: string; content: string }[],
  tools: { name: string; description: string; parameters: any }[],
  knowledgeContent: string = '',
  limit: number = 180000
): ContextBudget {
  const systemTokens = estimateTokens(systemPrompt);
  const historyTokens = estimateMessagesTokens(history);
  const toolTokens = estimateToolsTokens(tools);
  const knowledgeTokens = estimateTokens(knowledgeContent);
  const total = systemTokens + historyTokens + toolTokens + knowledgeTokens;

  return {
    systemTokens,
    historyTokens,
    toolTokens,
    knowledgeTokens,
    total,
    limit,
    remaining: limit - total,
    shouldSummarize: historyTokens > limit * 0.5 // summarize when history is >50% of budget
  };
}
