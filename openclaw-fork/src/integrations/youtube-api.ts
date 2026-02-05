import axios, { AxiosInstance } from 'axios';
import fs from 'fs';
import path from 'path';

export interface YouTubeUploadRequest {
  filePath: string;
  title: string;
  description: string;
  tags?: string[];
  categoryId?: string; // Default: 22 (People & Blogs)
  privacyStatus?: 'public' | 'unlisted' | 'private';
  playlistId?: string;
}

export interface YouTubeVideo {
  videoId: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  status: string;
}

export interface YouTubePlaylist {
  playlistId: string;
  title: string;
  description: string;
  itemCount: number;
}

export class YouTubeAPI {
  private accessToken: string = '';
  private refreshToken: string;
  private clientId: string;
  private clientSecret: string;

  constructor() {
    this.clientId = process.env.YOUTUBE_CLIENT_ID || '';
    this.clientSecret = process.env.YOUTUBE_CLIENT_SECRET || '';
    this.refreshToken = process.env.YOUTUBE_REFRESH_TOKEN || '';

    if (!this.clientId || !this.clientSecret || !this.refreshToken) {
      console.warn('YouTube API credentials not fully configured');
    }
  }

  /**
   * Refresh the OAuth2 access token
   */
  private async ensureAccessToken(): Promise<void> {
    if (this.accessToken) return; // Simplistic — should check expiry

    const { data } = await axios.post('https://oauth2.googleapis.com/token', {
      client_id: this.clientId,
      client_secret: this.clientSecret,
      refresh_token: this.refreshToken,
      grant_type: 'refresh_token'
    });

    this.accessToken = data.access_token;
  }

  private async getClient(): Promise<AxiosInstance> {
    await this.ensureAccessToken();
    return axios.create({
      baseURL: 'https://www.googleapis.com/youtube/v3',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`
      }
    });
  }

  /**
   * Upload video using resumable upload protocol
   */
  async uploadVideo(request: YouTubeUploadRequest): Promise<string> {
    await this.ensureAccessToken();

    // Step 1: Initiate resumable upload
    const metadata = {
      snippet: {
        title: request.title,
        description: request.description,
        tags: request.tags || [],
        categoryId: request.categoryId || '22'
      },
      status: {
        privacyStatus: request.privacyStatus || 'private',
        selfDeclaredMadeForKids: false
      }
    };

    const initResponse = await axios.post(
      'https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status',
      metadata,
      {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
          'X-Upload-Content-Type': 'video/*'
        }
      }
    );

    const uploadUrl = initResponse.headers.location;
    if (!uploadUrl) throw new Error('Failed to get upload URL');

    // Step 2: Upload the video file
    const fileStream = fs.createReadStream(request.filePath);
    const fileStats = fs.statSync(request.filePath);

    const uploadResponse = await axios.put(uploadUrl, fileStream, {
      headers: {
        'Content-Type': 'video/*',
        'Content-Length': fileStats.size.toString()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    });

    const videoId = uploadResponse.data?.id;

    // Step 3: Add to playlist if specified
    if (request.playlistId && videoId) {
      await this.addToPlaylist(request.playlistId, videoId);
    }

    return videoId;
  }

  /**
   * Update video metadata
   */
  async updateVideoMetadata(videoId: string, updates: {
    title?: string;
    description?: string;
    tags?: string[];
    categoryId?: string;
  }): Promise<void> {
    const client = await this.getClient();

    const body: any = {
      id: videoId,
      snippet: {}
    };

    if (updates.title) body.snippet.title = updates.title;
    if (updates.description) body.snippet.description = updates.description;
    if (updates.tags) body.snippet.tags = updates.tags;
    if (updates.categoryId) body.snippet.categoryId = updates.categoryId;

    await client.put('/videos?part=snippet', body);
  }

  /**
   * List videos on the channel
   */
  async listVideos(maxResults: number = 25): Promise<YouTubeVideo[]> {
    const client = await this.getClient();

    // Get channel's uploads playlist
    const channelRes = await client.get('/channels?part=contentDetails&mine=true');
    const uploadsPlaylistId = channelRes.data.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;

    if (!uploadsPlaylistId) return [];

    const { data } = await client.get(`/playlistItems?part=snippet,status&playlistId=${uploadsPlaylistId}&maxResults=${maxResults}`);

    return (data.items || []).map((item: any) => ({
      videoId: item.snippet.resourceId.videoId,
      title: item.snippet.title,
      description: item.snippet.description,
      publishedAt: item.snippet.publishedAt,
      thumbnailUrl: item.snippet.thumbnails?.high?.url || '',
      status: item.status?.privacyStatus || 'unknown'
    }));
  }

  /**
   * Get video analytics
   */
  async getVideoAnalytics(videoId: string): Promise<any> {
    await this.ensureAccessToken();

    const { data } = await axios.get(
      `https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=2020-01-01&endDate=2030-01-01&metrics=views,likes,comments,estimatedMinutesWatched&dimensions=video&filters=video==${videoId}`,
      { headers: { 'Authorization': `Bearer ${this.accessToken}` } }
    );

    return data.rows?.[0] || null;
  }

  /**
   * Create a playlist
   */
  async createPlaylist(title: string, description: string, privacyStatus: string = 'public'): Promise<string> {
    const client = await this.getClient();

    const { data } = await client.post('/playlists?part=snippet,status', {
      snippet: { title, description },
      status: { privacyStatus }
    });

    return data.id;
  }

  /**
   * Add video to playlist
   */
  async addToPlaylist(playlistId: string, videoId: string): Promise<void> {
    const client = await this.getClient();

    await client.post('/playlistItems?part=snippet', {
      snippet: {
        playlistId,
        resourceId: { kind: 'youtube#video', videoId }
      }
    });
  }

  /**
   * List playlists
   */
  async listPlaylists(): Promise<YouTubePlaylist[]> {
    const client = await this.getClient();
    const { data } = await client.get('/playlists?part=snippet,contentDetails&mine=true&maxResults=50');

    return (data.items || []).map((item: any) => ({
      playlistId: item.id,
      title: item.snippet.title,
      description: item.snippet.description,
      itemCount: item.contentDetails.itemCount
    }));
  }
}
