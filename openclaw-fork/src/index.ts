import 'dotenv/config';
import { startServer } from './api/server.js';
import { AgentManager } from './agents/manager.js';
import { SkillRegistry } from './skills/registry.js';
import { ChannelManager } from './channels/manager.js';
import { loadConfig } from './utils/config.js';
import { getDatabase, closeDatabase } from './db/database.js';
import { UserService } from './users/service.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

function validateEnvVars(): void {
  const required: Record<string, string[]> = {
    'Core LLM': ['ANTHROPIC_API_KEY'],
    'Auth': ['JWT_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD']
  };
  const optional: Record<string, string[]> = {
    'Email (Resend)': ['RESEND_API_KEY'],
    'Email (SMTP)': ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'],
    'HeyGen Video': ['HEYGEN_API_KEY'],
    'Kling Video': ['KLING_API_KEY'],
    'Typefully': ['TYPEFULLY_API_KEY'],
    'Reddit Proxy': ['BRIGHTDATA_PROXY_SERVER', 'BRIGHTDATA_PROXY_USER', 'BRIGHTDATA_PROXY_PASS'],
    'YouTube': ['YOUTUBE_CLIENT_ID', 'YOUTUBE_CLIENT_SECRET', 'YOUTUBE_REFRESH_TOKEN'],
    'Telegram': ['TELEGRAM_BOT_TOKEN'],
    'iMessage': ['BLUEBUBBLES_URL', 'BLUEBUBBLES_TOKEN']
  };

  console.log('🔑 Environment variable check:');
  for (const [group, vars] of Object.entries(required)) {
    const missing = vars.filter(v => !process.env[v]);
    if (missing.length > 0) {
      console.error(`  ❌ ${group}: MISSING [${missing.join(', ')}]`);
    } else {
      console.log(`  ✅ ${group}: all set`);
    }
  }

  const enabledSkills: string[] = [];
  const disabledSkills: string[] = [];
  for (const [group, vars] of Object.entries(optional)) {
    const set = vars.filter(v => !!process.env[v]);
    if (set.length === vars.length) {
      enabledSkills.push(group);
    } else if (set.length > 0) {
      console.warn(`  ⚠️ ${group}: partial [${vars.filter(v => !process.env[v]).join(', ')} missing]`);
    } else {
      disabledSkills.push(group);
    }
  }
  if (enabledSkills.length > 0) console.log(`  ✅ Skills ready: ${enabledSkills.join(', ')}`);
  if (disabledSkills.length > 0) console.log(`  ⏭️ Skills without keys: ${disabledSkills.join(', ')}`);
}

async function main() {
  console.log('🐙 Starting Starfish Agent System...');

  // Validate environment variables
  validateEnvVars();

  // Initialize database + knowledge tables
  getDatabase();
  const { initKnowledgeTables } = await import('./memory/knowledgeStore.js');
  initKnowledgeTables();
  const { initLeadsTables } = await import('./leads/store.js');
  initLeadsTables();
  console.log('✅ Database initialized');

  // Bootstrap admin user if none exists
  const userService = new UserService();
  const users = userService.getAllUsers();
  if (users.length === 0) {
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@starfish.local';
    const adminPassword = process.env.ADMIN_PASSWORD || 'changeme123';
    await userService.createUser({
      email: adminEmail,
      username: 'admin',
      password: adminPassword,
      isAdmin: true,
      displayName: 'Admin'
    });
    console.log(`🔑 Created admin user: ${adminEmail} (change password immediately!)`);
  }

  // Initialize core systems
  const config = await loadConfig();

  // Initialize skill registry with all available skills
  const skillRegistry = new SkillRegistry();
  await skillRegistry.loadBuiltinSkills();
  await skillRegistry.loadCustomSkills(config.skillsPath || './skills');
  console.log(`✅ Loaded ${skillRegistry.count()} skills`);

  // Initialize channel manager (iMessage, etc.)
  const channelManager = new ChannelManager();
  await channelManager.initialize(config.channels || {});
  console.log(`✅ Initialized ${channelManager.count()} channels`);

  // Initialize agent manager
  const agentManager = new AgentManager(skillRegistry, channelManager);
  await agentManager.loadAgents(config.agentsPath || './agents');
  console.log(`✅ Loaded ${agentManager.count()} agents`);

  // Load knowledge bases for all agents
  const { getAgentKnowledge } = await import('./memory/knowledgeManager.js');
  for (const agent of agentManager.getAllAgents()) {
    const knowledge = getAgentKnowledge(agent.config.id);
    if (knowledge) {
      (agent as any).setKnowledge(knowledge);
      console.log(`  📚 ${agent.config.name}: Knowledge loaded`);
    }
  }

  // Bind agents to their configured channels
  for (const agent of agentManager.getAllAgents()) {
    const agentChannels = agent.config.channels || {};
    for (const [channelName, channelCfg] of Object.entries(agentChannels)) {
      if (channelCfg && (channelCfg as any).enabled !== false) {
        channelManager.registerAgent(channelName, agent);
        console.log(`  🔗 Bound ${agent.config.name} → ${channelName}`);
      }
    }
  }

  // Start API server
  const server = await startServer({
    port: PORT,
    agentManager,
    skillRegistry,
    channelManager
  });

  console.log(`🚀 Starfish API running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard API: http://localhost:${PORT}/api`);
  console.log(`💬 Ready for messages via configured channels`);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await agentManager.stopAll();
    await channelManager.disconnectAll();
    closeDatabase();
    await server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('❌ Failed to start Starfish:', err);
  process.exit(1);
});
