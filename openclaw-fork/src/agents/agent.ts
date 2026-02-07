import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { AgentConfig, Message, ToolDefinition, ExecutionContext } from '../types.js';
import { MemoryStore } from '../memory/store.js';
import { estimateContextBudget, estimateTokens } from '../utils/tokenCounter.js';
import { v4 as uuid } from 'uuid';

export class Agent {
  config: AgentConfig;
  private memory: MemoryStore;
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private running: boolean = false;
  private tools: Map<string, (params: any) => Promise<any>> = new Map();
  private toolDefinitions: ToolDefinition[] = [];
  private knowledgeContent: string = ''; // injected by KnowledgeManager

  constructor(config: AgentConfig) {
    this.config = config;
    this.memory = new MemoryStore(config.memory || { type: 'sqlite' }, config.id);

    // Initialize LLM client based on model
    if (config.model.startsWith('claude')) {
      this.anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    } else if (config.model.startsWith('gpt')) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    }
  }

  async initialize(): Promise<void> {
    await this.memory.initialize();
    this.running = true;
  }

  isRunning(): boolean {
    return this.running;
  }

  /**
   * Register a tool the agent can use
   */
  registerTool(definition: ToolDefinition, handler: (params: any) => Promise<any>): void {
    this.toolDefinitions.push(definition);
    this.tools.set(definition.name, handler);
  }

  /**
   * Set knowledge content to inject into system prompt
   */
  setKnowledge(content: string): void {
    this.knowledgeContent = content;
  }

  /**
   * Build system prompt with optional knowledge injection
   */
  private buildSystemPrompt(): string {
    if (!this.knowledgeContent) return this.config.systemPrompt;
    return `${this.config.systemPrompt}\n\n## KNOWLEDGE BASE\n${this.knowledgeContent}`;
  }

  /**
   * Auto-summarize if history is too large, using Claude to compress
   */
  private async maybeSummarize(history: Message[]): Promise<void> {
    const messageCount = await this.memory.getMessageCount();
    const threshold = this.config.memory?.summarizeAfter || 100;

    if (messageCount <= threshold) return;

    // Only summarize if we have Claude available
    if (!this.anthropic) return;

    try {
      const oldMessages = history.slice(0, Math.floor(history.length * 0.6));
      const conversationText = oldMessages
        .map(m => `${m.role}: ${m.content.substring(0, 500)}`)
        .join('\n');

      const summaryResponse = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1000,
        system: 'Summarize this conversation into key facts, decisions, and action items. Be extremely concise. Max 500 words.',
        messages: [{ role: 'user', content: conversationText }]
      });

      const summaryText = summaryResponse.content.find((b: any) => b.type === 'text');
      if (summaryText) {
        await this.memory.storeSummary((summaryText as any).text, oldMessages.length);
        await this.memory.archiveOldMessages(40); // keep last 40 messages
        console.log(`  📝 ${this.config.name}: Summarized ${oldMessages.length} messages, kept 40 recent`);
      }
    } catch (err: any) {
      console.warn(`  ⚠️ ${this.config.name}: Summarization failed: ${err.message}`);
    }
  }

  /**
   * Process an incoming message and return a response
   */
  async processMessage(message: Omit<Message, 'id' | 'timestamp'>): Promise<Message> {
    // Store incoming message
    const incomingMsg: Message = {
      ...message,
      id: uuid(),
      timestamp: new Date().toISOString()
    };
    await this.memory.addMessage(incomingMsg);

    // Get conversation history
    const historyLimit = this.config.memory?.summarizeAfter || 100;
    const history = await this.memory.getMessages(historyLimit);

    // Auto-summarize if history is getting large
    await this.maybeSummarize(history);

    // Re-fetch after potential summarization
    const currentHistory = await this.memory.getMessages(historyLimit);

    // Generate response via LLM
    let responseContent: string;

    if (this.anthropic && this.config.model.startsWith('claude')) {
      responseContent = await this.callClaude(currentHistory);
    } else if (this.openai) {
      responseContent = await this.callOpenAI(currentHistory);
    } else {
      responseContent = 'No LLM configured for this agent.';
    }

    // Store and return response
    const responseMsg: Message = {
      id: uuid(),
      agentId: this.config.id,
      channel: message.channel,
      role: 'assistant',
      content: responseContent,
      metadata: {},
      timestamp: new Date().toISOString()
    };
    await this.memory.addMessage(responseMsg);

    return responseMsg;
  }

  private async callClaude(history: Message[]): Promise<string> {
    // Build system prompt with knowledge
    const systemPrompt = this.buildSystemPrompt();

    // Prepend conversation summary if available
    const summary = await this.memory.getLatestSummary();
    const messages: { role: 'user' | 'assistant'; content: any }[] = [];

    if (summary) {
      messages.push({
        role: 'user',
        content: `[Previous conversation summary: ${summary}]`
      });
      messages.push({
        role: 'assistant',
        content: 'Understood. I have context from our previous conversation. How can I help?'
      });
    }

    // Add current history
    messages.push(
      ...history
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    );

    // Build tools for Claude
    const tools = this.toolDefinitions.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters as any
    }));

    // Log context budget (debug)
    const budget = estimateContextBudget(
      systemPrompt,
      messages,
      tools,
      this.knowledgeContent
    );
    if (budget.total > 100000) {
      console.warn(`  ⚠️ ${this.config.name}: High context usage: ${Math.round(budget.total / 1000)}K tokens`);
    }

    let response = await this.anthropic!.messages.create({
      model: this.config.model,
      max_tokens: this.config.maxTokens,
      temperature: this.config.temperature,
      system: systemPrompt,
      messages,
      ...(tools.length > 0 ? { tools } : {})
    });

    // Tool loop — keep calling tools until we get a text response
    while (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter((b: any) => b.type === 'tool_use');
      const toolResults: any[] = [];

      for (const block of toolUseBlocks) {
        const toolUse = block as any;
        const handler = this.tools.get(toolUse.name);
        let result: any;

        if (handler) {
          try {
            result = await handler(toolUse.input);
          } catch (err: any) {
            result = { error: err.message };
          }
        } else {
          result = { error: `Unknown tool: ${toolUse.name}` };
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: typeof result === 'string' ? result : JSON.stringify(result)
        });
      }

      // Continue conversation with tool results
      messages.push({ role: 'assistant', content: response.content as any });
      messages.push({ role: 'user', content: toolResults as any });

      response = await this.anthropic!.messages.create({
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        system: systemPrompt,
        messages,
        ...(tools.length > 0 ? { tools } : {})
      });
    }

    // Extract text from response
    const textBlock = response.content.find((b: any) => b.type === 'text');
    return textBlock ? (textBlock as any).text : '';
  }

  private async callOpenAI(history: Message[]): Promise<string> {
    const messages: any[] = [
      { role: 'system', content: this.config.systemPrompt },
      ...history
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({ role: m.role, content: m.content }))
    ];

    const tools = this.toolDefinitions.length > 0
      ? this.toolDefinitions.map(t => ({
          type: 'function' as const,
          function: { name: t.name, description: t.description, parameters: t.parameters }
        }))
      : undefined;

    let response = await this.openai!.chat.completions.create({
      model: this.config.model,
      messages,
      temperature: this.config.temperature,
      max_tokens: this.config.maxTokens,
      ...(tools ? { tools } : {})
    });

    let choice = response.choices[0];

    // Tool loop
    while (choice.message.tool_calls && choice.message.tool_calls.length > 0) {
      messages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        const handler = this.tools.get(toolCall.function.name);
        let result: any;

        if (handler) {
          try {
            const args = JSON.parse(toolCall.function.arguments);
            result = await handler(args);
          } catch (err: any) {
            result = { error: err.message };
          }
        } else {
          result = { error: `Unknown tool: ${toolCall.function.name}` };
        }

        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: typeof result === 'string' ? result : JSON.stringify(result)
        });
      }

      response = await this.openai!.chat.completions.create({
        model: this.config.model,
        messages,
        temperature: this.config.temperature,
        max_tokens: this.config.maxTokens,
        ...(tools ? { tools } : {})
      });
      choice = response.choices[0];
    }

    return choice.message.content || '';
  }

  async stop(): Promise<void> {
    this.running = false;
    await this.memory.close();
  }
}
