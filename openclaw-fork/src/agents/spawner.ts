import { AgentManager } from './manager.js';
import { UserService } from '../users/service.js';
import { getDatabase } from '../db/database.js';
import { v4 as uuid } from 'uuid';

export interface FriendAgentRequest {
  friendUserId: string;
  agentName: string;
  description?: string;
  model?: string;
  systemPrompt?: string;
  allowedSkills: string[];     // Which skills this friend's agent can use
  temperature?: number;
}

const DEFAULT_FRIEND_PROMPT = (friendName: string, allowedSkills: string[]) => `
You are a personal AI assistant created for ${friendName} within the Starfish platform.

## YOUR CAPABILITIES
You have access to the following tools: ${allowedSkills.join(', ')}.

## GUIDELINES
- Be helpful, friendly, and proactive
- You work within the WJ Boone ecosystem but serve this specific user
- If asked to do something outside your allowed skills, explain your limitations
- Keep your responses concise and actionable
- Report any issues to the system administrator

## BOUNDARIES
- Only use the skills you've been assigned
- Don't access other users' data or agents
- Don't make promises about capabilities you don't have
`;

export class AgentSpawner {
  private agentManager: AgentManager;
  private userService: UserService;

  constructor(agentManager: AgentManager) {
    this.agentManager = agentManager;
    this.userService = new UserService();
  }

  /**
   * Create a friend user account and spawn their custom agent
   */
  async createFriendWithAgent(
    adminUserId: string,
    friendData: {
      email: string;
      username: string;
      password: string;
      displayName?: string;
    },
    agentRequest: Omit<FriendAgentRequest, 'friendUserId'>
  ): Promise<{ user: any; agent: any }> {
    // Verify admin
    const admin = this.userService.getUserById(adminUserId);
    if (!admin || admin.is_admin !== 1) {
      throw new Error('Only admins can create friend accounts');
    }

    // Create friend user (not admin)
    const friendUser = await this.userService.createUser({
      ...friendData,
      isAdmin: false
    });

    // Spawn their agent
    const agent = await this.spawnFriendAgent({
      ...agentRequest,
      friendUserId: friendUser.id
    });

    return { user: friendUser, agent: agent.config };
  }

  /**
   * Spawn an agent for an existing friend user
   */
  async spawnFriendAgent(request: FriendAgentRequest) {
    const user = this.userService.getUserById(request.friendUserId);
    if (!user) throw new Error('Friend user not found');

    const systemPrompt = request.systemPrompt ||
      DEFAULT_FRIEND_PROMPT(user.display_name || user.username, request.allowedSkills);

    const agent = await this.agentManager.createAgent({
      name: request.agentName,
      description: request.description || `Personal agent for ${user.display_name || user.username}`,
      model: (request.model as any) || 'claude-sonnet-4-5-20250929',
      systemPrompt,
      temperature: request.temperature ?? 0.7,
      skills: request.allowedSkills,
      metadata: {
        type: 'friend-agent',
        friendUserId: request.friendUserId,
        friendUsername: user.username
      }
    }, request.friendUserId);

    return agent;
  }

  /**
   * Update a friend agent's allowed skills
   */
  async updateFriendAgentSkills(agentId: string, allowedSkills: string[]): Promise<void> {
    await this.agentManager.updateAgent(agentId, {
      skills: allowedSkills
    });
  }

  /**
   * List all friend agents (for admin dashboard)
   */
  listFriendAgents(): any[] {
    const allAgents = this.agentManager.getAllAgents();
    return allAgents
      .filter(a => a.config.metadata?.type === 'friend-agent')
      .map(a => ({
        id: a.config.id,
        name: a.config.name,
        friendUserId: a.config.metadata?.friendUserId,
        friendUsername: a.config.metadata?.friendUsername,
        skills: a.config.skills,
        running: a.isRunning(),
        createdAt: a.config.createdAt
      }));
  }
}
