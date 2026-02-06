import fs from 'fs/promises';
import path from 'path';

export interface StarfishConfig {
  server: {
    port: number;
    host: string;
  };
  llm: {
    defaultModel: string;
    anthropicApiKey?: string;
    openaiApiKey?: string;
  };
  channels: Record<string, any>;
  skillsPath: string;
  agentsPath: string;
  dataPath: string;
}

const defaultConfig: StarfishConfig = {
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  llm: {
    defaultModel: 'claude-sonnet-4-5-20250929'
  },
  channels: {
    imessage: {
      type: 'bluebubbles',
      enabled: false,
      url: process.env.BLUEBUBBLES_URL,
      token: process.env.BLUEBUBBLES_TOKEN
    },
    telegram: {
      type: 'telegram',
      enabled: false,
      token: process.env.TELEGRAM_BOT_TOKEN
    },
    api: {
      type: 'api',
      enabled: true
    }
  },
  skillsPath: './skills',
  agentsPath: './agents',
  dataPath: './data'
};

export async function loadConfig(configPath?: string): Promise<StarfishConfig> {
  const filePath = configPath || process.env.CONFIG_PATH || './config.json';

  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const fileConfig = JSON.parse(content);
    return mergeConfig(defaultConfig, fileConfig);
  } catch {
    // No config file, use defaults + env vars
    return applyEnvVars(defaultConfig);
  }
}

function mergeConfig(base: StarfishConfig, override: Partial<StarfishConfig>): StarfishConfig {
  return {
    ...base,
    ...override,
    server: { ...base.server, ...override.server },
    llm: { ...base.llm, ...override.llm },
    channels: { ...base.channels, ...override.channels }
  };
}

function applyEnvVars(config: StarfishConfig): StarfishConfig {
  return {
    ...config,
    server: {
      port: parseInt(process.env.PORT || String(config.server.port)),
      host: process.env.HOST || config.server.host
    },
    llm: {
      ...config.llm,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      openaiApiKey: process.env.OPENAI_API_KEY
    },
    channels: {
      ...config.channels,
      imessage: {
        ...config.channels.imessage,
        enabled: !!process.env.BLUEBUBBLES_URL,
        url: process.env.BLUEBUBBLES_URL,
        token: process.env.BLUEBUBBLES_TOKEN
      },
      telegram: {
        ...config.channels.telegram,
        enabled: !!process.env.TELEGRAM_BOT_TOKEN,
        token: process.env.TELEGRAM_BOT_TOKEN
      }
    }
  };
}

export async function saveConfig(config: StarfishConfig, configPath?: string): Promise<void> {
  const filePath = configPath || './config.json';
  await fs.writeFile(filePath, JSON.stringify(config, null, 2));
}
