import axios, { AxiosInstance } from 'axios';

export interface KlingGenerationRequest {
  prompt: string;
  negative_prompt?: string;
  mode?: 'standard' | 'professional';
  duration?: 5 | 10;
  aspect_ratio?: '16:9' | '9:16' | '1:1';
  image_url?: string; // For image-to-video
}

export interface KlingGenerationStatus {
  task_id: string;
  status: 'submitted' | 'processing' | 'completed' | 'failed';
  video_url?: string;
  thumbnail_url?: string;
  duration?: number;
  error?: string;
}

export class KlingAPI {
  private client: AxiosInstance;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.KLING_API_KEY;
    if (!key) throw new Error('KLING_API_KEY not configured');

    this.client = axios.create({
      baseURL: 'https://api.klingai.com/v1',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      }
    });
  }

  async generateVideo(request: KlingGenerationRequest): Promise<string> {
    const endpoint = request.image_url
      ? '/videos/image2video'
      : '/videos/text2video';

    const payload: any = {
      prompt: request.prompt,
      negative_prompt: request.negative_prompt || '',
      cfg_scale: 0.5,
      mode: request.mode || 'standard',
      duration: String(request.duration || 5),
      aspect_ratio: request.aspect_ratio || '16:9'
    };

    if (request.image_url) {
      payload.image = request.image_url;
    }

    const { data } = await this.client.post(endpoint, payload);
    return data.data?.task_id;
  }

  async getGenerationStatus(taskId: string): Promise<KlingGenerationStatus> {
    const { data } = await this.client.get(`/videos/text2video/${taskId}`);
    const task = data.data;

    return {
      task_id: taskId,
      status: task?.task_status || 'processing',
      video_url: task?.task_result?.videos?.[0]?.url,
      thumbnail_url: task?.task_result?.videos?.[0]?.thumbnail,
      duration: task?.task_result?.videos?.[0]?.duration,
      error: task?.task_status_msg
    };
  }
}
