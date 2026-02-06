import { Skill } from '../../types.js';
import { TypefullyAPI } from '../../integrations/typefully-api.js';

let api: TypefullyAPI | null = null;

function getApi(): TypefullyAPI {
  if (!api) api = new TypefullyAPI();
  return api;
}

export const typefullySkill: Skill = {
  id: 'typefully',
  name: 'Typefully',
  description: 'Create, schedule, and publish tweets and threads via Typefully. Supports auto-threading, scheduling, and draft management.',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create_draft', 'schedule_post', 'list_drafts', 'list_scheduled', 'list_published'],
        description: 'The action to perform'
      },
      content: {
        type: 'string',
        description: 'Tweet or thread content. Use \\n\\n\\n\\n (4 newlines) to separate thread tweets.'
      },
      threadify: {
        type: 'boolean',
        description: 'Auto-split long content into a thread (default: false)'
      },
      schedule_date: {
        type: 'string',
        description: 'ISO date string for scheduling, or "next-free-slot" to use the next available slot'
      },
      auto_retweet: {
        type: 'boolean',
        description: 'Enable auto-retweet after publishing'
      }
    },
    required: ['action']
  },
  execute: async (params: any) => {
    const typefully = getApi();

    switch (params.action) {
      case 'create_draft': {
        if (!params.content) return { error: 'content is required' };
        const draft = await typefully.createDraft({
          content: params.content,
          threadify: params.threadify || false,
          autoRetweet: params.auto_retweet
        });
        return { draft, message: 'Draft created. Open Typefully to review and publish.' };
      }

      case 'schedule_post': {
        if (!params.content) return { error: 'content is required' };
        const scheduled = await typefully.createDraft({
          content: params.content,
          threadify: params.threadify || false,
          scheduleDate: params.schedule_date || 'next-free-slot',
          autoRetweet: params.auto_retweet
        });
        return { draft: scheduled, message: `Post scheduled for ${params.schedule_date || 'next free slot'}.` };
      }

      case 'list_drafts': {
        const drafts = await typefully.listDrafts();
        return { drafts, count: Array.isArray(drafts) ? drafts.length : 0 };
      }

      case 'list_scheduled': {
        const scheduled = await typefully.getScheduledDrafts();
        return { drafts: scheduled, count: Array.isArray(scheduled) ? scheduled.length : 0 };
      }

      case 'list_published': {
        const published = await typefully.getRecentlyPublished();
        return { drafts: published, count: Array.isArray(published) ? published.length : 0 };
      }

      default:
        return { error: `Unknown action: ${params.action}` };
    }
  }
};
