import { ChannelConfig } from '../../types.js';
import { ChannelAdapter } from '../manager.js';
import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';

interface BlueBubblesMessage {
  guid: string;
  text: string;
  handle: {
    address: string;
  };
  isFromMe: boolean;
  dateCreated: number;
  chats: Array<{ guid: string }>;
}

export class BlueBubblesAdapter implements ChannelAdapter {
  name: string;
  private config: ChannelConfig;
  private client: AxiosInstance;
  private ws?: WebSocket;
  private messageHandler?: (from: string, content: string, metadata?: any) => Promise<string>;
  private processedMessages: Set<string> = new Set();

  constructor(name: string, config: ChannelConfig) {
    this.name = name;
    this.config = config;

    this.client = axios.create({
      baseURL: config.url,
      headers: {
        'Authorization': `Bearer ${config.token}`
      }
    });
  }

  async connect(): Promise<void> {
    // Test connection
    try {
      const response = await this.client.get('/api/v1/server/info');
      console.log(`    BlueBubbles server: ${response.data.data.server_version}`);
    } catch (err) {
      console.error(`    Failed to connect to BlueBubbles: ${err}`);
      throw err;
    }

    // Set up WebSocket for real-time messages
    const wsUrl = this.config.url!.replace('http', 'ws') + '/socket.io/?EIO=4&transport=websocket';

    this.ws = new WebSocket(wsUrl);

    this.ws.on('open', () => {
      console.log(`    WebSocket connected to BlueBubbles`);
      // Send auth
      this.ws!.send(`40{"password":"${this.config.token}"}`);
    });

    this.ws.on('message', async (data: Buffer) => {
      const message = data.toString();

      // Socket.io message format: digit + JSON
      if (message.startsWith('42')) {
        try {
          const payload = JSON.parse(message.slice(2));
          const [event, eventData] = payload;

          if (event === 'new-message' && eventData && !eventData.isFromMe) {
            await this.handleIncomingMessage(eventData);
          }
        } catch (err) {
          // Ignore parse errors
        }
      }
    });

    this.ws.on('error', (err) => {
      console.error(`    BlueBubbles WebSocket error: ${err}`);
    });

    this.ws.on('close', () => {
      console.log(`    BlueBubbles WebSocket closed, reconnecting...`);
      setTimeout(() => this.connect(), 5000);
    });

    // Fallback: Poll for messages
    this.startPolling();
  }

  private async startPolling(): Promise<void> {
    setInterval(async () => {
      try {
        const response = await this.client.get('/api/v1/message', {
          params: {
            limit: 10,
            sort: 'desc',
            with: ['handle', 'chat']
          }
        });

        const messages: BlueBubblesMessage[] = response.data.data || [];

        for (const msg of messages) {
          if (!msg.isFromMe && !this.processedMessages.has(msg.guid)) {
            this.processedMessages.add(msg.guid);
            await this.handleIncomingMessage(msg);
          }
        }

        // Keep set from growing too large
        if (this.processedMessages.size > 1000) {
          const arr = Array.from(this.processedMessages);
          this.processedMessages = new Set(arr.slice(-500));
        }
      } catch (err) {
        // Ignore polling errors
      }
    }, 5000);
  }

  private async handleIncomingMessage(msg: BlueBubblesMessage): Promise<void> {
    if (!this.messageHandler) return;

    const from = msg.handle?.address || 'unknown';
    const content = msg.text || '';
    const chatGuid = msg.chats?.[0]?.guid;

    if (!content.trim()) return;

    console.log(`📨 iMessage from ${from}: ${content.substring(0, 50)}...`);

    try {
      const response = await this.messageHandler(from, content, {
        messageId: msg.guid,
        chatGuid,
        timestamp: msg.dateCreated
      });

      // Send reply
      await this.sendMessage(chatGuid || from, response);
    } catch (err) {
      console.error(`Failed to process message: ${err}`);
    }
  }

  async disconnect(): Promise<void> {
    if (this.ws) {
      this.ws.close();
    }
  }

  async sendMessage(to: string, content: string): Promise<void> {
    try {
      // Determine if 'to' is a chat GUID or phone number
      const isChatGuid = to.includes(';');

      if (isChatGuid) {
        // Send to existing chat
        await this.client.post('/api/v1/message/text', {
          chatGuid: to,
          message: content
        });
      } else {
        // Send to phone number
        await this.client.post('/api/v1/message/text', {
          address: to,
          message: content
        });
      }

      console.log(`📤 iMessage sent to ${to.substring(0, 20)}...`);
    } catch (err: any) {
      console.error(`Failed to send iMessage: ${err.response?.data || err.message}`);
      throw err;
    }
  }

  onMessage(handler: (from: string, content: string, metadata?: any) => Promise<string>): void {
    this.messageHandler = handler;
  }
}
