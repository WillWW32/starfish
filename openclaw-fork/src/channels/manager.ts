import { ChannelConfig } from '../types.js';
import { Agent } from '../agents/agent.js';
import { BlueBubblesAdapter } from './adapters/bluebubbles.js';
import { ApiAdapter } from './adapters/api.js';

export interface ChannelAdapter {
  name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  sendMessage(to: string, content: string): Promise<void>;
  onMessage(handler: (from: string, content: string, metadata?: any) => Promise<string>): void;
}

export class ChannelManager {
  private adapters: Map<string, ChannelAdapter> = new Map();
  private agentBindings: Map<string, Agent> = new Map();

  async initialize(channels: Record<string, ChannelConfig>): Promise<void> {
    for (const [name, config] of Object.entries(channels)) {
      if (!config.enabled) continue;

      let adapter: ChannelAdapter;

      switch (config.type) {
        case 'bluebubbles':
        case 'imessage':
          adapter = new BlueBubblesAdapter(name, config);
          break;

        case 'api':
        default:
          adapter = new ApiAdapter(name, config);
          break;
      }

      // Set up message handling
      adapter.onMessage(async (from, content, metadata) => {
        const agent = this.agentBindings.get(name);
        if (agent) {
          const response = await agent.processMessage({
            agentId: agent.config.id,
            channel: name,
            role: 'user',
            content,
            metadata: { from, ...metadata }
          });
          return response.content;
        }
        return 'No agent configured for this channel.';
      });

      await adapter.connect();
      this.adapters.set(name, adapter);
      console.log(`  📡 Connected channel: ${name} (${config.type})`);
    }
  }

  registerAgent(channelName: string, agent: Agent): void {
    this.agentBindings.set(channelName, agent);
  }

  unregisterAgent(channelName: string): void {
    this.agentBindings.delete(channelName);
  }

  getAdapter(channelName: string): ChannelAdapter | undefined {
    return this.adapters.get(channelName);
  }

  async sendMessage(channelName: string, to: string, content: string): Promise<void> {
    const adapter = this.adapters.get(channelName);
    if (!adapter) {
      throw new Error(`Channel ${channelName} not found`);
    }
    await adapter.sendMessage(to, content);
  }

  async disconnectAll(): Promise<void> {
    for (const adapter of this.adapters.values()) {
      await adapter.disconnect();
    }
    this.adapters.clear();
  }

  count(): number {
    return this.adapters.size;
  }
}
