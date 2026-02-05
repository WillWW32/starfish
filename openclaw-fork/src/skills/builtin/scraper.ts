import { Skill } from '../../types.js';
import { chromium } from 'playwright';
import axios from 'axios';

export const scraperSkill: Skill = {
  id: 'scraper',
  name: 'Web Scraper',
  description: 'Extract data from websites. Supports CSS selectors, pagination, and structured data extraction. No rate limits.',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['scrape', 'scrape_list', 'scrape_paginated', 'extract_links', 'extract_emails', 'extract_contacts'],
        description: 'Scraping action'
      },
      url: { type: 'string', description: 'URL to scrape' },
      urls: { type: 'array', items: { type: 'string' }, description: 'Multiple URLs to scrape' },
      selectors: {
        type: 'object',
        description: 'Field name to CSS selector mapping',
        additionalProperties: { type: 'string' }
      },
      listSelector: { type: 'string', description: 'Selector for list items container' },
      itemSelector: { type: 'string', description: 'Selector for individual items' },
      nextPageSelector: { type: 'string', description: 'Selector for next page button/link' },
      maxPages: { type: 'number', default: 10, description: 'Max pages to scrape' },
      waitFor: { type: 'string', description: 'Selector to wait for before scraping' },
      javascript: { type: 'boolean', default: true, description: 'Use browser for JS-rendered content' }
    },
    required: ['action', 'url']
  },
  execute: async (params: any) => {
    const { action, url, urls, selectors, listSelector, itemSelector, nextPageSelector, maxPages, waitFor, javascript } = params;

    // Simple fetch for non-JS pages
    if (!javascript) {
      const response = await axios.get(url);
      return { success: true, html: response.data };
    }

    // Browser-based scraping
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
      switch (action) {
        case 'scrape': {
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          if (waitFor) await page.waitForSelector(waitFor);

          const data: Record<string, any> = {};

          for (const [field, selector] of Object.entries(selectors || {})) {
            data[field] = await page.evaluate((sel: string) => {
              const el = document.querySelector(sel);
              return el?.textContent?.trim() || null;
            }, selector as string);
          }

          return { success: true, url, data };
        }

        case 'scrape_list': {
          await page.goto(url, { waitUntil: 'domcontentloaded' });
          if (waitFor) await page.waitForSelector(waitFor);

          const items = await page.evaluate(
            ({ container, item, fields }: any) => {
              const containerEl = document.querySelector(container);
              if (!containerEl) return [];

              const itemEls = containerEl.querySelectorAll(item);
              return Array.from(itemEls).map((el) => {
                const data: Record<string, any> = {};
                for (const [field, selector] of Object.entries(fields || {})) {
                  const fieldEl = el.querySelector(selector as string);
                  data[field] = fieldEl?.textContent?.trim() || null;
                }
                return data;
              });
            },
            { container: listSelector, item: itemSelector, fields: selectors }
          );

          return { success: true, url, items, count: items.length };
        }

        case 'scrape_paginated': {
          const allItems: any[] = [];
          let currentPage = 1;

          await page.goto(url, { waitUntil: 'domcontentloaded' });

          while (currentPage <= (maxPages || 10)) {
            if (waitFor) await page.waitForSelector(waitFor);

            const items = await page.evaluate(
              ({ container, item, fields }: any) => {
                const containerEl = container ? document.querySelector(container) : document.body;
                if (!containerEl) return [];

                const itemEls = containerEl.querySelectorAll(item);
                return Array.from(itemEls).map((el) => {
                  const data: Record<string, any> = {};
                  for (const [field, selector] of Object.entries(fields || {})) {
                    const fieldEl = el.querySelector(selector as string);
                    data[field] = fieldEl?.textContent?.trim() || null;
                  }
                  return data;
                });
              },
              { container: listSelector, item: itemSelector, fields: selectors }
            );

            allItems.push(...items);

            // Try to go to next page
            const nextButton = await page.$(nextPageSelector!);
            if (!nextButton) break;

            await nextButton.click();
            await page.waitForTimeout(1000);
            currentPage++;
          }

          return { success: true, items: allItems, pages: currentPage, count: allItems.length };
        }

        case 'extract_links': {
          await page.goto(url, { waitUntil: 'domcontentloaded' });

          const links = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('a[href]')).map((a) => ({
              text: a.textContent?.trim(),
              href: (a as HTMLAnchorElement).href
            }));
          });

          return { success: true, url, links, count: links.length };
        }

        case 'extract_emails': {
          await page.goto(url, { waitUntil: 'domcontentloaded' });

          const text = await page.evaluate(() => document.body.innerText);
          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const emails = [...new Set(text.match(emailRegex) || [])];

          return { success: true, url, emails, count: emails.length };
        }

        case 'extract_contacts': {
          await page.goto(url, { waitUntil: 'domcontentloaded' });

          const text = await page.evaluate(() => document.body.innerText);

          const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
          const phoneRegex = /(\+?1?[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;

          const emails = [...new Set(text.match(emailRegex) || [])];
          const phones = [...new Set(text.match(phoneRegex) || [])];

          return { success: true, url, emails, phones };
        }

        default:
          throw new Error(`Unknown scraper action: ${action}`);
      }
    } finally {
      await browser.close();
    }
  }
};
