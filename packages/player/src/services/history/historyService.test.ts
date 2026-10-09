import { describe, expect, it } from 'vitest';

import type { Track } from '@nuclearplayer/model';

import { buildSnapshot } from './historyService';

describe('historyService buildSnapshot', () => {
  it('builds a snapshot from a well-formed track', () => {
    const track: Track = {
      title: 'Karma Police',
      artists: [
        {
          name: 'Radiohead',
          roles: [],
          source: { provider: 'test', id: 'rh-1' },
        },
      ],
      album: {
        title: 'OK Computer',
        source: { provider: 'test', id: 'ok-1' },
      },
      durationMs: 261000,
      source: { provider: 'youtube', id: 'karma-1' },
    };

    const snapshot = buildSnapshot(track);
    expect(snapshot.title).toBe('Karma Police');
    expect(snapshot.artists).toEqual(['Radiohead']);
    expect(snapshot.albumTitle).toBe('OK Computer');
    expect(snapshot.durationMs).toBe(261000);
    expect(snapshot.provider).toBe('youtube');
    expect(snapshot.providerId).toBe('karma-1');
  });

  it('defensively handles missing artists', () => {
    const track = {
      title: 'Track Without Artists',
      source: { provider: 'local', id: 'file-1' },
    } as unknown as Track;

    const snapshot = buildSnapshot(track);
    expect(snapshot.artists).toEqual([]);
    expect(snapshot.provider).toBe('local');
    expect(snapshot.providerId).toBe('file-1');
  });

  it('defensively handles string artists', () => {
    const track = {
      title: 'String Artist Track',
      artists: 'Solo Artist',
      source: { provider: 'local', id: 'file-2' },
    } as unknown as Track;

    const snapshot = buildSnapshot(track);
    expect(snapshot.artists).toEqual(['Solo Artist']);
  });

  it('defensively handles missing source', () => {
    const track = {
      title: 'No Source Track',
      artists: [{ name: 'Artist' }],
    } as unknown as Track;

    const snapshot = buildSnapshot(track);
    expect(snapshot.provider).toBe('unknown');
    expect(snapshot.providerId).toBe('');
    expect(snapshot.artists).toEqual(['Artist']);
  });
});
