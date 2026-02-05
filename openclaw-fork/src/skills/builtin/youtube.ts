import { Skill } from '../../types.js';
import { YouTubeAPI } from '../../integrations/youtube-api.js';

let api: YouTubeAPI | null = null;

function getApi(): YouTubeAPI {
  if (!api) api = new YouTubeAPI();
  return api;
}

export const youtubeSkill: Skill = {
  id: 'youtube',
  name: 'YouTube',
  description: 'Upload videos to YouTube, manage playlists, update metadata, and view analytics.',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['upload_video', 'update_metadata', 'list_videos', 'get_analytics', 'create_playlist', 'add_to_playlist', 'list_playlists'],
        description: 'The action to perform'
      },
      file_path: { type: 'string', description: 'Local path to video file for upload' },
      title: { type: 'string', description: 'Video or playlist title' },
      description: { type: 'string', description: 'Video or playlist description' },
      tags: { type: 'array', items: { type: 'string' }, description: 'Video tags' },
      privacy_status: { type: 'string', enum: ['public', 'unlisted', 'private'], description: 'Video privacy setting' },
      video_id: { type: 'string', description: 'YouTube video ID' },
      playlist_id: { type: 'string', description: 'YouTube playlist ID' },
      max_results: { type: 'number', description: 'Maximum results to return' }
    },
    required: ['action']
  },
  execute: async (params: any) => {
    const youtube = getApi();

    switch (params.action) {
      case 'upload_video': {
        if (!params.file_path || !params.title) {
          return { error: 'file_path and title are required' };
        }
        const videoId = await youtube.uploadVideo({
          filePath: params.file_path,
          title: params.title,
          description: params.description || '',
          tags: params.tags,
          privacyStatus: params.privacy_status || 'private',
          playlistId: params.playlist_id
        });
        return { video_id: videoId, url: `https://youtube.com/watch?v=${videoId}`, message: 'Video uploaded successfully' };
      }

      case 'update_metadata': {
        if (!params.video_id) return { error: 'video_id is required' };
        await youtube.updateVideoMetadata(params.video_id, {
          title: params.title,
          description: params.description,
          tags: params.tags
        });
        return { updated: true };
      }

      case 'list_videos': {
        const videos = await youtube.listVideos(params.max_results || 25);
        return { videos, count: videos.length };
      }

      case 'get_analytics': {
        if (!params.video_id) return { error: 'video_id is required' };
        const analytics = await youtube.getVideoAnalytics(params.video_id);
        return { analytics };
      }

      case 'create_playlist': {
        if (!params.title) return { error: 'title is required' };
        const playlistId = await youtube.createPlaylist(
          params.title,
          params.description || '',
          params.privacy_status || 'public'
        );
        return { playlist_id: playlistId, message: 'Playlist created' };
      }

      case 'add_to_playlist': {
        if (!params.playlist_id || !params.video_id) {
          return { error: 'playlist_id and video_id are required' };
        }
        await youtube.addToPlaylist(params.playlist_id, params.video_id);
        return { added: true };
      }

      case 'list_playlists': {
        const playlists = await youtube.listPlaylists();
        return { playlists, count: playlists.length };
      }

      default:
        return { error: `Unknown action: ${params.action}` };
    }
  }
};
