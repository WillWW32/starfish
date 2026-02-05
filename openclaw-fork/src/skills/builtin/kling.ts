import { Skill } from '../../types.js';
import { KlingAPI } from '../../integrations/kling-api.js';

let api: KlingAPI | null = null;

function getApi(): KlingAPI {
  if (!api) api = new KlingAPI();
  return api;
}

export const klingSkill: Skill = {
  id: 'kling',
  name: 'Kling AI Video',
  description: 'Generate AI videos from text prompts or images using Kling AI.',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['generate_video', 'get_status'],
        description: 'The action to perform'
      },
      prompt: { type: 'string', description: 'Text description of the video to generate' },
      negative_prompt: { type: 'string', description: 'What to avoid in the video' },
      image_url: { type: 'string', description: 'Image URL for image-to-video generation' },
      mode: { type: 'string', enum: ['standard', 'professional'], description: 'Generation quality mode' },
      duration: { type: 'number', enum: [5, 10], description: 'Video duration in seconds' },
      aspect_ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'], description: 'Video aspect ratio' },
      task_id: { type: 'string', description: 'Task ID for status check' }
    },
    required: ['action']
  },
  execute: async (params: any) => {
    const kling = getApi();

    switch (params.action) {
      case 'generate_video': {
        if (!params.prompt) return { error: 'prompt is required' };
        const taskId = await kling.generateVideo({
          prompt: params.prompt,
          negative_prompt: params.negative_prompt,
          image_url: params.image_url,
          mode: params.mode,
          duration: params.duration,
          aspect_ratio: params.aspect_ratio
        });
        return { task_id: taskId, status: 'submitted', message: 'Video generation started. Use get_status to check progress.' };
      }

      case 'get_status': {
        if (!params.task_id) return { error: 'task_id is required' };
        const status = await kling.getGenerationStatus(params.task_id);
        return status;
      }

      default:
        return { error: `Unknown action: ${params.action}` };
    }
  }
};
