import { Skill } from '../../types.js';
import { chromium, Browser, BrowserContext, Page } from 'playwright';
import fs from 'fs/promises';
import path from 'path';

// Reddit Browser Agent with Anti-Detect/Stealth capabilities
// Uses Playwright with stealth patches for low-detection automation

interface RedditAccount {
  username: string;
  password?: string;
  cookies?: any[];
  fingerprint?: {
    userAgent: string;
    viewport: { width: number; height: number };
    locale: string;
    timezone: string;
  };
  proxy?: {
    server: string;
    username?: string;
    password?: string;
  };
  warmedUp: boolean;
  lastUsed?: string;
}

// Human-like delay ranges (ms)
const DELAYS = {
  typing: { min: 50, max: 150 },      // Per character
  action: { min: 2000, max: 8000 },   // Between actions
  scroll: { min: 500, max: 2000 },    // Scroll pauses
  read: { min: 5000, max: 15000 },    // Reading a post/comments
  pageLoad: { min: 1500, max: 4000 }  // After navigation
};

function randomDelay(range: { min: number; max: number }): number {
  return Math.floor(Math.random() * (range.max - range.min + 1)) + range.min;
}

async function humanDelay(range: { min: number; max: number }): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, randomDelay(range)));
}

// Stealth configuration for Playwright
function getStealthContext(account?: RedditAccount): any {
  const defaultFingerprint = {
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    viewport: { width: 1920, height: 1080 },
    locale: 'en-US',
    timezone: 'America/New_York'
  };

  const fp = account?.fingerprint || defaultFingerprint;

  return {
    userAgent: fp.userAgent,
    viewport: fp.viewport,
    locale: fp.locale,
    timezoneId: fp.timezone,
    geolocation: undefined,
    permissions: [],
    extraHTTPHeaders: {
      'Accept-Language': 'en-US,en;q=0.9'
    },
    // Anti-detection measures
    javaScriptEnabled: true,
    bypassCSP: false,
    ignoreHTTPSErrors: false,
    hasTouch: false,
    isMobile: false,
    deviceScaleFactor: 1,
    // Proxy if specified
    proxy: account?.proxy ? {
      server: account.proxy.server,
      username: account.proxy.username,
      password: account.proxy.password
    } : undefined
  };
}

// Human-like mouse movement simulation
async function humanMouseMove(page: Page, x: number, y: number): Promise<void> {
  const steps = Math.floor(Math.random() * 10) + 5;
  const currentPos = await page.evaluate(() => ({ x: 0, y: 0 }));

  for (let i = 0; i <= steps; i++) {
    const progress = i / steps;
    // Bezier-like curve
    const eased = progress * progress * (3 - 2 * progress);
    const newX = currentPos.x + (x - currentPos.x) * eased;
    const newY = currentPos.y + (y - currentPos.y) * eased;
    await page.mouse.move(newX, newY);
    await new Promise(resolve => setTimeout(resolve, randomDelay({ min: 5, max: 20 })));
  }
}

// Human-like typing
async function humanType(page: Page, selector: string, text: string): Promise<void> {
  await page.click(selector);
  await humanDelay({ min: 200, max: 500 });

  for (const char of text) {
    await page.keyboard.type(char, { delay: randomDelay(DELAYS.typing) });
    // Occasional longer pause (thinking)
    if (Math.random() < 0.05) {
      await humanDelay({ min: 300, max: 800 });
    }
  }
}

// Human-like scrolling
async function humanScroll(page: Page, direction: 'down' | 'up' = 'down'): Promise<void> {
  const scrollAmount = Math.floor(Math.random() * 400) + 200;
  const delta = direction === 'down' ? scrollAmount : -scrollAmount;

  await page.mouse.wheel(0, delta);
  await humanDelay(DELAYS.scroll);
}

// Load/save account state
const ACCOUNTS_PATH = './data/reddit_accounts.json';

