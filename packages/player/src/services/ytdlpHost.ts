import { invoke } from '@tauri-apps/api/core';

import type {
  YtdlpHost,
  YtdlpPlaylistInfo,
  YtdlpSearchResult,
  YtdlpStreamInfo,
} from '@nuclearplayer/plugin-sdk';

import { Logger } from './logger';

const parseDurationToSeconds = (
  durationString?: string,
): number | undefined => {
  if (!durationString) {
    return undefined;
  }
  const parts = durationString.split(':').map(Number);
  if (parts.some(Number.isNaN)) {
    return undefined;
  }
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  return parts[0];
};

const extractVideoId = (input: string): string => {
  if (input.includes('v=')) {
    const match = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match) {
      return match[1];
    }
  }
  if (input.includes('youtu.be/')) {
    const match = input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (match) {
      return match[1];
    }
  }
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) {
    return input;
  }
  return input;
};

type SafeFetchResponse = {
  ok: boolean;
  status: number;
  json: <T = unknown>() => Promise<T>;
  text: () => Promise<string>;
};

const safeFetch = async (
  url: string,
  options?: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    signal?: AbortSignal;
  },
): Promise<SafeFetchResponse> => {
  try {
    const response = await invoke<{ status: number; body: string }>(
      'http_fetch',
      {
        request: {
          url,
          method: options?.method ?? 'GET',
          headers: options?.headers,
          body: options?.body,
        },
      },
    );
    return {
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      text: async () => response.body,
      json: async <T>() => JSON.parse(response.body) as T,
    };
  } catch {
    const response = await fetch(url, {
      method: options?.method ?? 'GET',
      headers: options?.headers,
      body: options?.body,
      signal: options?.signal,
    });
    return {
      ok: response.ok,
      status: response.status,
      text: () => response.text(),
      json: () => response.json(),
    };
  }
};

const INVIDIOUS_INSTANCES = [
  'https://invidious.f5.si',
  'https://inv.nadeko.net',
  'https://invidious.nerdvpn.de',
  'https://yt.artemislena.eu',
  'https://invidious.private.coffee',
] as const;

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.privacydev.net',
  'https://piped-api.lunar.icu',
] as const;

const DURATION_REGEX = /^\d+:\d{2}(:\d{2})?$/;

const parseInnerTubeSearchItem = (
  item: Record<string, unknown>,
): YtdlpSearchResult | null => {
  const video = (item.videoRenderer ?? item.compactVideoRenderer) as
    Record<string, unknown> | undefined;

  if (video?.videoId) {
    const videoId = video.videoId as string;
    const titleObj = video.title as Record<string, unknown> | undefined;
    const titleRuns = titleObj?.runs as Record<string, unknown>[] | undefined;
    const title =
      (titleRuns?.[0]?.text as string | undefined) ??
      (titleObj?.simpleText as string | undefined) ??
      'Unknown';
    const lengthObj = video.lengthText as Record<string, unknown> | undefined;
    const lengthRuns = lengthObj?.runs as Record<string, unknown>[] | undefined;
    const duration = parseDurationToSeconds(
      (lengthObj?.simpleText as string | undefined) ??
        (lengthRuns?.[0]?.text as string | undefined),
    );
    const thumbObj = video.thumbnail as Record<string, unknown> | undefined;
    const thumbnails =
      (thumbObj?.thumbnails as Record<string, unknown>[] | undefined) ?? [];
    const thumbnail =
      thumbnails.length > 0
        ? (thumbnails[thumbnails.length - 1]?.url as string | undefined)
        : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    const ownerObj = (video.ownerText ?? video.shortBylineText) as
      Record<string, unknown> | undefined;
    const ownerRuns = ownerObj?.runs as Record<string, unknown>[] | undefined;
    const channel = ownerRuns?.[0]?.text as string | undefined;

    return {
      id: videoId,
      title,
      duration: duration ?? null,
      thumbnail: thumbnail ?? null,
      channel: channel ?? null,
    };
  }

  const lockup = item.lockupViewModel as Record<string, unknown> | undefined;
  if (lockup?.contentId) {
    const videoId = lockup.contentId as string;
    const meta = (lockup.metadata as Record<string, unknown> | undefined)
      ?.lockupMetadataViewModel as Record<string, unknown> | undefined;
    const titleObj = meta?.title as Record<string, unknown> | undefined;
    const title = (titleObj?.content as string | undefined) ?? 'Unknown';

    let channel: string | undefined;
    let duration: number | undefined;

    const metaObj = meta?.metadata as Record<string, unknown> | undefined;
    const contentMeta = metaObj?.contentMetadataViewModel as
      Record<string, unknown> | undefined;
    const metaRows =
      (contentMeta?.metadataRows as Record<string, unknown>[] | undefined) ??
      [];

    for (const row of metaRows) {
      const parts =
        (row?.metadataParts as Record<string, unknown>[] | undefined) ?? [];
      for (const part of parts) {
        const textObj = part?.text as Record<string, unknown> | undefined;
        const text = textObj?.content as string | undefined;
        if (text) {
          const trimmed = text.trim();
          if (DURATION_REGEX.test(trimmed)) {
            duration = parseDurationToSeconds(trimmed);
          } else if (
            !channel &&
            trimmed.length > 0 &&
            !trimmed.includes('views') &&
            !trimmed.includes('ago') &&
            !trimmed.includes('vistas') &&
            !trimmed.includes('hace')
          ) {
            channel = trimmed;
          }
        }
      }
    }

    const contentImage = lockup.contentImage as
      Record<string, unknown> | undefined;
    const thumbViewModel = contentImage?.thumbnailViewModel as
      Record<string, unknown> | undefined;
    const imageObj = thumbViewModel?.image as
      Record<string, unknown> | undefined;
    const rawSources =
      (imageObj?.sources as Record<string, unknown>[] | undefined) ?? [];
    const thumbnail =
      rawSources.length > 0
        ? (rawSources[rawSources.length - 1]?.url as string | undefined)
        : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    return {
      id: videoId,
      title,
      duration: duration ?? null,
      thumbnail: thumbnail ?? null,
      channel: channel ?? null,
    };
  }

  return null;
};

