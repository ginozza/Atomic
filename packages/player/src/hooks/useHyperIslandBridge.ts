import { useEffect, useRef } from 'react';
import { pickArtwork } from '@nuclearplayer/model';
import { playbackManager } from '../services/playback';
import { useQueueStore } from '../stores/queueStore';
import { useSoundStore } from '../stores/soundStore';

declare global {
  interface Window {
    NuclearAndroid?: {
      updatePlayback: (
        title: string,
        artist: string,
        coverUrl: string,
        isPlaying: boolean,
        positionMs: number,
        durationMs: number
      ) => void;
      forceGC: () => void;
      isHyperOS: () => boolean;
      isHyperIslandSupported: () => boolean;
    };
  }
}

export const useHyperIslandBridge = () => {
  const currentItem = useQueueStore((state) => state.getCurrentItem());
  const status = useSoundStore((state) => state.status);
  const seek = useSoundStore((state) => state.seek);
  const duration = useSoundStore((state) => state.duration);

  const lastNotifiedRef = useRef<{
    id?: string;
    isPlaying?: boolean;
    posSec?: number;
    timestamp?: number;
  }>({});

  useEffect(() => {
    if (!window.NuclearAndroid) return;

    if (status === 'stopped') return;

    const track = currentItem?.track;
    if (!track) return;

    const isPlaying = status === 'playing';
    const title = track.title || 'Unknown Track';
    const artist = Array.isArray(track.artists)
      ? track.artists
          .map((artistCredit) =>
            typeof artistCredit === 'string' ? artistCredit : artistCredit?.name,
          )
          .filter(Boolean)
          .join(', ')
      : typeof track.artists === 'string'
        ? track.artists
        : 'Unknown Artist';

    const artworkItems = Array.isArray(track.artwork?.items)
      ? track.artwork.items
      : undefined;
    const artwork =
      pickArtwork(track.artwork, 'cover', 1200) ??
      pickArtwork(track.artwork, 'thumbnail', 600) ??
      pickArtwork(track.artwork, 'cover', 300) ??
      pickArtwork(track.artwork, 'thumbnail', 120) ??
      artworkItems?.find((item) => item?.purpose === 'cover') ??
      (artworkItems && artworkItems.length > 0
        ? artworkItems[artworkItems.length - 1]
        : undefined);

    const youtubeCoverUrl =
      track.source?.provider === 'youtube' && track.source.id
        ? `https://i.ytimg.com/vi/${track.source.id}/hq720.jpg`
        : undefined;
    const coverUrl = artwork?.url || youtubeCoverUrl || '';
    const posSec = Math.floor(seek);

    const prev = lastNotifiedRef.current;
    const now = Date.now();
    const trackChanged = prev.id !== currentItem?.id;
    const playStateChanged = prev.isPlaying !== isPlaying;

    if (trackChanged && !isPlaying) return;

    const timeDeltaSec =
      !trackChanged && prev.posSec !== undefined && prev.timestamp
        ? (now - prev.timestamp) / 1000
        : 0;
    const isManualSeek =
      !trackChanged &&
      prev.posSec !== undefined &&
      Math.abs((posSec - prev.posSec) - timeDeltaSec) > 3;

    const shouldUpdate = trackChanged || playStateChanged || isManualSeek;

    if (shouldUpdate) {
      lastNotifiedRef.current = {
        id: currentItem?.id,
        isPlaying,
        posSec,
        timestamp: now,
      };

      try {
        window.NuclearAndroid.updatePlayback(
          title,
          artist,
          coverUrl,
          isPlaying,
          Math.round(seek * 1000),
          Math.round(duration * 1000)
        );
      } catch (error) {
        console.error('[HyperIslandBridge] Error sending playback state:', error);
      }
    }
  }, [currentItem, status, seek, duration]);

  useEffect(() => {
    const handleAction = (event: Event) => {
      const customEvent = event as CustomEvent<{ action: string }>;
      const action = customEvent.detail?.action;
      if (!action) return;

      switch (action) {
        case 'toggle':
          useSoundStore.getState().toggle();
          break;
        case 'next':
          useQueueStore.getState().goToNext();
          break;
        case 'previous':
          playbackManager.previous();
          break;
        case 'stop':
          useSoundStore.getState().stop();
          break;
        default:
          break;
      }
    };

    window.addEventListener('nuclear:hyperisland:action', handleAction);
    return () => {
      window.removeEventListener('nuclear:hyperisland:action', handleAction);
    };
  }, []);
};