async function loadAccounts(): Promise<Record<string, RedditAccount>> {
  try {
    const data = await fs.readFile(ACCOUNTS_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

async function saveAccounts(accounts: Record<string, RedditAccount>): Promise<void> {
  await fs.mkdir(path.dirname(ACCOUNTS_PATH), { recursive: true });
  await fs.writeFile(ACCOUNTS_PATH, JSON.stringify(accounts, null, 2));
}

async function saveAccountCookies(page: Page, username: string): Promise<void> {
  const cookies = await page.context().cookies();
  const accounts = await loadAccounts();
  if (accounts[username]) {
    accounts[username].cookies = cookies;
    accounts[username].lastUsed = new Date().toISOString();
    await saveAccounts(accounts);
  }
}

let browser: Browser | null = null;
let contexts: Map<string, BrowserContext> = new Map();

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: process.env.REDDIT_HEADLESS !== 'false',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-features=IsolateOrigins,site-per-process',
        '--disable-web-security',
        '--disable-features=BlockInsecurePrivateNetworkRequests'
      ]
    });

    // Patch navigator.webdriver detection
    browser.on('disconnected', () => {
      browser = null;
      contexts.clear();
    });
  }
  return browser;
}

async function getContext(accountName: string): Promise<BrowserContext> {
  if (contexts.has(accountName)) {
    return contexts.get(accountName)!;
  }

  const b = await getBrowser();
  const accounts = await loadAccounts();
  const account = accounts[accountName];

  const contextOptions = getStealthContext(account);

  const context = await b.newContext(contextOptions);

  // Apply stealth patches
  await context.addInitScript(() => {
    // Override webdriver detection
    Object.defineProperty(navigator, 'webdriver', { get: () => false });

    // Override plugins
    Object.defineProperty(navigator, 'plugins', {
      get: () => [1, 2, 3, 4, 5]
    });

    // Override languages
    Object.defineProperty(navigator, 'languages', {
      get: () => ['en-US', 'en']
    });

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters: any) =>
      parameters.name === 'notifications'
        ? Promise.resolve({ state: 'denied' } as PermissionStatus)
        : originalQuery(parameters);

    // Chrome specific
    (window as any).chrome = { runtime: {} };
  });

  // Restore cookies if available
  if (account?.cookies) {
    await context.addCookies(account.cookies);
  }

  contexts.set(accountName, context);
  return context;
}