const searchInvidiousFallback = async (
  query: string,
  maxResults: number,
): Promise<YtdlpSearchResult[]> => {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const response = await safeFetch(
        `${instance}/api/v1/search?q=${encodeURIComponent(query)}&type=video`,
        { signal: AbortSignal.timeout(5_000) },
      );
      if (!response.ok) {
        continue;
      }
      const data = await response.json<
        Array<{
          videoId: string;
          title: string;
          lengthSeconds?: number;
          videoThumbnails?: Array<{ url: string }>;
          author?: string;
        }>
      >();
      if (Array.isArray(data) && data.length > 0) {
        return data.slice(0, maxResults).map((resultItem) => ({
          id: resultItem.videoId,
          title: resultItem.title,
          duration: resultItem.lengthSeconds ?? null,
          thumbnail:
            resultItem.videoThumbnails?.[0]?.url ??
            `https://i.ytimg.com/vi/${resultItem.videoId}/hqdefault.jpg`,
          channel: resultItem.author ?? null,
        }));
      }
    } catch {
      continue;
    }
  }
  return [];
};

const searchPipedFallback = async (
  query: string,
  maxResults: number,
): Promise<YtdlpSearchResult[]> => {
  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await safeFetch(
        `${instance}/search?q=${encodeURIComponent(query)}&filter=videos`,
        { signal: AbortSignal.timeout(5_000) },
      );
      if (!response.ok) {
        continue;
      }
      const data = await response.json<{
        items?: Array<{
          url: string;
          title: string;
          duration?: number;
          thumbnail?: string;
          uploaderName?: string;
        }>;
      }>();
      const items = data?.items ?? [];
      if (items.length > 0) {
        return items.slice(0, maxResults).map((resultItem) => {
          const videoId = extractVideoId(resultItem.url || '');
          return {
            id: videoId,
            title: resultItem.title,
            duration: resultItem.duration ?? null,
            thumbnail:
              resultItem.thumbnail ??
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            channel: resultItem.uploaderName ?? null,
          };
        });
      }
    } catch {
      continue;
    }
  }
  return [];
};

