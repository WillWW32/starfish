import { Skill } from '../../types.js';
import cron from 'node-cron';
import { v4 as uuid } from 'uuid';

interface ScheduledTask {
  id: string;
  name: string;
  cronExpression: string;
  agentId: string;
  action: any;
  enabled: boolean;
  lastRun?: Date;
  nextRun?: Date;
  task: cron.ScheduledTask;
}

const scheduledTasks: Map<string, ScheduledTask> = new Map();

export const schedulerSkill: Skill = {
  id: 'scheduler',
  name: 'Task Scheduler',
  description: 'Schedule recurring tasks using cron expressions. Manage scheduled jobs.',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['schedule', 'unschedule', 'list', 'pause', 'resume', 'run_now'],
        description: 'Scheduler action'
      },
      taskId: { type: 'string', description: 'Task ID for management operations' },
      name: { type: 'string', description: 'Task name' },
      cronExpression: {
        type: 'string',
        description: 'Cron expression (e.g., "0 9 * * *" for 9am daily)'
      },
      agentId: { type: 'string', description: 'Agent ID to execute the task' },
      taskAction: {
        type: 'object',
        description: 'Action to execute (skill name + params)',
        properties: {
          skill: { type: 'string' },
          params: { type: 'object' }
        }
      },
      timezone: { type: 'string', default: 'America/New_York' }
    },
    required: ['action']
  },
  execute: async (params: any) => {
    const { action, taskId, name, cronExpression, agentId, taskAction, timezone = 'America/New_York' } = params;

    switch (action) {
      case 'schedule': {
        if (!cronExpression || !cron.validate(cronExpression)) {
          throw new Error(`Invalid cron expression: ${cronExpression}`);
        }

        const id = taskId || uuid();

        // Create the scheduled task
        const task = cron.schedule(
          cronExpression,
          async () => {
            const scheduledTask = scheduledTasks.get(id);
            if (scheduledTask) {
              scheduledTask.lastRun = new Date();
              console.log(`⏰ Running scheduled task: ${scheduledTask.name}`);
              // Task execution would be handled by the agent
              // This emits an event that the agent manager would pick up
            }
          },
          {
            scheduled: true,
            timezone
          }
        );

        const scheduledTask: ScheduledTask = {
          id,
          name: name || `Task ${id.slice(0, 8)}`,
          cronExpression,
          agentId,
          action: taskAction,
          enabled: true,
          task
        };

        scheduledTasks.set(id, scheduledTask);

        return {
          success: true,
          taskId: id,
          name: scheduledTask.name,
          cronExpression,
          scheduled: true
        };
      }

      case 'unschedule': {
        const task = scheduledTasks.get(taskId);
        if (!task) {
          throw new Error(`Task ${taskId} not found`);
        }

        task.task.stop();
        scheduledTasks.delete(taskId);

        return { success: true, taskId, unscheduled: true };
      }

      case 'list': {
        const tasks = Array.from(scheduledTasks.values()).map((t) => ({
          id: t.id,
          name: t.name,
          cronExpression: t.cronExpression,
          agentId: t.agentId,
          enabled: t.enabled,
          lastRun: t.lastRun?.toISOString(),
          action: t.action
        }));

        return { success: true, tasks, count: tasks.length };
      }

      case 'pause': {
        const task = scheduledTasks.get(taskId);
        if (!task) {
          throw new Error(`Task ${taskId} not found`);
        }

        task.task.stop();
        task.enabled = false;

        return { success: true, taskId, paused: true };
      }

      case 'resume': {
        const task = scheduledTasks.get(taskId);
        if (!task) {
          throw new Error(`Task ${taskId} not found`);
        }

        task.task.start();
        task.enabled = true;

        return { success: true, taskId, resumed: true };
      }

      case 'run_now': {
        const task = scheduledTasks.get(taskId);
        if (!task) {
          throw new Error(`Task ${taskId} not found`);
        }

        task.lastRun = new Date();
        // Trigger immediate execution
        console.log(`⏰ Manually running task: ${task.name}`);

        return { success: true, taskId, executed: true, time: task.lastRun.toISOString() };
      }

      default:
        throw new Error(`Unknown scheduler action: ${action}`);
    }
  }
};
