import { ChannelConfig } from '../../types.js';
import { ChannelAdapter } from '../manager.js';

// Simple API adapter for direct HTTP access
// Messages are received via the management API
export class ApiAdapter implements ChannelAdapter {
  name: string;
  private config: ChannelConfig;
  private messageHandler?: (from: string, content: string, metadata: any) => Promise<string>;
  private pendingResponses: Map<string, { resolve: (value: string) => void }> = new Map();

  constructor(name: string, config: ChannelConfig) {
    this.name = name;
    this.config = config;
  }

  async connect(): Promise<void> {
    // API channel doesn't need to connect to anything
    console.log(`    API channel ready: ${this.name}`);
  }

  async disconnect(): Promise<void> {
    // Nothing to disconnect
  }

  async sendMessage(to: string, content: string): Promise<void> {
    // For API channel, "sending" means resolving a pending response
    const pending = this.pendingResponses.get(to);
    if (pending) {
      pending.resolve(content);
      this.pendingResponses.delete(to);
    }
  }

  // Called by the API server when a message comes in
  async receiveMessage(from: string, content: string, requestId: string): Promise<string> {
    if (!this.messageHandler) {
      return 'No agent configured for this channel.';
    }

    const handler = this.messageHandler;
    return new Promise(async (resolve) => {
      // Store the resolver so sendMessage can complete it
      this.pendingResponses.set(requestId, { resolve });

      try {
        const response = await handler(from, content, { requestId });
        resolve(response);
      } catch (err) {
        resolve(`Error: ${err}`);
      } finally {
        this.pendingResponses.delete(requestId);
      }
    });
  }

  onMessage(handler: (from: string, content: string, metadata: any) => Promise<string>): void {
    this.messageHandler = handler;
  }
}