const resolveInvidiousStream = async (
  videoId: string,
): Promise<YtdlpStreamInfo | null> => {
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const response = await safeFetch(`${instance}/api/v1/videos/${videoId}`, {
        signal: AbortSignal.timeout(6_000),
      });
      if (!response.ok) {
        continue;
      }
      const data = await response.json<{
        title?: string;
        lengthSeconds?: number;
        author?: string;
        adaptiveFormats?: Array<{
          type?: string;
          bitrate?: number;
          url?: string;
          container?: string;
          encoding?: string;
        }>;
      }>();
      const formats = data?.adaptiveFormats ?? [];
      const audioFormats = formats.filter(
        (formatItem) => formatItem.type?.includes('audio') && formatItem.url,
      );
      audioFormats.sort(
        (firstFormat, secondFormat) =>
          (firstFormat.bitrate ?? 0) - (secondFormat.bitrate ?? 0),
      );
      const bestAudio = audioFormats[audioFormats.length - 1];
      if (bestAudio?.url) {
        const streamUrl = bestAudio.url.startsWith('/')
          ? `${instance}${bestAudio.url}`
          : bestAudio.url;
        return {
          stream_url: streamUrl,
          duration: data.lengthSeconds ?? null,
          title: data.title ?? null,
          container: bestAudio.container ?? 'm4a',
          codec: bestAudio.encoding ?? 'aac',
          album: null,
          artists: data.author ? [data.author] : [],
          album_artists: data.author ? [data.author] : [],
          upload_date: null,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
};

const resolvePipedStream = async (
  videoId: string,
): Promise<YtdlpStreamInfo | null> => {
  for (const instance of PIPED_INSTANCES) {
    try {
      const response = await safeFetch(`${instance}/streams/${videoId}`, {
        signal: AbortSignal.timeout(6_000),
      });
      if (!response.ok) {
        continue;
      }
      const data = await response.json<{
        title?: string;
        duration?: number;
        uploader?: string;
        audioStreams?: Array<{
          url?: string;
          bitrate?: number;
          format?: string;
          codec?: string;
        }>;
      }>();
      const streams = data?.audioStreams ?? [];
      streams.sort(
        (firstStream, secondStream) =>
          (firstStream.bitrate ?? 0) - (secondStream.bitrate ?? 0),
      );
      const bestStream = streams[streams.length - 1];
      if (bestStream?.url) {
        return {
          stream_url: bestStream.url,
          duration: data.duration ?? null,
          title: data.title ?? null,
          container: bestStream.format?.toLowerCase() ?? 'm4a',
          codec: bestStream.codec ?? 'aac',
          album: null,
          artists: data.uploader ? [data.uploader] : [],
          album_artists: data.uploader ? [data.uploader] : [],
          upload_date: null,
        };
      }
    } catch {
      continue;
    }
  }
  return null;
};

const httpYoutubeSearch = async (
  query: string,
  maxResults: number,
): Promise<YtdlpSearchResult[]> => {
  try {
    const response = await safeFetch(
      'https://www.youtube.com/youtubei/v1/search',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context: {
            client: {
              clientName: 'WEB',
              clientVersion: '2.20240101.00.00',
            },
          },
          query,
        }),
        signal: AbortSignal.timeout(10_000),
      },
    );

    if (response.ok) {
      const data = await response.json<Record<string, unknown>>();
      const results: YtdlpSearchResult[] = [];

      const twoColumn = (data?.contents as Record<string, unknown> | undefined)
        ?.twoColumnSearchResultsRenderer as Record<string, unknown> | undefined;
      const primary = twoColumn?.primaryContents as
        Record<string, unknown> | undefined;
      const sectionList = primary?.sectionListRenderer as
        Record<string, unknown> | undefined;
      const sections =
        (sectionList?.contents as Record<string, unknown>[] | undefined) ?? [];

      for (const section of sections) {
        const itemSection = section?.itemSectionRenderer as
          Record<string, unknown> | undefined;
        const items =
          (itemSection?.contents as Record<string, unknown>[] | undefined) ??
          [];
        for (const item of items) {
          const parsed = parseInnerTubeSearchItem(item);
          if (parsed) {
            results.push(parsed);
            if (results.length >= maxResults) {
              return results;
            }
          }
        }
      }

      if (results.length > 0) {
        return results;
      }
    }
  } catch (error) {
    Logger.streaming.error(`httpYoutubeSearch InnerTube failed: ${error}`);
  }

  const invidiousResults = await searchInvidiousFallback(query, maxResults);
  if (invidiousResults.length > 0) {
    return invidiousResults;
  }

  return searchPipedFallback(query, maxResults);
};

