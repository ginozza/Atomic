import type { Playlist } from '@nuclearplayer/model';
import type { PlaylistProvider, YtdlpThumbnail } from '@nuclearplayer/plugin-sdk';

import { ytdlpHost } from './ytdlpHost';

export const isYoutubePlaylistUrl = (url: string): boolean => {
  const trimmed = url.trim();
  if (
    trimmed.includes('youtube.com') ||
    trimmed.includes('youtu.be') ||
    trimmed.includes('music.youtube.com')
  ) {
    return trimmed.includes('list=') || trimmed.includes('/playlist');
  }
  return /^(PL|OLAK5uy_|UU|LL|FL|RD)[a-zA-Z0-9_-]+$/.test(trimmed);
};

const getBestThumbnailUrl = (
  thumbnails?: YtdlpThumbnail[],
  fallbackId?: string,
): string | undefined => {
  if (thumbnails && thumbnails.length > 0) {
    return thumbnails[thumbnails.length - 1]?.url;
  }
  return fallbackId ? `https://i.ytimg.com/vi/${fallbackId}/hq720.jpg` : undefined;
};

export const youtubePlaylistProvider: PlaylistProvider = {
  id: 'youtube-playlists',
  kind: 'playlists',
  name: 'YouTube',
  matchesUrl: isYoutubePlaylistUrl,
  fetchPlaylistByUrl: async (url: string): Promise<Playlist> => {
    const info = await ytdlpHost.getPlaylist(url);
    const now = new Date().toISOString();

    const firstCover = getBestThumbnailUrl(
      info.entries[0]?.thumbnails,
      info.entries[0]?.id,
    );

    return {
      id: info.id || url,
      name: info.title || 'YouTube Playlist',
      description: `Imported from YouTube (${info.entries.length} tracks)`,
      createdAtIso: now,
      lastModifiedIso: now,
      origin: { provider: 'youtube', id: info.id || url },
      isReadOnly: true,
      artwork: firstCover
        ? {
            items: [
              {
                url: firstCover,
                width: 1280,
                height: 720,
                purpose: 'cover',
              },
            ],
          }
        : undefined,
      items: info.entries.map((entry, index) => {
        const bestThumb = getBestThumbnailUrl(entry.thumbnails, entry.id);

        const artworkItems = [
          ...(bestThumb
            ? [
                {
                  url: bestThumb,
                  width: 1280,
                  height: 720,
                  purpose: 'cover' as const,
                },
              ]
            : []),
          ...((entry.thumbnails ?? []).map((thumb) => ({
            url: thumb.url,
            width: thumb.width ?? undefined,
            height: thumb.height ?? undefined,
            purpose: 'thumbnail' as const,
          }))),
        ];

        return {
          id: `${entry.id}-${index}`,
          addedAtIso: now,
          track: {
            title: entry.title,
            artists: [
              {
                name: entry.channel || 'Unknown Artist',
                roles: [],
                source: { provider: 'youtube', id: entry.id },
              },
            ],
            durationMs: entry.duration ? entry.duration * 1000 : 0,
            artwork: {
              items: artworkItems,
            },
            source: { provider: 'youtube', id: entry.id },
            streamCandidates: [
              {
                id: entry.id,
                title: entry.title,
                durationMs: entry.duration ? entry.duration * 1000 : undefined,
                failed: false,
                source: { provider: 'youtube', id: entry.id },
                stream: {
                  url: `https://www.youtube.com/watch?v=${entry.id}`,
                  container: 'youtube',
                  codec: 'youtube',
                  protocol: 'https' as const,
                  source: { provider: 'youtube', id: entry.id },
                  durationMs: entry.duration ? entry.duration * 1000 : undefined,
                },
                lastResolvedAtIso: now,
              },
            ],
          },
        };
      }),
    };
  },
};
