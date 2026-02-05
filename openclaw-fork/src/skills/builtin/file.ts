import { Skill } from '../../types.js';
import fs from 'fs/promises';
import path from 'path';

export const fileSkill: Skill = {
  id: 'file',
  name: 'File Operations',
  description: 'Read, write, list, and manage files on the server filesystem.',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['read', 'write', 'append', 'delete', 'list', 'exists', 'mkdir', 'copy', 'move', 'stat'],
        description: 'File operation to perform'
      },
      path: { type: 'string', description: 'File or directory path' },
      content: { type: 'string', description: 'Content to write' },
      destination: { type: 'string', description: 'Destination path for copy/move' },
      encoding: { type: 'string', default: 'utf-8', description: 'File encoding' },
      recursive: { type: 'boolean', default: false, description: 'Recursive for mkdir/list' }
    },
    required: ['action', 'path']
  },
  execute: async (params: any) => {
    const { action, encoding = 'utf-8' } = params;
    const filePath = path.resolve(params.path);

    switch (action) {
      case 'read': {
        const content = await fs.readFile(filePath, encoding as BufferEncoding);
        return { success: true, path: filePath, content };
      }

      case 'write': {
        await fs.writeFile(filePath, params.content, encoding as BufferEncoding);
        return { success: true, path: filePath, bytes: params.content.length };
      }

      case 'append': {
        await fs.appendFile(filePath, params.content, encoding as BufferEncoding);
        return { success: true, path: filePath };
      }

      case 'delete': {
        await fs.unlink(filePath);
        return { success: true, path: filePath, deleted: true };
      }

      case 'list': {
        const entries = await fs.readdir(filePath, { withFileTypes: true });
        const files = entries.map((e) => ({
          name: e.name,
          isDirectory: e.isDirectory(),
          isFile: e.isFile()
        }));
        return { success: true, path: filePath, files };
      }

      case 'exists': {
        try {
          await fs.access(filePath);
          return { success: true, path: filePath, exists: true };
        } catch {
          return { success: true, path: filePath, exists: false };
        }
      }

      case 'mkdir': {
        await fs.mkdir(filePath, { recursive: params.recursive });
        return { success: true, path: filePath, created: true };
      }

      case 'copy': {
        const destPath = path.resolve(params.destination);
        await fs.copyFile(filePath, destPath);
        return { success: true, from: filePath, to: destPath };
      }

      case 'move': {
        const destPath = path.resolve(params.destination);
        await fs.rename(filePath, destPath);
        return { success: true, from: filePath, to: destPath };
      }

      case 'stat': {
        const stats = await fs.stat(filePath);
        return {
          success: true,
          path: filePath,
          size: stats.size,
          isFile: stats.isFile(),
          isDirectory: stats.isDirectory(),
          created: stats.birthtime,
          modified: stats.mtime
        };
      }

      default:
        throw new Error(`Unknown file action: ${action}`);
    }
  }
};
