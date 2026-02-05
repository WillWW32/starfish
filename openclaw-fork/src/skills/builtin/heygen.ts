import { Skill } from '../../types.js';
import { HeyGenAPI } from '../../integrations/heygen-api.js';

let api: HeyGenAPI | null = null;

function getApi(): HeyGenAPI {
  if (!api) api = new HeyGenAPI();
  return api;
}

export const heygenSkill: Skill = {
  id: 'heygen',
  name: 'HeyGen Video',
  description: 'Create AI avatar videos using HeyGen. Generate talking-head videos with custom scripts.',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create_video', 'list_avatars', 'list_voices', 'get_video_status'],
        description: 'The action to perform'
      },
      avatar_id: { type: 'string', description: 'Avatar ID for video creation' },
      voice_id: { type: 'string', description: 'Voice ID for video creation' },
      script: { type: 'string', description: 'Script text for the avatar to speak' },
      title: { type: 'string', description: 'Video title' },
      video_id: { type: 'string', description: 'Video ID for status check' },
      ratio: { type: 'string', enum: ['16:9', '9:16', '1:1'], description: 'Video aspect ratio' },
      background: { type: 'string', description: 'Background color hex code' }
    },
    required: ['action']
  },
  execute: async (params: any) => {
    const heygen = getApi();

    switch (params.action) {
      case 'list_avatars': {
        const avatars = await heygen.listAvatars();
        return { avatars: avatars.slice(0, 20) }; // Limit for context
      }

      case 'list_voices': {
        const voices = await heygen.listVoices();
        return { voices: voices.slice(0, 20) };
      }

      case 'create_video': {
        if (!params.avatar_id || !params.script) {
          return { error: 'avatar_id and script are required' };
        }
        const videoId = await heygen.createVideo({
          avatar_id: params.avatar_id,
          voice_id: params.voice_id,
          script: params.script,
          title: params.title,
          ratio: params.ratio,
          background: params.background
        });
        return { video_id: videoId, status: 'processing', message: 'Video creation started. Use get_video_status to check progress.' };
      }

      case 'get_video_status': {
        if (!params.video_id) return { error: 'video_id is required' };
        const status = await heygen.getVideoStatus(params.video_id);
        return status;
      }

      default:
        return { error: `Unknown action: ${params.action}` };
    }
  }
};
