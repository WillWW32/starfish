import { Skill } from '../../types.js';
import { createTask, updateTask, deleteTask, getAllTasks, getTasksByAgent, getTask, getExecutionLogs, TaskType } from '../../tasks/store.js';
import { TASK_TEMPLATES, CRON_PRESETS } from '../../tasks/templates.js';

/**
 * Task Manager skill — lets agents create/manage persistent scheduled tasks via chat.
 * The taskScheduler is injected at bind time via closure (same pattern as delegate skill).
 */
export function createTaskManagerSkill(taskScheduler: any): Skill {
  return {
    id: 'task-manager',
    name: 'Task Manager',
    description: 'Create, list, enable/disable, delete, and run scheduled tasks. Use this to set up autonomous recurring work like social posting, lead follow-up, content generation, and monitoring reports.',
    version: '1.0.0',
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['create', 'list', 'enable', 'disable', 'delete', 'run_now', 'get', 'list_templates'],
          description: 'Action to perform'
        },
        task_id: {
          type: 'string',
          description: 'Task ID (for enable/disable/delete/run_now/get actions)'
        },
        name: {
          type: 'string',
          description: 'Name for the new task (for create action)'
        },
        task_type: {
          type: 'string',
          enum: ['social_post', 'lead_followup', 'content_gen', 'monitoring'],
          description: 'Type of scheduled task (for create action)'
        },
        schedule: {
          type: 'string',
          description: 'Cron expression or preset name like "daily at 9am", "every 2 hours", "weekdays at 9am". For create action.'
        },
        config: {
          type: 'object',
          description: 'Task-specific configuration. For social_post: {topic, tone, platform, hashtags}. For lead_followup: {statuses, hours_threshold, max_leads}. For content_gen: {content_type, topic, length, tone}. For monitoring: {hours, include_leads, include_tasks}.'
        },
        description: {
          type: 'string',
          description: 'Optional description for the task'
        }
      },
      required: ['action']
    },
    execute: async (params: any) => {
      const { action, task_id, name, task_type, schedule, config, description } = params;

      try {
        switch (action) {
          case 'list_templates': {
            return {
              templates: Object.values(TASK_TEMPLATES).map(t => ({
                taskType: t.taskType,
                label: t.label,
                description: t.description,
                configFields: t.configFields.map(f => `${f.key} (${f.type}${f.required ? ', required' : ''})`)
              })),
              cron_presets: CRON_PRESETS
            };
          }

          case 'list': {
            const tasks = getAllTasks();
            if (tasks.length === 0) return { message: 'No scheduled tasks yet.', tasks: [] };
            return {
              count: tasks.length,
              tasks: tasks.map(t => ({
                id: t.id,
                name: t.name,
                type: t.taskType,
                schedule: t.cronExpression,
                enabled: t.enabled,
                lastRun: t.lastRunAt,
                config_summary: summarizeConfig(t.taskType, t.config)
              }))
            };
          }

          case 'get': {
            if (!task_id) return { error: 'task_id required' };
            const task = getTask(task_id);
            if (!task) return { error: 'Task not found' };
            const logs = getExecutionLogs(task_id, 5);
            return { task, recentLogs: logs };
          }

          case 'create': {
            if (!name) return { error: 'name required' };
            if (!task_type) return { error: 'task_type required. Options: social_post, lead_followup, content_gen, monitoring' };
            if (!schedule) return { error: 'schedule required. Use a cron expression like "0 9 * * *" or a preset like "daily at 9am"' };

            // Resolve schedule presets to cron expressions
            const cronExpression = resolveCron(schedule);
            if (!cronExpression) return { error: `Invalid schedule: "${schedule}". Use a cron expression or preset like: ${CRON_PRESETS.map(p => p.label).join(', ')}` };

            // Use template defaults merged with provided config
            const template = TASK_TEMPLATES[task_type as TaskType];
            const mergedConfig = { ...(template?.defaultConfig || {}), ...(config || {}) };

            // Get the agent ID from the caller context (the agent running this skill)
            // We'll use boss-b-001 as default since that's the primary autonomous agent
            const agentId = (params as any)._agentId || 'boss-b-001';

            const task = createTask(agentId, name, task_type as TaskType, cronExpression, mergedConfig, description);

            // Register with live scheduler
            if (taskScheduler) taskScheduler.scheduleTask(task);

            return {
              success: true,
              message: `Task "${name}" created and scheduled (${cronExpression}).`,
              task: { id: task.id, name: task.name, type: task.taskType, schedule: task.cronExpression, enabled: task.enabled }
            };
          }

          case 'enable': {
            if (!task_id) return { error: 'task_id required' };
            const task = updateTask(task_id, { enabled: true });
            if (!task) return { error: 'Task not found' };
            if (taskScheduler) taskScheduler.scheduleTask(task);
            return { success: true, message: `Task "${task.name}" enabled.` };
          }

          case 'disable': {
            if (!task_id) return { error: 'task_id required' };
            const task = updateTask(task_id, { enabled: false });
            if (!task) return { error: 'Task not found' };
            if (taskScheduler) taskScheduler.unscheduleTask(task_id);
            return { success: true, message: `Task "${task.name}" disabled.` };
          }

          case 'delete': {
            if (!task_id) return { error: 'task_id required' };
            const existing = getTask(task_id);
            if (!existing) return { error: 'Task not found' };
            if (taskScheduler) taskScheduler.unscheduleTask(task_id);
            deleteTask(task_id);
            return { success: true, message: `Task "${existing.name}" deleted.` };
          }

          case 'run_now': {
            if (!task_id) return { error: 'task_id required' };
            if (!taskScheduler) return { error: 'Scheduler not available' };
            const result = await taskScheduler.runNow(task_id);
            return result;
          }

          default:
            return { error: `Unknown action: ${action}. Use: create, list, enable, disable, delete, run_now, get, list_templates` };
        }
      } catch (err: any) {
        return { error: err.message };
      }
    }
  };
}

