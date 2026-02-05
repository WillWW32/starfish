import 'dotenv/config';
import { startServer } from './api/server.js';
import { AgentManager } from './agents/manager.js';
import { SkillRegistry } from './skills/registry.js';
import { ChannelManager } from './channels/manager.js';
import { loadConfig } from './utils/config.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function main() {
  console.log('🐙 Starting Starfish Agent System...');

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
    await server.close();
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('❌ Failed to start Starfish:', err);
  process.exit(1);
});
