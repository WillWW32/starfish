import axios, { AxiosInstance } from 'axios';
import crypto from 'crypto';

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

// Generate JWT token for Kling API (HS256)
function generateKlingJWT(accessKey: string, secretKey: string): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: accessKey,
    exp: now + 1800, // 30 minutes
    nbf: now - 5,    // 5s buffer for clock skew
  };

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');

  const headerB64 = encode(header);
  const payloadB64 = encode(payload);
  const signature = crypto
    .createHmac('sha256', secretKey)
    .update(`${headerB64}.${payloadB64}`)
    .digest('base64url');

  return `${headerB64}.${payloadB64}.${signature}`;
}

export class KlingAPI {
  private accessKey: string;
  private secretKey: string;

  constructor() {
    this.accessKey = process.env.KLING_ACCESS_KEY || '';
    this.secretKey = process.env.KLING_SECRET_KEY || '';
    if (!this.accessKey || !this.secretKey) {
      throw new Error('KLING_ACCESS_KEY and KLING_SECRET_KEY not configured');
    }
  }

  private getClient(): AxiosInstance {
    const token = generateKlingJWT(this.accessKey, this.secretKey);
    return axios.create({
      baseURL: 'https://api.klingai.com/v1',
      headers: {
        'Authorization': `Bearer ${token}`,
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

    const client = this.getClient();
    const { data } = await client.post(endpoint, payload);
    return data.data?.task_id;
  }

  async getGenerationStatus(taskId: string): Promise<KlingGenerationStatus> {
    const client = this.getClient();
    const { data } = await client.get(`/videos/text2video/${taskId}`);
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
