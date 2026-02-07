import Anthropic from '@anthropic-ai/sdk';
import { addKnowledgeItem, getKnowledgeSummary, getKnowledgeItems, deleteKnowledgeItem, getKnowledgeTokenCost, KnowledgeItem } from './knowledgeStore.js';
import { estimateTokens } from '../utils/tokenCounter.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Process an uploaded PDF: extract text via pdf-parse, then summarize and store.
 */
export async function ingestPdfFile(
  agentId: string,
  filename: string,
  buffer: Buffer
): Promise<KnowledgeItem> {
  let textContent: string;
  try {
    const pdfParse = (await import('pdf-parse')).default;
    const data = await pdfParse(buffer);
    textContent = data.text || '';
    if (!textContent.trim()) {
      textContent = `[PDF with ${data.numpages} pages — no extractable text (may be scanned/image-based)]`;
    }
  } catch (err: any) {
    console.warn(`  ⚠️ PDF parsing failed for ${filename}: ${err.message}`);
    textContent = '[PDF parsing failed — file may be corrupted or password-protected]';
  }
  return ingestKnowledgeFile(agentId, filename, textContent);
}

/**
 * Share knowledge items from one agent to another (copy).
 */
export function shareKnowledge(sourceAgentId: string, targetAgentId: string, itemIds?: string[]): number {
  const items = getKnowledgeItems(sourceAgentId);
  const toShare = itemIds ? items.filter(i => itemIds.includes(i.id)) : items;
  let count = 0;
  for (const item of toShare) {
    addKnowledgeItem({
      agentId: targetAgentId,
      filename: item.filename,
      contentType: item.contentType,
      originalContent: item.originalContent,
      summary: item.summary,
      tokens: item.tokens
    });
    count++;
  }
  return count;
}

/**
 * Process an uploaded file: extract text, summarize via Claude, store in knowledge base.
 */
export async function ingestKnowledgeFile(
  agentId: string,
  filename: string,
  content: string
): Promise<KnowledgeItem> {
  // Determine content type
  const ext = filename.split('.').pop()?.toLowerCase() || 'txt';
  const contentType = ext === 'json' ? 'json' : ext === 'md' ? 'markdown' : 'text';

  // Truncate very large files for summarization (keep original stored)
  const textForSummary = content.length > 50000 ? content.substring(0, 50000) + '\n[...truncated]' : content;

  // Generate summary via Claude
  let summary: string;
  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-5-20250929',
      max_tokens: 2000,
      system: 'You are a knowledge summarizer. Extract the key facts, concepts, names, numbers, and actionable information from this content. Be concise but thorough. Output as bullet points. Max 1000 words.',
      messages: [{ role: 'user', content: `Summarize this ${contentType} file "${filename}":\n\n${textForSummary}` }]
    });
    const textBlock = response.content.find((b: any) => b.type === 'text');
    summary = textBlock ? (textBlock as any).text : content.substring(0, 1000);
  } catch (err: any) {
    console.warn(`  ⚠️ Knowledge summarization failed for ${filename}: ${err.message}`);
    // Fallback: use first 1000 chars as summary
    summary = content.substring(0, 1000);
  }

  const tokens = estimateTokens(summary);

  return addKnowledgeItem({
    agentId,
    filename,
    contentType,
    originalContent: content,
    summary,
    tokens
  });
}

/**
 * Get knowledge summary for an agent (for injection into system prompt)
 */
export function getAgentKnowledge(agentId: string, maxTokens?: number): string {
  return getKnowledgeSummary(agentId, maxTokens);
}

/**
 * List all knowledge items for an agent
 */
export function listAgentKnowledge(agentId: string): KnowledgeItem[] {
  return getKnowledgeItems(agentId);
}

/**
 * Remove a knowledge item
 */
export function removeKnowledgeItem(id: string): boolean {
  return deleteKnowledgeItem(id);
}

/**
 * Get total token cost
 */
export function getTokenCost(agentId: string): number {
  return getKnowledgeTokenCost(agentId);
}
