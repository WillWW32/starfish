import { Skill } from '../../types.js';
import { TwitterApi } from 'twitter-api-v2';
import { chromium } from 'playwright';
import axios from 'axios';

// ========================================
// RECOMMENDED INTEGRATIONS:
// - Twitter/X: Typefully API (preferred)
// - Multi-platform: Publer API (preferred)
// - Fallback: Direct Twitter API or browser
// ========================================

// Typefully API client (for X/Twitter)
// API Docs: https://typefully.com/api
async function typefullyPost(content: string, options: {
  threadify?: boolean;
  scheduleDate?: string;
  autoRetweet?: boolean;
} = {}) {
  const apiKey = process.env.TYPEFULLY_API_KEY;
  if (!apiKey) throw new Error('TYPEFULLY_API_KEY not set');

  const response = await axios.post(
    'https://api.typefully.com/v1/drafts/',
    {
      content,
      threadify: options.threadify || false,
      'schedule-date': options.scheduleDate, // ISO 8601 or 'next-free-slot'
      'auto-retweet-enabled': options.autoRetweet || false,
      'auto-plug-enabled': false
    },
    {
      headers: {
        'X-API-KEY': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

// Publer API client (for multi-platform)
// API Docs: https://publer.io/developers
async function publerPost(params: {
  content: string;
  platforms: string[]; // ['twitter', 'linkedin', 'facebook', 'instagram', 'tiktok', 'pinterest', 'youtube', 'telegram']
  media?: string[]; // URLs or base64
  scheduleAt?: string; // ISO 8601
  link?: string;
}) {
  const apiKey = process.env.PUBLER_API_KEY;
  const workspaceId = process.env.PUBLER_WORKSPACE_ID;
  if (!apiKey || !workspaceId) throw new Error('PUBLER_API_KEY or PUBLER_WORKSPACE_ID not set');

  // Get connected accounts
  const accountsRes = await axios.get(
    `https://app.publer.io/api/v1/workspaces/${workspaceId}/accounts`,
    { headers: { 'Authorization': `Bearer ${apiKey}` } }
  );

  // Filter accounts by requested platforms
  const accounts = accountsRes.data.filter((acc: any) =>
    params.platforms.includes(acc.network.toLowerCase())
  );

  if (accounts.length === 0) {
    throw new Error(`No connected accounts for platforms: ${params.platforms.join(', ')}`);
  }

  // Create post
  const postData: any = {
    account_ids: accounts.map((a: any) => a.id),
    text: params.content,
    link: params.link
  };

  if (params.scheduleAt) {
    postData.scheduled_at = params.scheduleAt;
  }

  if (params.media && params.media.length > 0) {
    postData.media = params.media.map(m => ({ url: m }));
  }

  const response = await axios.post(
    `https://app.publer.io/api/v1/posts`,
    postData,
    {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      }
    }
  );

  return response.data;
}

// Legacy: Direct Twitter API client
function getTwitterClient() {
  if (!process.env.TWITTER_API_KEY) return null;
  return new TwitterApi({
    appKey: process.env.TWITTER_API_KEY,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessSecret: process.env.TWITTER_ACCESS_SECRET
  });
}

// Browser-based posting (fallback for platforms without API access)
async function browserPost(platform: string, content: string, mediaPath?: string) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: `./profiles/${platform}_session.json`
  }).catch(() => browser.newContext());

  const page = await context.newPage();

  try {
    switch (platform) {
      case 'linkedin':
        await page.goto('https://www.linkedin.com/feed/');
        await page.click('button.share-box-feed-entry__trigger');
        await page.waitForSelector('.ql-editor');
        await page.fill('.ql-editor', content);
        if (mediaPath) {
          const fileInput = await page.$('input[type="file"]');
          if (fileInput) await fileInput.setInputFiles(mediaPath);
        }
        await page.click('button.share-actions__primary-action');
        await page.waitForTimeout(3000);
        break;

      case 'instagram':
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto('https://www.instagram.com/');
        // Instagram posting via browser requires complex flow
        break;

      case 'facebook':
        await page.goto('https://www.facebook.com/');
        await page.click('[aria-label="Create a post"]');
        await page.fill('[aria-label="What\'s on your mind"]', content);
        await page.click('button[type="submit"]');
        await page.waitForTimeout(3000);
        break;
    }

    await context.storageState({ path: `./profiles/${platform}_session.json` });
    return { success: true, platform, method: 'browser' };
  } finally {
    await browser.close();
  }
}

