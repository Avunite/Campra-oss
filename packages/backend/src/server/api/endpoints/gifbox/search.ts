import { URLSearchParams } from 'node:url';
import fetch from 'node-fetch';
import config from '@/config/index.js';
import { getAgentByUrl } from '@/misc/fetch.js';
import { fetchMeta } from '@/misc/fetch-meta.js';
import { ApiError } from '../../error.js';
import define from '../../define.js';

export const meta = {
  tags: ['tenor'],
  requireCredential: true,
  requireCredentialPrivateMode: true,
  res: {
    type: 'array',
    optional: false,
    nullable: false,
    items: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        title: { type: 'string' },
        media_formats: { type: 'object' },
        created: { type: 'number' },
        content_description: { type: 'string' },
        itemurl: { type: 'string' },
        url: { type: 'string' },
      },
    },
  },
  errors: {
    noTenorKey: {
      message: 'Tenor API key is not set.',
      code: 'NO_TENOR_KEY',
      id: 'f0a3f3d0-8d86-4d4e-9a91-5e6a9e3a3f5e',
    },
  },
} as const;

export const paramDef = {
  type: 'object',
  properties: {
    query: { type: 'string' },
    limit: { type: 'number', minimum: 1, maximum: 50, default: 20 },
  },
  required: ['query'],
} as const;

export default define(meta, paramDef, async (ps, user) => {
  const instance = await fetchMeta();
  
  if (instance.gifboxAuthKey == null) {
    throw new ApiError(meta.errors.noTenorKey);
  }

  const params = new URLSearchParams({
    key: instance.gifboxAuthKey,
    q: ps.query,
    limit: ps.limit.toString(),
    media_filter: 'minimal',
  });

  const endpoint = 'https://tenor.googleapis.com/v2/search';
  const url = `${endpoint}?${params.toString()}`;

  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'User-Agent': config.userAgent,
      'Accept': 'application/json',
    },
    agent: getAgentByUrl,
  });

  if (!res.ok) {
    throw new Error(`Tenor API responded with status ${res.status}`);
  }

  const json = await res.json();
  return json.results;
});