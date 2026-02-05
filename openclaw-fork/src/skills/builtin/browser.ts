import { Skill } from '../../types.js';
import { chromium, Browser, Page, BrowserContext } from 'playwright';

let browser: Browser | null = null;
let context: BrowserContext | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: process.env.BROWSER_HEADLESS !== 'false',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }
  return browser;
}

async function getContext(): Promise<BrowserContext> {
  if (!context) {
    const b = await getBrowser();
    context = await b.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      viewport: { width: 1920, height: 1080 }
    });
  }
  return context;
}

export const browserSkill: Skill = {
  id: 'browser',
  name: 'Browser Automation',
  description: 'Control a web browser to navigate pages, fill forms, click elements, screenshot, and interact with websites. No rate limits or restrictions.',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['navigate', 'click', 'type', 'screenshot', 'extract', 'evaluate', 'wait', 'scroll', 'fill_form', 'close'],
        description: 'The browser action to perform'
      },
      url: { type: 'string', description: 'URL to navigate to' },
      selector: { type: 'string', description: 'CSS selector for element' },
      text: { type: 'string', description: 'Text to type or search for' },
      script: { type: 'string', description: 'JavaScript to evaluate in page' },
      timeout: { type: 'number', description: 'Timeout in ms', default: 30000 },
      formData: {
        type: 'object',
        description: 'Key-value pairs for form filling (selector: value)'
      }
    },
    required: ['action']
  },
  execute: async (params: any) => {
    const ctx = await getContext();
    const pages = ctx.pages();
    let page: Page = pages[0] || await ctx.newPage();

    switch (params.action) {
      case 'navigate':
        await page.goto(params.url, { waitUntil: 'domcontentloaded', timeout: params.timeout || 30000 });
        return { success: true, url: page.url(), title: await page.title() };

      case 'click':
        await page.click(params.selector, { timeout: params.timeout || 10000 });
        return { success: true, clicked: params.selector };

      case 'type':
        await page.fill(params.selector, params.text);
        return { success: true, typed: params.text };

      case 'screenshot':
        const buffer = await page.screenshot({ fullPage: true });
        return { success: true, screenshot: buffer.toString('base64') };

      case 'extract':
        const content = await page.evaluate((sel: string) => {
          if (sel) {
            const el = document.querySelector(sel);
            return el ? el.textContent : null;
          }
          return document.body.innerText;
        }, params.selector);
        return { success: true, content };

      case 'evaluate':
        const result = await page.evaluate(params.script);
        return { success: true, result };

      case 'wait':
        if (params.selector) {
          await page.waitForSelector(params.selector, { timeout: params.timeout || 30000 });
        } else {
          await page.waitForTimeout(params.timeout || 1000);
        }
        return { success: true };

      case 'scroll':
        await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
        return { success: true };

      case 'fill_form':
        for (const [selector, value] of Object.entries(params.formData || {})) {
          await page.fill(selector, value as string);
        }
        return { success: true, filled: Object.keys(params.formData || {}) };

      case 'close':
        await page.close();
        return { success: true };

      default:
        throw new Error(`Unknown browser action: ${params.action}`);
    }
  }
};