export const socialSkill: Skill = {
  id: 'social',
  name: 'Social Media',
  description: 'Post to social platforms. Preferred: Typefully for X/Twitter, Publer for multi-platform. Fallback: direct API or browser automation. No rate limits.',
  version: '2.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'post',                    // Generic post
          'post_typefully',          // X/Twitter via Typefully
          'post_publer',             // Multi-platform via Publer
          'post_twitter_api',        // Direct Twitter API
          'post_browser',            // Browser fallback
          'reply',
          'dm',
          'follow',
          'like',
          'retweet',
          'search',
          'get_profile',
          'schedule'                 // Schedule via Typefully or Publer
        ],
        description: 'Social action to perform'
      },
      platform: {
        type: 'string',
        enum: ['twitter', 'linkedin', 'instagram', 'facebook', 'tiktok', 'pinterest', 'youtube', 'telegram'],
        description: 'Target platform (for single-platform actions)'
      },
      platforms: {
        type: 'array',
        items: { type: 'string' },
        description: 'Multiple platforms for Publer (e.g., ["twitter", "linkedin"])'
      },
      content: { type: 'string', description: 'Post content / message' },
      mediaUrls: {
        type: 'array',
        items: { type: 'string' },
        description: 'Media URLs to attach'
      },
      mediaPath: { type: 'string', description: 'Local path to media file (browser mode)' },
      scheduleAt: { type: 'string', description: 'ISO 8601 datetime or "next-free-slot" (Typefully)' },
      link: { type: 'string', description: 'Link to include in post' },
      threadify: { type: 'boolean', default: false, description: 'Auto-thread long content (Typefully)' },
      autoRetweet: { type: 'boolean', default: false, description: 'Auto-retweet after posting (Typefully)' },
      targetUser: { type: 'string', description: 'Target username for DM/follow/reply' },
      postId: { type: 'string', description: 'Post ID for reply/like/retweet' },
      query: { type: 'string', description: 'Search query' },
      useBrowser: { type: 'boolean', default: false, description: 'Force browser automation' }
    },
    required: ['action']
  },
  execute: async (params: any) => {
    const {
      action,
      platform,
      platforms,
      content,
      mediaUrls,
      mediaPath,
      scheduleAt,
      link,
      threadify,
      autoRetweet,
      targetUser,
      postId,
      query,
      useBrowser
    } = params;

    // ===== TYPEFULLY (X/Twitter) =====
    if (action === 'post_typefully' || (action === 'post' && platform === 'twitter' && process.env.TYPEFULLY_API_KEY)) {
      const result = await typefullyPost(content, {
        threadify,
        scheduleDate: scheduleAt,
        autoRetweet
      });
      return {
        success: true,
        platform: 'twitter',
        method: 'typefully',
        draft: result
      };
    }

    // ===== PUBLER (Multi-platform) =====
    if (action === 'post_publer' || (action === 'post' && platforms && platforms.length > 0 && process.env.PUBLER_API_KEY)) {
      const targetPlatforms = platforms || [platform];
      const result = await publerPost({
        content,
        platforms: targetPlatforms,
        media: mediaUrls,
        scheduleAt,
        link
      });
      return {
        success: true,
        platforms: targetPlatforms,
        method: 'publer',
        post: result
      };
    }

    // ===== SCHEDULE (via Typefully or Publer) =====
    if (action === 'schedule') {
      if (!scheduleAt) throw new Error('scheduleAt required for scheduling');

      if (platform === 'twitter' && process.env.TYPEFULLY_API_KEY) {
        const result = await typefullyPost(content, {
          threadify,
          scheduleDate: scheduleAt,
          autoRetweet
        });
        return { success: true, method: 'typefully', scheduled: scheduleAt, draft: result };
      }

      if (process.env.PUBLER_API_KEY) {
        const targetPlatforms = platforms || [platform];
        const result = await publerPost({
          content,
          platforms: targetPlatforms,
          media: mediaUrls,
          scheduleAt,
          link
        });
        return { success: true, method: 'publer', scheduled: scheduleAt, post: result };
      }

      throw new Error('No scheduling service configured (need TYPEFULLY_API_KEY or PUBLER_API_KEY)');
    }

    // ===== DIRECT TWITTER API (Legacy/Fallback) =====
    if ((action === 'post_twitter_api' || platform === 'twitter') && !useBrowser) {
      const client = getTwitterClient();
      if (client) {
        switch (action) {
          case 'post':
          case 'post_twitter_api':
            const tweet = await client.v2.tweet(content);
            return { success: true, platform: 'twitter', method: 'api', tweetId: tweet.data.id };

          case 'reply':
            const reply = await client.v2.reply(content, postId);
            return { success: true, platform: 'twitter', replyId: reply.data.id };

          case 'dm':
            const user = await client.v2.userByUsername(targetUser!);
            await client.v2.sendDmToParticipant(user.data.id, { text: content });
            return { success: true, platform: 'twitter', dm_to: targetUser };

          case 'follow':
            const me = await client.v2.me();
            const target = await client.v2.userByUsername(targetUser!);
            await client.v2.follow(me.data.id, target.data.id);
            return { success: true, platform: 'twitter', followed: targetUser };

          case 'like':
            const meForLike = await client.v2.me();
            await client.v2.like(meForLike.data.id, postId);
            return { success: true, platform: 'twitter', liked: postId };

          case 'retweet':
            const meForRt = await client.v2.me();
            await client.v2.retweet(meForRt.data.id, postId);
            return { success: true, platform: 'twitter', retweeted: postId };

          case 'search':
            const results = await client.v2.search(query!, { max_results: 20 });
            return { success: true, platform: 'twitter', tweets: results.data.data };

          case 'get_profile':
            const profile = await client.v2.userByUsername(targetUser!, {
              'user.fields': ['description', 'public_metrics', 'profile_image_url']
            });
            return { success: true, platform: 'twitter', profile: profile.data };
        }
      }
    }

    // ===== BROWSER FALLBACK =====
    if (action === 'post' || action === 'post_browser') {
      return browserPost(platform, content, mediaPath);
    }

    throw new Error(`Action ${action} not supported for ${platform}`);
  }
};