const httpYoutubeGetStream = async (
  urlOrId: string,
): Promise<YtdlpStreamInfo> => {
  const videoId = extractVideoId(urlOrId);

  const invidiousStream = await resolveInvidiousStream(videoId);
  if (invidiousStream) {
    return invidiousStream;
  }

  const pipedStream = await resolvePipedStream(videoId);
  if (pipedStream) {
    return pipedStream;
  }

  return {
    stream_url: `https://www.youtube.com/watch?v=${videoId}`,
    duration: null,
    title: null,
    container: 'youtube',
    codec: 'youtube',
    album: null,
    artists: [],
    album_artists: [],
    upload_date: null,
  };
};

const extractPlaylistId = (input: string): string => {
  const match = input.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  if (match) {
    return match[1];
  }
  return input;
};

const extractPlaylistEntries = (
  items: Record<string, unknown>[],
): YtdlpPlaylistInfo['entries'] => {
  const entries: YtdlpPlaylistInfo['entries'] = [];
  for (const item of items) {
    if (
      item.lockupViewModel &&
      typeof item.lockupViewModel === 'object' &&
      item.lockupViewModel !== null
    ) {
      const lv = item.lockupViewModel as Record<string, unknown>;
      const id = lv.contentId as string | undefined;
      const meta = (lv.metadata as Record<string, unknown> | undefined)
        ?.lockupMetadataViewModel as Record<string, unknown> | undefined;
      const trackTitle = (meta?.title as Record<string, unknown> | undefined)
        ?.content as string | undefined;
      const metaRows = (
        (meta?.metadata as Record<string, unknown> | undefined)
          ?.contentMetadataViewModel as Record<string, unknown> | undefined
      )?.metadataRows as Record<string, unknown>[] | undefined;
      const channel = (
        (
          metaRows?.[0]?.metadataParts as Record<string, unknown>[] | undefined
        )?.[0]?.text as Record<string, unknown> | undefined
      )?.content as string | undefined;

      const DURATION_RE = /^\d+:\d{2}(:\d{2})?$/;
      let durationText: string | undefined;
      for (const row of metaRows ?? []) {
        for (const part of (row?.metadataParts as
          Record<string, unknown>[] | undefined) ?? []) {
          const content = (part?.text as Record<string, unknown> | undefined)
            ?.content as string | undefined;
          if (content && DURATION_RE.test(content.trim())) {
            durationText = content.trim();
            break;
          }
        }
        if (durationText) {
          break;
        }
      }
      const duration = durationText
        ? (parseDurationToSeconds(durationText) ?? null)
        : null;
      const contentImage = lv.contentImage as
        Record<string, unknown> | undefined;
      const thumbViewModel = contentImage?.thumbnailViewModel as
        Record<string, unknown> | undefined;
      const imageObj = thumbViewModel?.image as
        Record<string, unknown> | undefined;
      const rawSources =
        (imageObj?.sources as Record<string, unknown>[] | undefined) ?? [];
      const sources = rawSources
        .map((source) => ({
          url: source.url as string,
          width: typeof source.width === 'number' ? source.width : null,
          height: typeof source.height === 'number' ? source.height : null,
        }))
        .filter((source) => Boolean(source.url));

      const hdFallback = {
        url: `https://i.ytimg.com/vi/${id}/hq720.jpg`,
        width: 1280,
        height: 720,
      };

      const thumbnails =
        sources.length > 0 ? [...sources, hdFallback] : [hdFallback];

      if (id) {
        entries.push({
          id,
          title: trackTitle ?? 'Unknown',
          duration,
          thumbnails,
          channel: channel ?? 'Unknown Artist',
        });
      }
    } else if (
      item.playlistVideoRenderer &&
      typeof item.playlistVideoRenderer === 'object' &&
      item.playlistVideoRenderer !== null
    ) {
      const playlistVideo = item.playlistVideoRenderer as Record<
        string,
        unknown
      >;
      const id = playlistVideo.videoId as string | undefined;
      const titleRuns = (
        playlistVideo.title as Record<string, unknown> | undefined
      )?.runs as Record<string, unknown>[] | undefined;
      const trackTitle =
        (titleRuns?.[0]?.text as string | undefined) ??
        ((playlistVideo.title as Record<string, unknown> | undefined)
          ?.simpleText as string | undefined);
      const channel = (
        (playlistVideo.shortBylineText as Record<string, unknown> | undefined)
          ?.runs as Record<string, unknown>[] | undefined
      )?.[0]?.text as string | undefined;
      const duration = playlistVideo.lengthSeconds
        ? Number(playlistVideo.lengthSeconds)
        : null;

      const thumbObj = playlistVideo.thumbnail as
        Record<string, unknown> | undefined;
      const rawThumbs =
        (thumbObj?.thumbnails as Record<string, unknown>[] | undefined) ?? [];
      const sources = rawThumbs
        .map((thumb) => ({
          url: thumb.url as string,
          width: typeof thumb.width === 'number' ? thumb.width : null,
          height: typeof thumb.height === 'number' ? thumb.height : null,
        }))
        .filter((thumb) => Boolean(thumb.url));

      const hdFallback = {
        url: `https://i.ytimg.com/vi/${id}/hq720.jpg`,
        width: 1280,
        height: 720,
      };

      const thumbnails =
        sources.length > 0 ? [...sources, hdFallback] : [hdFallback];

      if (id) {
        entries.push({
          id,
          title: trackTitle ?? 'Unknown',
          duration,
          thumbnails,
          channel: channel ?? 'Unknown Artist',
        });
      }
    }
  }
  return entries;
};

