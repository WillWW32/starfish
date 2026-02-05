import { Skill } from '../types.js';
import fs from 'fs/promises';
import path from 'path';

// Built-in skills
import { browserSkill } from './builtin/browser.js';
import { emailSkill } from './builtin/email.js';
import { socialSkill } from './builtin/social.js';
import { scraperSkill } from './builtin/scraper.js';
import { fileSkill } from './builtin/file.js';
import { httpSkill } from './builtin/http.js';
import { schedulerSkill } from './builtin/scheduler.js';
import { redditSkill } from './builtin/reddit.js';

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();

  async loadBuiltinSkills(): Promise<void> {
    const builtinSkills = [
      browserSkill,
      emailSkill,
      socialSkill,
      scraperSkill,
      fileSkill,
      httpSkill,
      schedulerSkill,
      redditSkill
    ];

    for (const skill of builtinSkills) {
      this.registerSkill(skill);
    }
  }

  async loadCustomSkills(skillsPath: string): Promise<void> {
    try {
      const files = await fs.readdir(skillsPath);
      for (const file of files) {
        if (file.endsWith('.js') || file.endsWith('.ts')) {
          try {
            const skillModule = await import(path.join(process.cwd(), skillsPath, file));
            if (skillModule.default && typeof skillModule.default === 'object') {
              this.registerSkill(skillModule.default as Skill);
            }
          } catch (err) {
            console.warn(`Failed to load skill from ${file}:`, err);
          }
        }
      }
    } catch (err) {
      // Skills directory doesn't exist, that's fine
    }
  }

  registerSkill(skill: Skill): void {
    this.skills.set(skill.id, skill);
    console.log(`  📦 Registered skill: ${skill.name}`);
  }

  unregisterSkill(skillId: string): void {
    this.skills.delete(skillId);
  }

  getSkill(skillId: string): Skill | undefined {
    return this.skills.get(skillId);
  }

  getAllSkills(): Skill[] {
    return Array.from(this.skills.values());
  }

  getEnabledSkills(): Skill[] {
    return this.getAllSkills().filter(s => s.enabled);
  }

  count(): number {
    return this.skills.size;
  }

  async uploadSkills(files: { filename: string; content: Buffer }[]): Promise<{ success: string[]; failed: string[] }> {
    const success: string[] = [];
    const failed: string[] = [];

    for (const file of files) {
      try {
        // Write to custom skills directory
        const skillsDir = './skills/custom';
        await fs.mkdir(skillsDir, { recursive: true });

        const filePath = path.join(skillsDir, file.filename);
        await fs.writeFile(filePath, file.content);

        // Try to load and register
        const skillModule = await import(path.join(process.cwd(), filePath));
        if (skillModule.default) {
          this.registerSkill(skillModule.default);
          success.push(file.filename);
        } else {
          failed.push(file.filename);
        }
      } catch (err) {
        failed.push(file.filename);
      }
    }

    return { success, failed };
  }
}
