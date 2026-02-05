import { Skill } from '../../types.js';
import axios, { AxiosRequestConfig, Method } from 'axios';

export const httpSkill: Skill = {
  id: 'http',
  name: 'HTTP Requests',
  description: 'Make HTTP requests to any API. Supports all methods, headers, auth, and body types. No rate limits.',
  version: '1.0.0',
  enabled: true,
  parameters: {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        default: 'GET',
        description: 'HTTP method'
      },
      url: { type: 'string', description: 'Request URL' },
      headers: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'Request headers'
      },
      body: {
        oneOf: [
          { type: 'string' },
          { type: 'object' }
        ],
        description: 'Request body (auto JSON stringify for objects)'
      },
      params: {
        type: 'object',
        additionalProperties: { type: 'string' },
        description: 'URL query parameters'
      },
      auth: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['basic', 'bearer', 'api_key'] },
          username: { type: 'string' },
          password: { type: 'string' },
          token: { type: 'string' },
          apiKey: { type: 'string' },
          apiKeyHeader: { type: 'string', default: 'X-API-Key' }
        },
        description: 'Authentication config'
      },
      timeout: { type: 'number', default: 30000, description: 'Request timeout in ms' },
      followRedirects: { type: 'boolean', default: true },
      responseType: {
        type: 'string',
        enum: ['json', 'text', 'arraybuffer', 'blob', 'stream'],
        default: 'json'
      }
    },
    required: ['url']
  },
  execute: async (params: any) => {
    const { method = 'GET', url, headers = {}, body, params: queryParams, auth, timeout = 30000, followRedirects = true, responseType = 'json' } = params;

    const config: AxiosRequestConfig = {
      method: method as Method,
      url,
      headers: { ...headers },
      params: queryParams,
      timeout,
      maxRedirects: followRedirects ? 5 : 0,
      responseType
    };

    // Handle body
    if (body) {
      if (typeof body === 'object') {
        config.data = body;
        config.headers!['Content-Type'] = config.headers!['Content-Type'] || 'application/json';
      } else {
        config.data = body;
      }
    }

    // Handle auth
    if (auth) {
      switch (auth.type) {
        case 'basic':
          config.auth = { username: auth.username, password: auth.password };
          break;
        case 'bearer':
          config.headers!['Authorization'] = `Bearer ${auth.token}`;
          break;
        case 'api_key':
          config.headers![auth.apiKeyHeader || 'X-API-Key'] = auth.apiKey;
          break;
      }
    }

    try {
      const response = await axios(config);

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      };
    } catch (error: any) {
      if (error.response) {
        return {
          success: false,
          status: error.response.status,
          statusText: error.response.statusText,
          headers: error.response.headers,
          data: error.response.data,
          error: error.message
        };
      }
      throw error;
    }
  }
};