const extractContinuationToken = (
  items: Record<string, unknown>[],
): string | null => {
  for (const item of items) {
    if (
      item.continuationItemViewModel &&
      typeof item.continuationItemViewModel === 'object'
    ) {
      const continuationItem = item.continuationItemViewModel as Record<
        string,
        unknown
      >;
      const continuationCommand = continuationItem.continuationCommand as
        Record<string, unknown> | undefined;
      const innertubeCommand = continuationCommand?.innertubeCommand as
        Record<string, unknown> | undefined;
      const innerContinuation = innertubeCommand?.continuationCommand as
        Record<string, unknown> | undefined;
      const token = innerContinuation?.token as string | undefined;
      if (token) {
        return token;
      }
    }
  }
  return null;
};

const httpYoutubeGetPlaylist = async (
  url: string,
): Promise<YtdlpPlaylistInfo> => {
  const rawId = extractPlaylistId(url);
  const playlistId = rawId.startsWith('VL') ? rawId.slice(2) : rawId;

  try {
    const firstResponse = await safeFetch(
      `https://www.youtube.com/playlist?list=${playlistId}&pbj=1`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
          'X-YouTube-Client-Name': '1',
          'X-YouTube-Client-Version': '2.20240101.00.00',
        },
        signal: AbortSignal.timeout(15_000),
      },
    );

    if (!firstResponse.ok) {
      throw new Error(`HTTP playlist fetch failed: ${firstResponse.status}`);
    }

    const firstData = await firstResponse.json<Record<string, unknown>>();
    const responsePayload =
      (firstData.response as Record<string, unknown> | undefined) ?? firstData;

    const pageHeader = (
      responsePayload.header as Record<string, unknown> | undefined
    )?.pageHeaderRenderer as Record<string, unknown> | undefined;
    const playlistHeader = (
      responsePayload.header as Record<string, unknown> | undefined
    )?.playlistHeaderRenderer as Record<string, unknown> | undefined;
    const playlistTitleObj = playlistHeader?.title as
      Record<string, unknown> | undefined;
    const playlistTitleRuns = playlistTitleObj?.runs as
      Record<string, unknown>[] | undefined;
    const metadataObj = (
      responsePayload.metadata as Record<string, unknown> | undefined
    )?.playlistMetadataRenderer as Record<string, unknown> | undefined;

    const title =
      (pageHeader?.pageTitle as string | undefined) ??
      (playlistTitleObj?.simpleText as string | undefined) ??
      (playlistTitleRuns?.[0]?.text as string | undefined) ??
      (metadataObj?.title as string | undefined) ??
      'YouTube Playlist';

    const browseResults = (
      responsePayload.contents as Record<string, unknown> | undefined
    )?.twoColumnBrowseResultsRenderer as Record<string, unknown> | undefined;
    const tabs =
      (browseResults?.tabs as Record<string, unknown>[] | undefined) ?? [];
    const tabRenderer = tabs[0]?.tabRenderer as
      Record<string, unknown> | undefined;
    const tabContent = tabRenderer?.content as
      Record<string, unknown> | undefined;
    const sectionList = tabContent?.sectionListRenderer as
      Record<string, unknown> | undefined;
    const sections =
      (sectionList?.contents as Record<string, unknown>[] | undefined) ?? [];

    const allItems: Record<string, unknown>[] = [];
    for (const section of sections) {
      const sectionRaw = (section as Record<string, unknown>)
        .itemSectionRenderer as Record<string, unknown> | undefined;
      const sectionItems =
        (sectionRaw?.contents as Record<string, unknown>[] | undefined) ?? [];
      allItems.push(...sectionItems);
    }

    const entries = extractPlaylistEntries(allItems);
    let continuationToken = extractContinuationToken(allItems);

    while (continuationToken) {
      const contResponse = await safeFetch(
        'https://www.youtube.com/youtubei/v1/browse',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
            'X-YouTube-Client-Name': '1',
            'X-YouTube-Client-Version': '2.20240101.00.00',
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'WEB',
                clientVersion: '2.20240101.00.00',
                hl: 'en',
                gl: 'US',
              },
            },
            continuation: continuationToken,
          }),
          signal: AbortSignal.timeout(15_000),
        },
      );

      if (!contResponse.ok) {
        break;
      }

      const contData = await contResponse.json<Record<string, unknown>>();
      const actions: Record<string, unknown>[] =
        (contData?.onResponseReceivedActions as
          Record<string, unknown>[] | undefined) ?? [];

      const pageItems: Record<string, unknown>[] = [];
      for (const action of actions) {
        const appendAction = (action as Record<string, unknown>)
          .appendContinuationItemsAction as Record<string, unknown> | undefined;
        const appendItems: Record<string, unknown>[] =
          (appendAction?.continuationItems as
            Record<string, unknown>[] | undefined) ?? [];
        for (const item of appendItems) {
          const itemRecord = item as Record<string, unknown>;
          if (
            itemRecord.lockupViewModel ||
            itemRecord.playlistVideoRenderer ||
            itemRecord.continuationItemViewModel
          ) {
            pageItems.push(itemRecord);
          } else if (itemRecord.itemSectionRenderer) {
            const sectionRaw = itemRecord.itemSectionRenderer as
              Record<string, unknown> | undefined;
            pageItems.push(
              ...((sectionRaw?.contents as
                Record<string, unknown>[] | undefined) ?? []),
            );
          }
        }
      }

      entries.push(...extractPlaylistEntries(pageItems));
      continuationToken = extractContinuationToken(pageItems);
    }

    return { id: playlistId, title, entries };
  } catch (error) {
    Logger.streaming.error(`httpYoutubeGetPlaylist failed: ${error}`);
    return { id: playlistId, title: 'YouTube Playlist', entries: [] };
  }
};

