import { Skill } from '../../types.js';

/**
 * Delegate skill — allows agents to send tasks to other agents.
 * The agentManager is injected at bind time via closure.
 */

export function createDelegateSkill(agentManager: any): Skill {
  return {
    id: 'delegate',
    name: 'Agent Delegation',
    description: 'Delegate a task to another agent and get their response. Use this to assign work to specialized agents like William II (book promotion, Reddit) or Creative Director (video production).',
    version: '1.0.0',
    enabled: true,
    parameters: {
      type: 'object',
      properties: {
        to_agent: {
          type: 'string',
          description: 'The agent ID to delegate to (e.g., "william-ii-001", "creative-director-001")'
        },
        task: {
          type: 'string',
          description: 'Clear description of the task to delegate'
        },
        context: {
          type: 'string',
          description: 'Optional context or background info for the target agent'
        }
      },
      required: ['to_agent', 'task']
    },
    execute: async (params: any) => {
      const { to_agent, task, context } = params;

      // Validate target agent exists
      const targetAgent = agentManager.getAgent(to_agent);
      if (!targetAgent) {
        // List available agents for better error
        const available = agentManager.getAllAgents().map((a: any) => `${a.config.id} (${a.config.name})`);
        return {
          error: `Agent "${to_agent}" not found.`,
          available_agents: available
        };
      }

      // Build the delegation message
      const delegationContent = context
        ? `[Delegated task from Boss]\n\nContext: ${context}\n\nTask: ${task}`
        : `[Delegated task from Boss]\n\nTask: ${task}`;

      try {
        const response = await agentManager.processMessage(to_agent, {
          agentId: to_agent,
          channel: 'internal',
          role: 'user',
          content: delegationContent,
          metadata: { delegated: true, from: 'boss-b-001' }
        });

        return {
          success: true,
          agent: targetAgent.config.name,
          agent_id: to_agent,
          response: response.content
        };
      } catch (err: any) {
        return {
          error: `Delegation failed: ${err.message}`,
          agent: to_agent
        };
      }
    }
  };
}
