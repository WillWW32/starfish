import cron from 'node-cron';
import { getEnabledTasks, getTask, ScheduledTask } from './store.js';
import { executeTask } from './executor.js';

/**
 * Persistent task scheduler.
 * Loads tasks from SQLite on startup, registers cron jobs, survives restarts.
 */
export class TaskScheduler {
  private agentManager: any;
  private jobs: Map<string, cron.ScheduledTask> = new Map();
  private running: Set<string> = new Set();  // track in-flight executions

  constructor(agentManager: any) {
    this.agentManager = agentManager;
  }

  /**
   * Load all enabled tasks from DB and register cron jobs
   */
  async initialize(): Promise<void> {
    const tasks = getEnabledTasks();
    let loaded = 0;

    for (const task of tasks) {
      try {
        this.scheduleTask(task);
        loaded++;
      } catch (err: any) {
        console.error(`  ⚠️ Failed to schedule task "${task.name}": ${err.message}`);
      }
    }

    console.log(`  📅 Task Scheduler: ${loaded} task(s) loaded and scheduled`);
  }

  /**
   * Register a cron job for a task
   */
  scheduleTask(task: ScheduledTask): void {
    // Remove existing job if re-scheduling
    this.unscheduleTask(task.id);

    if (!cron.validate(task.cronExpression)) {
      throw new Error(`Invalid cron expression: ${task.cronExpression}`);
    }

    const job = cron.schedule(task.cronExpression, async () => {
      // Prevent overlapping executions of same task
      if (this.running.has(task.id)) {
        console.log(`  ⏭️ Task "${task.name}" skipped — previous run still in progress`);
        return;
      }

      this.running.add(task.id);
      try {
        // Re-fetch task from DB to get latest config
        const freshTask = getTask(task.id);
        if (!freshTask || !freshTask.enabled) {
          console.log(`  ⏭️ Task "${task.name}" skipped — disabled or deleted`);
          return;
        }
        await executeTask(this.agentManager, freshTask);
      } finally {
        this.running.delete(task.id);
      }
    }, {
      timezone: task.timezone || 'America/New_York',
      scheduled: true
    });

    this.jobs.set(task.id, job);
  }

  /**
   * Remove a cron job
   */
  unscheduleTask(taskId: string): void {
    const job = this.jobs.get(taskId);
    if (job) {
      job.stop();
      this.jobs.delete(taskId);
    }
  }

  /**
   * Trigger a task immediately (outside cron schedule)
   */
  async runNow(taskId: string): Promise<{ success: boolean; summary?: string; error?: string }> {
    const task = getTask(taskId);
    if (!task) return { success: false, error: 'Task not found' };

    if (this.running.has(taskId)) {
      return { success: false, error: 'Task is already running' };
    }

    this.running.add(taskId);
    try {
      const result = await executeTask(this.agentManager, task);
      return { success: result.success, summary: result.summary, error: result.error };
    } finally {
      this.running.delete(taskId);
    }
  }

  /**
   * Get status of all scheduled jobs
   */
  getStatus(): { taskId: string; scheduled: boolean; running: boolean }[] {
    const allTasks = getEnabledTasks();
    return allTasks.map(t => ({
      taskId: t.id,
      scheduled: this.jobs.has(t.id),
      running: this.running.has(t.id)
    }));
  }

  /**
   * Stop all cron jobs (for graceful shutdown)
   */
  async shutdown(): Promise<void> {
    for (const [id, job] of this.jobs) {
      job.stop();
    }
    this.jobs.clear();
    console.log('  📅 Task Scheduler: all jobs stopped');
  }
}
