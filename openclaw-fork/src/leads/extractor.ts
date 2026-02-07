import Anthropic from '@anthropic-ai/sdk';
import { getLeadMessages, updateLeadInfo } from './store.js';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * After every few messages, extract structured lead info from the conversation.
 * Runs async — doesn't block the response.
 */
export async function extractLeadInfo(leadId: string): Promise<void> {
  try {
    const messages = getLeadMessages(leadId);
    if (messages.length < 2) return; // Need at least one exchange

    // Only run extraction every 4 messages to save API calls
    if (messages.length % 4 !== 0 && messages.length < 4) return;

    const transcript = messages
      .map(m => `${m.role === 'user' ? 'Visitor' : 'Boss B'}: ${m.content}`)
      .join('\n');

    const response = await anthropic.messages.create({
      model: 'claude-haiku-3-5-20241022',
      max_tokens: 500,
      system: `Extract lead information from this sales conversation. Return ONLY valid JSON with these fields (use null if not mentioned):
{
  "contactEmail": string or null,
  "contactName": string or null,
  "businessName": string or null,
  "useCase": string or null (what they want the AI to do, 1-2 sentences),
  "channels": string or null (comma-separated: email, social, website, phone, etc.),
  "summary": string (1-2 sentence summary of the conversation so far),
  "nextStep": string or null (what should happen next based on conversation)
}`,
      messages: [{ role: 'user', content: transcript }]
    });

    const textBlock = response.content.find((b: any) => b.type === 'text');
    if (!textBlock) return;

    const text = (textBlock as any).text.trim();
    // Extract JSON from response (may be wrapped in markdown code block)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return;

    const info = JSON.parse(jsonMatch[0]);
    updateLeadInfo(leadId, info);
  } catch (err: any) {
    console.warn(`  ⚠️ Lead extraction failed for ${leadId}: ${err.message}`);
  }
}
