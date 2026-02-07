import { ScheduledTask, logExecutionStart, logExecutionComplete, updateTaskRunTime } from './store.js';
import { buildTaskPrompt } from './templates.js';

export interface ExecutionResult {
  success: boolean;
  summary: string;
  error?: string;
  timeMs: number;
}

/**
 * Execute a scheduled task by sending a crafted prompt to the agent.
 * The agentManager is passed in to avoid circular imports.
 */
export async function executeTask(
  agentManager: any,
  task: ScheduledTask
): Promise<ExecutionResult> {
  const startTime = Date.now();

  // Start execution log
  const log = logExecutionStart(task.id, task.agentId);

  try {
    // Verify agent exists
    const agent = agentManager.getAgent(task.agentId);
    if (!agent) {
      const error = `Agent ${task.agentId} not found`;
      logExecutionComplete(log.id, 'failed', undefined, error, Date.now() - startTime);
      return { success: false, summary: '', error, timeMs: Date.now() - startTime };
    }

    // Build the prompt from template + config
    const prompt = buildTaskPrompt(task.taskType, task.config);

    console.log(`  🤖 Executing task "${task.name}" (${task.taskType}) for agent ${agent.config.name}`);

    // Send to agent via processMessage with 60s timeout
    const response = await Promise.race([
      agentManager.processMessage(task.agentId, {
        agentId: task.agentId,
        channel: 'scheduler',
        role: 'user',
        content: prompt,
        metadata: { scheduledTask: true, taskId: task.id, taskType: task.taskType }
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Task execution timed out (60s)')), 60000))
    ]) as any;

    const timeMs = Date.now() - startTime;
    const summary = response?.content?.substring(0, 1000) || 'Task completed (no response content)';

    // Update execution log
    logExecutionComplete(log.id, 'success', summary, undefined, timeMs);

    // Update task run time
    updateTaskRunTime(task.id, new Date().toISOString());

    console.log(`  ✅ Task "${task.name}" completed in ${timeMs}ms`);

    return { success: true, summary, timeMs };
  } catch (err: any) {
    const timeMs = Date.now() - startTime;
    const error = err.message || 'Unknown error';

    console.error(`  ❌ Task "${task.name}" failed: ${error}`);

    logExecutionComplete(log.id, 'failed', undefined, error, timeMs);
    updateTaskRunTime(task.id, new Date().toISOString());

    return { success: false, summary: '', error, timeMs };
  }
}
