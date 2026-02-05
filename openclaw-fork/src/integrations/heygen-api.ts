import axios, { AxiosInstance } from 'axios';

export interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender: string;
  preview_image_url: string;
}

export interface HeyGenVoice {
  voice_id: string;
  language: string;
  gender: string;
  name: string;
}

export interface HeyGenVideoRequest {
  avatar_id: string;
  voice_id?: string;
  script: string;
  title?: string;
  background?: string;
  ratio?: '16:9' | '9:16' | '1:1';
}

export interface HeyGenVideoStatus {
  video_id: string;
  status: 'processing' | 'completed' | 'failed';
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  error?: string;
}

export class HeyGenAPI {
  private client: AxiosInstance;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.HEYGEN_API_KEY;
    if (!key) throw new Error('HEYGEN_API_KEY not configured');

    this.client = axios.create({
      baseURL: 'https://api.heygen.com/v2',
      headers: {
        'X-Api-Key': key,
        'Content-Type': 'application/json'
      }
    });
  }

  async listAvatars(): Promise<HeyGenAvatar[]> {
    const { data } = await this.client.get('/avatars');
    return data.data?.avatars || [];
  }

  async listVoices(): Promise<HeyGenVoice[]> {
    const { data } = await this.client.get('/voices');
    return data.data?.voices || [];
  }

  async createVideo(request: HeyGenVideoRequest): Promise<string> {
    const payload = {
      video_inputs: [{
        character: {
          type: 'avatar',
          avatar_id: request.avatar_id,
          avatar_style: 'normal'
        },
        voice: request.voice_id ? {
          type: 'text',
          input_text: request.script,
          voice_id: request.voice_id
        } : {
          type: 'text',
          input_text: request.script
        },
        background: request.background ? {
          type: 'color',
          value: request.background
        } : undefined
      }],
      dimension: request.ratio === '9:16'
        ? { width: 1080, height: 1920 }
        : request.ratio === '1:1'
        ? { width: 1080, height: 1080 }
        : { width: 1920, height: 1080 },
      title: request.title
    };

    const { data } = await this.client.post('/video/generate', payload);
    return data.data?.video_id;
  }

  async getVideoStatus(videoId: string): Promise<HeyGenVideoStatus> {
    const { data } = await this.client.get(`/video_status.get?video_id=${videoId}`);
    const video = data.data;
    return {
      video_id: videoId,
      status: video?.status || 'processing',
      video_url: video?.video_url,
      thumbnail_url: video?.thumbnail_url,
      duration: video?.duration,
      error: video?.error
    };
  }
}