export const ytdlpHost: YtdlpHost = {
  search: async (
    query: string,
    maxResults?: number,
  ): Promise<YtdlpSearchResult[]> => {
    try {
      const results = await invoke<YtdlpSearchResult[]>('ytdlp_search', {
        query,
        maxResults: maxResults ?? 10,
      });
      if (results && results.length > 0) {
        return results;
      }
    } catch {
      Logger.streaming.debug(
        'Native ytdlp search not available, using HTTP fallback',
      );
    }
    return httpYoutubeSearch(query, maxResults ?? 10);
  },

  getStream: async (url: string): Promise<YtdlpStreamInfo> => {
    try {
      const info = await invoke<YtdlpStreamInfo>('ytdlp_get_stream', { url });
      if (info && info.stream_url) {
        return info;
      }
    } catch {
      Logger.streaming.debug(
        'Native ytdlp get_stream not available, using HTTP fallback',
      );
    }
    return httpYoutubeGetStream(url);
  },

  getPlaylist: async (url: string): Promise<YtdlpPlaylistInfo> => {
    try {
      const res = await invoke<YtdlpPlaylistInfo>('ytdlp_get_playlist', {
        url,
      });
      if (res && res.entries && res.entries.length > 0) {
        return res;
      }
    } catch {
      Logger.streaming.debug(
        'Native ytdlp get_playlist not available, using HTTP fallback',
      );
    }
    return httpYoutubeGetPlaylist(url);
  },
};
