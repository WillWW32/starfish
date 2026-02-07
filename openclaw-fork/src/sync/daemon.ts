import fs from 'fs';
import path from 'path';
import { ingestKnowledgeFile, ingestPdfFile, getAgentKnowledge } from '../memory/knowledgeManager.js';

interface SyncState {
  intervalId: NodeJS.Timeout;
  folderPath: string;
  intervalSeconds: number;
  processedFiles: Set<string>;
  lastScan: string;
  filesIngested: number;
}

const activeSyncs: Map<string, SyncState> = new Map();

// File extensions we can ingest
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'json', 'csv', 'html', 'xml', 'yaml', 'yml', 'js', 'ts', 'py', 'sh', 'log']);
const PDF_EXTENSION = 'pdf';

/**
 * Start watching a folder for new files and auto-ingest into agent's knowledge base.
 */
export function startSyncDaemon(
  agentId: string,
  folderPath: string,
  intervalSeconds: number,
  agentManager: any
): void {
  // Stop existing daemon for this agent if any
  stopSyncDaemon(agentId);

  const resolvedPath = path.resolve(folderPath);
  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Folder does not exist: ${resolvedPath}`);
  }

  const state: SyncState = {
    intervalId: null as any,
    folderPath: resolvedPath,
    intervalSeconds,
    processedFiles: new Set<string>(),
    lastScan: new Date().toISOString(),
    filesIngested: 0
  };

  // Initial scan — mark existing files as already processed
  const existingFiles = scanFolder(resolvedPath);
  for (const filePath of existingFiles) {
    state.processedFiles.add(filePath);
  }

  console.log(`  📂 Sync daemon started for ${agentId}: watching ${resolvedPath} (${existingFiles.length} existing files, interval: ${intervalSeconds}s)`);

  // Start polling
  state.intervalId = setInterval(async () => {
    try {
      const currentFiles = scanFolder(resolvedPath);
      const newFiles = currentFiles.filter(f => !state.processedFiles.has(f));

      for (const filePath of newFiles) {
        const filename = path.basename(filePath);
        const ext = filename.split('.').pop()?.toLowerCase() || '';

        try {
          if (ext === PDF_EXTENSION) {
            const buffer = fs.readFileSync(filePath);
            await ingestPdfFile(agentId, filename, buffer);
          } else if (TEXT_EXTENSIONS.has(ext)) {
            const content = fs.readFileSync(filePath, 'utf-8');
            await ingestKnowledgeFile(agentId, filename, content);
          } else {
            // Skip unsupported file types
            state.processedFiles.add(filePath);
            continue;
          }

          state.processedFiles.add(filePath);
          state.filesIngested++;
          console.log(`  📥 Sync daemon [${agentId}]: ingested ${filename}`);

          // Refresh agent knowledge cache
          const agent = agentManager.getAgent(agentId);
          if (agent) {
            agent.setKnowledge(getAgentKnowledge(agentId));
          }
        } catch (err: any) {
          console.warn(`  ⚠️ Sync daemon [${agentId}]: failed to ingest ${filename}: ${err.message}`);
          state.processedFiles.add(filePath); // Don't retry failed files
        }
      }

      state.lastScan = new Date().toISOString();
    } catch (err: any) {
      console.warn(`  ⚠️ Sync daemon [${agentId}]: scan error: ${err.message}`);
    }
  }, intervalSeconds * 1000);

  activeSyncs.set(agentId, state);
}

/**
 * Stop a running sync daemon for an agent.
 */
export function stopSyncDaemon(agentId: string): void {
  const state = activeSyncs.get(agentId);
  if (state) {
    clearInterval(state.intervalId);
    activeSyncs.delete(agentId);
    console.log(`  📂 Sync daemon stopped for ${agentId}`);
  }
}

/**
 * Get sync daemon status for an agent.
 */
export function getSyncStatus(agentId: string): {
  active: boolean;
  folderPath?: string;
  intervalSeconds?: number;
  processedCount?: number;
  filesIngested?: number;
  lastScan?: string;
} {
  const state = activeSyncs.get(agentId);
  if (!state) return { active: false };
  return {
    active: true,
    folderPath: state.folderPath,
    intervalSeconds: state.intervalSeconds,
    processedCount: state.processedFiles.size,
    filesIngested: state.filesIngested,
    lastScan: state.lastScan
  };
}

/**
 * Recursively scan a folder for ingestible files.
 */
function scanFolder(dir: string, maxDepth: number = 3, depth: number = 0): string[] {
  if (depth >= maxDepth) return [];
  const results: string[] = [];

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // Skip hidden files/dirs
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        results.push(...scanFolder(fullPath, maxDepth, depth + 1));
      } else if (entry.isFile()) {
        const ext = entry.name.split('.').pop()?.toLowerCase() || '';
        if (TEXT_EXTENSIONS.has(ext) || ext === PDF_EXTENSION) {
          results.push(fullPath);
        }
      }
    }
  } catch {
    // Permission errors, etc.
  }

  return results;
}