function resolveCron(input: string): string | null {
  // If it already looks like a cron expression, validate and return
  if (/^[\d*\/,-]+\s/.test(input)) {
    // Basic cron format check (5 fields)
    const parts = input.trim().split(/\s+/);
    if (parts.length === 5) return input.trim();
  }

  // Try matching presets by label (case-insensitive)
  const lower = input.toLowerCase().trim();
  for (const preset of CRON_PRESETS) {
    if (preset.label.toLowerCase() === lower) return preset.value;
    // Partial match
    if (lower.includes(preset.label.toLowerCase().replace(/[()]/g, ''))) return preset.value;
  }

  // Natural language shortcuts
  if (lower.includes('every hour')) return '0 * * * *';
  if (lower.includes('every 2 hour')) return '0 */2 * * *';
  if (lower.includes('every 6 hour')) return '0 */6 * * *';
  if (lower.includes('every 5 min')) return '*/5 * * * *';
  if (lower.includes('every 15 min')) return '*/15 * * * *';
  if (lower.includes('every 30 min')) return '*/30 * * * *';
  if (lower.match(/daily.*(9|9am|9 am)/)) return '0 9 * * *';
  if (lower.match(/daily.*(6|6pm|6 pm|18)/)) return '0 18 * * *';
  if (lower.match(/daily.*(noon|12)/)) return '0 12 * * *';
  if (lower.match(/daily.*(8|8am|8 am)/)) return '0 8 * * *';
  if (lower.match(/daily.*(10|10am|10 am)/)) return '0 10 * * *';
  if (lower.match(/weekday/)) return '0 9 * * 1-5';
  if (lower.match(/monday/)) return '0 9 * * 1';
  if (lower.match(/twice.*(daily|day)/)) return '0 9,17 * * *';

  return null;
}

function summarizeConfig(taskType: string, config: any): string {
  switch (taskType) {
    case 'social_post':
      return `${config.platform || 'Twitter'}: ${config.topic || 'general'}`;
    case 'lead_followup':
      return `${(config.statuses || ['warm']).join('/')} leads, ${config.hours_threshold || 24}h threshold`;
    case 'content_gen':
      return `${config.content_type || 'blog post'}: ${config.topic || 'general'}`;
    case 'monitoring':
      return `${config.hours || 24}h report`;
    default:
      return JSON.stringify(config).substring(0, 60);
  }
}