export const redditSkill: Skill = {
  id: 'reddit',
  name: 'Reddit Browser Agent',
  description: 'Browse Reddit, read posts/comments, search subreddits, and post/comment with stealth anti-detection. Requires warmed accounts for best results.',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: [
          'browse_subreddit',
          'read_post',
          'search',
          'comment',
          'post',
          'upvote',
          'login',
          'check_status',
          'add_account',
          'list_accounts'
        ],
        description: 'Reddit action to perform'
      },
      account: { type: 'string', description: 'Account name to use' },
      subreddit: { type: 'string', description: 'Subreddit name (without r/)' },
      postUrl: { type: 'string', description: 'Full Reddit post URL' },
      postId: { type: 'string', description: 'Reddit post ID' },
      query: { type: 'string', description: 'Search query' },
      content: { type: 'string', description: 'Comment or post content' },
      title: { type: 'string', description: 'Post title (for new posts)' },
      sort: {
        type: 'string',
        enum: ['hot', 'new', 'top', 'rising'],
        default: 'hot'
      },
      limit: { type: 'number', default: 10, description: 'Number of items to fetch' },
      // Account setup
      username: { type: 'string' },
      password: { type: 'string' },
      proxy: {
        type: 'object',
        properties: {
          server: { type: 'string' },
          username: { type: 'string' },
          password: { type: 'string' }
        }
      },
      fingerprint: {
        type: 'object',
        properties: {
          userAgent: { type: 'string' },
          viewport: { type: 'object' },
          locale: { type: 'string' },
          timezone: { type: 'string' }
        }
      }
    },
    required: ['action']
  },
  execute: async (params: any) => {
    const { action, account = 'default', subreddit, postUrl, query, content, title, sort = 'hot', limit = 10 } = params;

    switch (action) {
      case 'add_account': {
        const accounts = await loadAccounts();
        accounts[params.username] = {
          username: params.username,
          password: params.password,
          proxy: params.proxy,
          fingerprint: params.fingerprint,
          warmedUp: false
        };
        await saveAccounts(accounts);
        return { success: true, message: `Account ${params.username} added. Remember to warm up before heavy use.` };
      }

      case 'list_accounts': {
        const accounts = await loadAccounts();
        return {
          success: true,
          accounts: Object.entries(accounts).map(([name, acc]) => ({
            name,
            warmedUp: acc.warmedUp,
            lastUsed: acc.lastUsed,
            hasProxy: !!acc.proxy
          }))
        };
      }

      case 'login': {
        const accounts = await loadAccounts();
        const acc = accounts[account];
        if (!acc) throw new Error(`Account ${account} not found. Add it first.`);

        const context = await getContext(account);
        const page = await context.newPage();

        try {
          await page.goto('https://www.reddit.com/login', { waitUntil: 'domcontentloaded' });
          await humanDelay(DELAYS.pageLoad);

          // Human-like login flow
          await humanType(page, '#loginUsername', acc.username);
          await humanDelay(DELAYS.action);
          await humanType(page, '#loginPassword', acc.password || '');
          await humanDelay({ min: 500, max: 1500 });

          // Click login
          await page.click('button[type="submit"]');
          await page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 30000 }).catch(() => {});
          await humanDelay(DELAYS.pageLoad);

          // Check if logged in
          const isLoggedIn = await page.evaluate(() => {
            return document.body.innerText.includes('Create Post') ||
                   document.querySelector('[data-testid="create-post"]') !== null;
          });

          if (isLoggedIn) {
            await saveAccountCookies(page, account);
            return { success: true, message: `Logged in as ${acc.username}` };
          } else {
            return { success: false, error: 'Login may have failed. Check for captcha or 2FA.' };
          }
        } finally {
          await page.close();
        }
      }

      case 'check_status': {
        const context = await getContext(account);
        const page = await context.newPage();

        try {
          await page.goto('https://www.reddit.com', { waitUntil: 'domcontentloaded' });
          await humanDelay(DELAYS.pageLoad);

          const status = await page.evaluate(() => {
            const userMenu = document.querySelector('[id*="USER_DROPDOWN"]');
            return {
              loggedIn: !!userMenu,
              pageTitle: document.title
            };
          });

          return { success: true, ...status };
        } finally {
          await page.close();
        }
      }

      case 'browse_subreddit': {
        if (!subreddit) throw new Error('Subreddit required');

        const context = await getContext(account);
        const page = await context.newPage();

        try {
          const url = `https://www.reddit.com/r/${subreddit}/${sort}/`;
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          await humanDelay(DELAYS.pageLoad);

          // Scroll a bit like a human would
          for (let i = 0; i < 3; i++) {
            await humanScroll(page);
          }

          const posts = await page.evaluate((lim) => {
            const items: any[] = [];
            const postElements = document.querySelectorAll('[data-testid="post-container"], article');

            postElements.forEach((el, idx) => {
              if (idx >= lim) return;

              const titleEl = el.querySelector('h3, [slot="title"]');
              const linkEl = el.querySelector('a[href*="/comments/"]');
              const scoreEl = el.querySelector('[id*="vote-arrows"]');
              const authorEl = el.querySelector('a[href*="/user/"]');

              items.push({
                title: titleEl?.textContent?.trim() || '',
                url: linkEl?.getAttribute('href') || '',
                author: authorEl?.textContent?.replace('u/', '') || '',
                score: scoreEl?.textContent?.trim() || '0'
              });
            });

            return items;
          }, limit);

          return {
            success: true,
            subreddit,
            sort,
            posts: posts.map(p => ({
              ...p,
              url: p.url.startsWith('http') ? p.url : `https://www.reddit.com${p.url}`
            }))
          };
        } finally {
          await page.close();
        }
      }

      case 'read_post': {
        if (!postUrl) throw new Error('Post URL required');

        const context = await getContext(account);
        const page = await context.newPage();

        try {
          await page.goto(postUrl, { waitUntil: 'domcontentloaded' });
          await humanDelay(DELAYS.pageLoad);

          // Simulate reading
          for (let i = 0; i < 4; i++) {
            await humanScroll(page);
            await humanDelay(DELAYS.read);
          }

          const postData = await page.evaluate(() => {
            const title = document.querySelector('h1')?.textContent?.trim() || '';
            const body = document.querySelector('[data-test-id="post-content"], [slot="text-body"]')?.textContent?.trim() || '';
            const author = document.querySelector('a[href*="/user/"]')?.textContent?.replace('u/', '') || '';
            const score = document.querySelector('[id*="vote-arrows"]')?.textContent?.trim() || '';

            const comments: any[] = [];
            const commentEls = document.querySelectorAll('[id*="comment-tree"] > div, .Comment');
            commentEls.forEach((el, idx) => {
              if (idx >= 20) return;
              const text = el.querySelector('[data-testid="comment"]')?.textContent?.trim() ||
                           el.querySelector('.RichTextJSON-root')?.textContent?.trim() || '';
              const commentAuthor = el.querySelector('a[href*="/user/"]')?.textContent?.replace('u/', '') || '';
              if (text) {
                comments.push({ author: commentAuthor, text: text.substring(0, 500) });
              }
            });

            return { title, body: body.substring(0, 2000), author, score, comments };
          });

          return { success: true, post: postData };
        } finally {
          await page.close();
        }
      }

      case 'search': {
        if (!query) throw new Error('Search query required');

        const context = await getContext(account);
        const page = await context.newPage();

        try {
          const searchUrl = subreddit
            ? `https://www.reddit.com/r/${subreddit}/search/?q=${encodeURIComponent(query)}&restrict_sr=1`
            : `https://www.reddit.com/search/?q=${encodeURIComponent(query)}`;

          await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
          await humanDelay(DELAYS.pageLoad);

          await humanScroll(page);
          await humanScroll(page);

          const results = await page.evaluate((lim) => {
            const items: any[] = [];
            const posts = document.querySelectorAll('[data-testid="post-container"], article');

            posts.forEach((el, idx) => {
              if (idx >= lim) return;
              const titleEl = el.querySelector('h3, [slot="title"]');
              const linkEl = el.querySelector('a[href*="/comments/"]');
              const subEl = el.querySelector('a[href*="/r/"]');

              items.push({
                title: titleEl?.textContent?.trim() || '',
                url: linkEl?.getAttribute('href') || '',
                subreddit: subEl?.textContent?.replace('r/', '') || ''
              });
            });

            return items;
          }, limit);

          return {
            success: true,
            query,
            results: results.map(r => ({
              ...r,
              url: r.url.startsWith('http') ? r.url : `https://www.reddit.com${r.url}`
            }))
          };
        } finally {
          await page.close();
        }
      }

      case 'comment': {
        if (!postUrl || !content) throw new Error('Post URL and comment content required');

        const accounts = await loadAccounts();
        const acc = accounts[account];
        if (!acc?.warmedUp) {
          console.warn(`⚠️ Account ${account} not marked as warmed up. Proceeding with caution.`);
        }

        const context = await getContext(account);
        const page = await context.newPage();

        try {
          await page.goto(postUrl, { waitUntil: 'domcontentloaded' });
          await humanDelay(DELAYS.pageLoad);

          // Read the post first (human behavior)
          await humanScroll(page);
          await humanDelay(DELAYS.read);
          await humanScroll(page);

          // Find and click comment box
          const commentBox = await page.$('[placeholder*="comment"], [data-test-id="comment-submission-form"] textarea, .public-DraftEditor-content');
          if (!commentBox) {
            return { success: false, error: 'Comment box not found. May not be logged in.' };
          }

          await commentBox.click();
          await humanDelay({ min: 500, max: 1500 });

          // Type comment with human-like speed
          for (const char of content) {
            await page.keyboard.type(char, { delay: randomDelay(DELAYS.typing) });
            if (Math.random() < 0.03) {
              await humanDelay({ min: 500, max: 1500 }); // Thinking pause
            }
          }

          await humanDelay(DELAYS.action);

          // Submit
          const submitBtn = await page.$('button[type="submit"]:has-text("Comment"), button:has-text("Reply")');
          if (submitBtn) {
            await submitBtn.click();
            await humanDelay(DELAYS.action);
            await saveAccountCookies(page, account);
            return { success: true, message: 'Comment posted', postUrl };
          } else {
            return { success: false, error: 'Submit button not found' };
          }
        } finally {
          await page.close();
        }
      }

      case 'post': {
        if (!subreddit || !title || !content) {
          throw new Error('Subreddit, title, and content required');
        }

        const accounts = await loadAccounts();
        const acc = accounts[account];
        if (!acc?.warmedUp) {
          console.warn(`⚠️ Account ${account} not marked as warmed up. Proceeding with caution.`);
        }

        const context = await getContext(account);
        const page = await context.newPage();

        try {
          await page.goto(`https://www.reddit.com/r/${subreddit}/submit`, { waitUntil: 'domcontentloaded' });
          await humanDelay(DELAYS.pageLoad);

          // Title
          const titleInput = await page.$('[placeholder*="Title"], [name="title"]');
          if (titleInput) {
            await titleInput.click();
            await humanDelay({ min: 300, max: 800 });
            for (const char of title) {
              await page.keyboard.type(char, { delay: randomDelay(DELAYS.typing) });
            }
          }

          await humanDelay(DELAYS.action);

          // Body
          const bodyInput = await page.$('[placeholder*="Text"], .public-DraftEditor-content, textarea');
          if (bodyInput) {
            await bodyInput.click();
            await humanDelay({ min: 300, max: 800 });
            for (const char of content) {
              await page.keyboard.type(char, { delay: randomDelay(DELAYS.typing) });
              if (Math.random() < 0.02) {
                await humanDelay({ min: 500, max: 1500 });
              }
            }
          }

          await humanDelay(DELAYS.action);

          // Submit
          const postBtn = await page.$('button[type="submit"]:has-text("Post"), button:has-text("Submit")');
          if (postBtn) {
            await postBtn.click();
            await humanDelay({ min: 3000, max: 6000 });
            await saveAccountCookies(page, account);
            return { success: true, message: `Posted to r/${subreddit}`, title };
          } else {
            return { success: false, error: 'Post button not found' };
          }
        } finally {
          await page.close();
        }
      }

      case 'upvote': {
        if (!postUrl) throw new Error('Post URL required');

        const context = await getContext(account);
        const page = await context.newPage();

        try {
          await page.goto(postUrl, { waitUntil: 'domcontentloaded' });
          await humanDelay(DELAYS.pageLoad);

          // Read briefly first
          await humanScroll(page);
          await humanDelay({ min: 2000, max: 5000 });

          const upvoteBtn = await page.$('[aria-label="upvote"], button[id*="upvote"]');
          if (upvoteBtn) {
            await upvoteBtn.click();
            await humanDelay({ min: 500, max: 1500 });
            return { success: true, message: 'Upvoted', postUrl };
          } else {
            return { success: false, error: 'Upvote button not found' };
          }
        } finally {
          await page.close();
        }
      }

      default:
        throw new Error(`Unknown Reddit action: ${action}`);
    }
  }
};
