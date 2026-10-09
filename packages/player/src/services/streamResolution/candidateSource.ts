import without from 'lodash-es/without';

import type { StreamCandidate, Track } from '@nuclearplayer/model';

import { providersHost } from '../providersHost';
import { isStreamExpired, streamingHost } from '../streamingHost';
import { streamVerification } from '../streamVerification';

const raceWithSignal = <ValueType>(
  promise: Promise<ValueType>,
  signal?: AbortSignal,
): Promise<ValueType> => {
  if (!signal) {
    return promise;
  }
  if (signal.aborted) {
    return Promise.reject(
      signal.reason ?? new DOMException('Aborted', 'AbortError'),
    );
  }
  return new Promise<ValueType>((resolve, reject) => {
    const onAbort = () => {
      signal.removeEventListener('abort', onAbort);
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
};

export type CandidateSourceOptions = {
  signal?: AbortSignal;
};

export const candidatesForTrack = async (
  track: Track,
  options?: CandidateSourceOptions,
): Promise<StreamCandidate[] | undefined> => {
  const cached = track.streamCandidates;
  if (cached && cached.length > 0 && !cached.some(isStreamExpired)) {
    return cached;
  }

  if (track.source?.provider === 'youtube' && track.source.id) {
    return [
      {
        id: track.source.id,
        title: track.title,
        durationMs: track.durationMs || undefined,
        failed: false,
        source: track.source,
        stream: {
          url: `https://www.youtube.com/watch?v=${track.source.id}`,
          container: 'youtube',
          codec: 'youtube',
          protocol: 'https' as const,
          source: track.source,
          durationMs: track.durationMs || undefined,
        },
        lastResolvedAtIso: new Date().toISOString(),
      },
    ];
  }

  const signal = options?.signal;
  if (signal?.aborted) {
    return undefined;
  }

  const searchPromise = Promise.all([
    streamingHost.resolveCandidatesForTrack(track),
    streamVerification.getVerifiedStream(track),
  ]);

  const [result, verifiedStream] = await raceWithSignal(searchPromise, signal);

  if (signal?.aborted || !result.success) {
    return undefined;
  }

  if (!verifiedStream) {
    return result.candidates;
  }

  const verified = result.candidates.find(
    (candidate) => candidate.id === verifiedStream.streamId,
  ) ?? {
    id: verifiedStream.streamId,
    title: track.title,
    failed: false,
    source: {
      provider: providersHost.getActive('streaming')!,
      id: verifiedStream.streamId,
    },
  };

  return [verified, ...without(result.candidates, verified)];
};
