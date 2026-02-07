import { TaskType } from './store.js';

/**
 * Prompt templates for autonomous task execution.
 * Each template gets interpolated with the task's config object.
 */

export interface TaskTemplate {
  taskType: TaskType;
  label: string;
  description: string;
  promptBuilder: (config: any) => string;
  defaultConfig: Record<string, any>;
  configFields: ConfigField[];
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'boolean';
  options?: string[];
  defaultValue?: any;
  required?: boolean;
}

// ─── Templates ───

export const TASK_TEMPLATES: Record<TaskType, TaskTemplate> = {

  social_post: {
    taskType: 'social_post',
    label: 'Social Media Post',
    description: 'Create and schedule social media content via Typefully',
    promptBuilder: (config) => `
[SCHEDULED TASK — Social Post]

Create and schedule a social media post now.

Topic/Theme: ${config.topic || 'general business tips'}
Tone: ${config.tone || 'casual professional'}
Platform: ${config.platform || 'Twitter'}
${config.hashtags ? 'Include relevant hashtags.' : 'No hashtags needed.'}
${config.threadify ? 'Break into a thread if content warrants it.' : 'Keep it to a single post.'}
${config.call_to_action ? `CTA: ${config.call_to_action}` : ''}
${config.notes ? `Additional notes: ${config.notes}` : ''}

Use the typefully skill to create a draft or schedule it for the next available slot.
Respond with what you posted/scheduled.
`.trim(),
    defaultConfig: {
      topic: '',
      tone: 'casual professional',
      platform: 'Twitter',
      hashtags: true,
      threadify: false,
      call_to_action: '',
      notes: ''
    },
    configFields: [
      { key: 'topic', label: 'Topic / Theme', type: 'text', required: true },
      { key: 'tone', label: 'Tone', type: 'select', options: ['casual professional', 'formal', 'witty', 'inspirational', 'educational'], defaultValue: 'casual professional' },
      { key: 'platform', label: 'Platform', type: 'select', options: ['Twitter', 'LinkedIn', 'Both'], defaultValue: 'Twitter' },
      { key: 'hashtags', label: 'Include Hashtags', type: 'boolean', defaultValue: true },
      { key: 'threadify', label: 'Auto-thread', type: 'boolean', defaultValue: false },
      { key: 'call_to_action', label: 'Call to Action', type: 'text' },
      { key: 'notes', label: 'Additional Notes', type: 'textarea' }
    ]
  },

  lead_followup: {
    taskType: 'lead_followup',
    label: 'Lead Follow-up',
    description: 'Check on leads and draft personalized follow-up messages',
    promptBuilder: (config) => `
[SCHEDULED TASK — Lead Follow-up]

Check the leads database for leads that need follow-up.

Criteria:
- Lead status: ${(config.statuses || ['warm', 'hot']).join(', ')}
- No contact in the last ${config.hours_threshold || 24} hours
- Process up to ${config.max_leads || 5} leads this run

For each matching lead:
1. Review their conversation history and extracted info
2. Draft a personalized follow-up message based on their use case and last interaction
3. ${config.send_email ? 'Send the follow-up via email if they provided an email address' : 'Log the follow-up draft for manual review'}

${config.message_style ? `Message style: ${config.message_style}` : 'Keep messages warm, brief, and focused on their specific need.'}
${config.notes ? `Additional context: ${config.notes}` : ''}

Respond with a summary: how many leads checked, how many contacted, any issues.
`.trim(),
    defaultConfig: {
      statuses: ['warm', 'hot'],
      hours_threshold: 24,
      max_leads: 5,
      send_email: false,
      message_style: '',
      notes: ''
    },
    configFields: [
      { key: 'statuses', label: 'Lead Statuses to Follow Up', type: 'text', defaultValue: 'warm, hot', required: true },
      { key: 'hours_threshold', label: 'Hours Since Last Contact', type: 'number', defaultValue: 24 },
      { key: 'max_leads', label: 'Max Leads Per Run', type: 'number', defaultValue: 5 },
      { key: 'send_email', label: 'Auto-send Emails', type: 'boolean', defaultValue: false },
      { key: 'message_style', label: 'Message Style', type: 'text' },
      { key: 'notes', label: 'Additional Notes', type: 'textarea' }
    ]
  },

  content_gen: {
    taskType: 'content_gen',
    label: 'Content Generation',
    description: 'Generate blog posts, emails, or marketing content on schedule',
    promptBuilder: (config) => `
[SCHEDULED TASK — Content Generation]

Generate the following content now.

Content type: ${config.content_type || 'blog post'}
Topic: ${config.topic || 'AI for small business'}
Target length: ${config.length || '500-800 words'}
Tone: ${config.tone || 'educational'}
Audience: ${config.audience || 'small business owners'}
${config.keywords ? `Keywords to include: ${config.keywords}` : ''}
${config.call_to_action ? `CTA: ${config.call_to_action}` : ''}
${config.notes ? `Additional context: ${config.notes}` : ''}

${config.delivery === 'typefully' ? 'Post it via Typefully when done.' : 'Save the content and respond with it for review.'}

Respond with the generated content and a brief summary of what was created.
`.trim(),
    defaultConfig: {
      content_type: 'blog post',
      topic: '',
      length: '500-800 words',
      tone: 'educational',
      audience: 'small business owners',
      keywords: '',
      call_to_action: '',
      delivery: 'review',
      notes: ''
    },
    configFields: [
      { key: 'content_type', label: 'Content Type', type: 'select', options: ['blog post', 'email newsletter', 'social thread', 'ad copy', 'landing page copy'], defaultValue: 'blog post' },
      { key: 'topic', label: 'Topic', type: 'text', required: true },
      { key: 'length', label: 'Target Length', type: 'select', options: ['100-200 words', '300-500 words', '500-800 words', '1000-1500 words'], defaultValue: '500-800 words' },
      { key: 'tone', label: 'Tone', type: 'select', options: ['educational', 'casual', 'formal', 'witty', 'inspirational'], defaultValue: 'educational' },
      { key: 'audience', label: 'Audience', type: 'text', defaultValue: 'small business owners' },
      { key: 'keywords', label: 'Keywords', type: 'text' },
      { key: 'call_to_action', label: 'Call to Action', type: 'text' },
      { key: 'delivery', label: 'Delivery', type: 'select', options: ['review', 'typefully'], defaultValue: 'review' },
      { key: 'notes', label: 'Additional Notes', type: 'textarea' }
    ]
  },

  monitoring: {
    taskType: 'monitoring',
    label: 'Monitoring & Reports',
    description: 'Check system activity and generate summary reports',
    promptBuilder: (config) => `
[SCHEDULED TASK — Monitoring Report]

Generate a status report for the last ${config.hours || 24} hours.

Include:
${config.include_leads !== false ? '- Lead activity: new leads, status changes, conversations' : ''}
${config.include_tasks !== false ? '- Scheduled task execution: successes, failures, skipped' : ''}
${config.include_social !== false ? '- Social media activity: posts published, engagement' : ''}
${config.include_content !== false ? '- Content generated: what was created' : ''}
${config.custom_metrics ? `- Custom: ${config.custom_metrics}` : ''}

Format: ${config.format || 'brief summary with bullet points'}
${config.notes ? `Additional context: ${config.notes}` : ''}

${config.email_to ? `Email this report to ${config.email_to} when done.` : 'Respond with the report for dashboard review.'}
`.trim(),
    defaultConfig: {
      hours: 24,
      include_leads: true,
      include_tasks: true,
      include_social: true,
      include_content: true,
      custom_metrics: '',
      format: 'brief summary',
      email_to: '',
      notes: ''
    },
    configFields: [
      { key: 'hours', label: 'Report Period (hours)', type: 'number', defaultValue: 24 },
      { key: 'include_leads', label: 'Include Leads', type: 'boolean', defaultValue: true },
      { key: 'include_tasks', label: 'Include Task Results', type: 'boolean', defaultValue: true },
      { key: 'include_social', label: 'Include Social Activity', type: 'boolean', defaultValue: true },
      { key: 'include_content', label: 'Include Content Generated', type: 'boolean', defaultValue: true },
      { key: 'custom_metrics', label: 'Custom Metrics', type: 'textarea' },
      { key: 'format', label: 'Report Format', type: 'select', options: ['brief summary', 'detailed report', 'bullet points only'], defaultValue: 'brief summary' },
      { key: 'email_to', label: 'Email Report To', type: 'text' },
      { key: 'notes', label: 'Additional Notes', type: 'textarea' }
    ]
  }
};

/**
 * Build the execution prompt for a task
 */
export function buildTaskPrompt(taskType: TaskType, config: any): string {
  const template = TASK_TEMPLATES[taskType];
  if (!template) throw new Error(`Unknown task type: ${taskType}`);
  return template.promptBuilder(config);
}

/**
 * Common cron presets for the dashboard
 */
export const CRON_PRESETS = [
  { label: 'Every hour', value: '0 * * * *' },
  { label: 'Every 2 hours', value: '0 */2 * * *' },
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at 9am', value: '0 9 * * *' },
  { label: 'Daily at 6pm', value: '0 18 * * *' },
  { label: 'Twice daily (9am & 5pm)', value: '0 9,17 * * *' },
  { label: 'Weekdays at 9am', value: '0 9 * * 1-5' },
  { label: 'Monday morning', value: '0 9 * * 1' },
  { label: 'Every 5 minutes (testing)', value: '*/5 * * * *' },
];
