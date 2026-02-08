import axios, { AxiosInstance } from 'axios';

export class TypefullyAPI {
  private client: AxiosInstance;

  constructor() {
    const apiKey = process.env.TYPEFULLY;
    if (!apiKey) {
      throw new Error('TYPEFULLY environment variable is required');
    }

    this.client = axios.create({
      baseURL: 'https://api.typefully.com/v1',
      headers: {
        'X-API-KEY': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async createDraft(options: {
    content: string;
    threadify?: boolean;
    scheduleDate?: string; // ISO date or 'next-free-slot'
    autoRetweet?: boolean;
    autoPlug?: boolean;
  }): Promise<any> {
    const payload: any = {
      content: options.content,
      threadify: options.threadify || false
    };

    if (options.scheduleDate) {
      payload['schedule-date'] = options.scheduleDate;
    }
    if (options.autoRetweet !== undefined) {
      payload['auto-retweet-enabled'] = options.autoRetweet;
    }
    if (options.autoPlug !== undefined) {
      payload['auto-plug-enabled'] = options.autoPlug;
    }

    const response = await this.client.post('/drafts/', payload);
    return response.data;
  }

  async listDrafts(): Promise<any[]> {
    const response = await this.client.get('/drafts/');
    return response.data;
  }

  async getRecentlyPublished(): Promise<any[]> {
    const response = await this.client.get('/drafts/recently-published');
    return response.data;
  }

  async getScheduledDrafts(): Promise<any[]> {
    const response = await this.client.get('/drafts/scheduled');
    return response.data;
  }
}
