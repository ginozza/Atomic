import { describe, expect, it, vi } from 'vitest';

import {
  isYoutubePlaylistUrl,
  youtubePlaylistProvider,
} from './youtubePlaylistProvider';
import { ytdlpHost } from './ytdlpHost';

describe('youtubePlaylistProvider', () => {
  it('correctly identifies YouTube playlist URLs and IDs', () => {
    expect(
      isYoutubePlaylistUrl('https://www.youtube.com/playlist?list=PL12345'),
    ).toBe(true);
    expect(
      isYoutubePlaylistUrl(
        'https://music.youtube.com/playlist?list=PL12345&si=abc',
      ),
    ).toBe(true);
    expect(
      isYoutubePlaylistUrl(
        'https://youtu.be/watch?v=abc&list=PL12345',
      ),
    ).toBe(true);
    expect(isYoutubePlaylistUrl('PL1234567890abcdef')).toBe(true);
    expect(isYoutubePlaylistUrl('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M')).toBe(
      false,
    );
  });

  it('fetches and converts a YouTube playlist correctly', async () => {
    const mockPlaylistInfo = {
      id: 'PLtest',
      title: 'Awesome Hits',
      entries: [
        {
          id: 'v1',
          title: 'Track One',
          duration: 180,
          thumbnails: [{ url: 'https://img/v1.jpg', width: 480, height: 360 }],
          channel: 'Artist One',
        },
        {
          id: 'v2',
          title: 'Track Two',
          duration: null,
          thumbnails: [],
          channel: null,
        },
      ],
    };

    vi.spyOn(ytdlpHost, 'getPlaylist').mockResolvedValue(mockPlaylistInfo);

    const playlist = await youtubePlaylistProvider.fetchPlaylistByUrl(
      'https://www.youtube.com/playlist?list=PLtest',
    );

    expect(playlist.name).toBe('Awesome Hits');
    expect(playlist.items).toHaveLength(2);
    expect(playlist.items[0].track.title).toBe('Track One');
    expect(playlist.items[0].track.artists[0].name).toBe('Artist One');
    expect(playlist.items[0].track.durationMs).toBe(180000);
    expect(playlist.items[1].track.title).toBe('Track Two');
    expect(playlist.items[1].track.artists[0].name).toBe('Unknown Artist');
  });
});
