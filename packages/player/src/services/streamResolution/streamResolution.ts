import { toast } from 'sonner';

import { i18n } from '@nuclearplayer/i18n';
import type { QueueItem, StreamCandidate } from '@nuclearplayer/model';
import { stripResolutionState } from '@nuclearplayer/model';

import { useQueueStore } from '../../stores/queueStore';
import { useSoundStore } from '../../stores/soundStore';
import { playbackManager } from '../playback';
import { hasActiveStreamingProvider, streamingHost } from '../streamingHost';
import { AudioSourceFactory } from './audioSource';
import { candidatesForTrack } from './candidateSource';

export const CANDIDATE_TIMEOUT_MS = 8000;
export const GLOBAL_TIMEOUT_MS = 20000;

export type StreamResolutionConfig = {
  candidateTimeoutMs?: number;
  globalTimeoutMs?: number;
};

export type ResolveOptions = {
  autoPlay: boolean;
  startPositionSeconds?: number;
};

export class StreamResolution {
  private activeController: AbortController | null = null;
  private activeItemId: string | null = null;
  private lastFailedItemId: string | null = null;
  private globalTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private candidateTimeoutMs = CANDIDATE_TIMEOUT_MS;
  private globalTimeoutMs = GLOBAL_TIMEOUT_MS;

  constructor(
    private readonly audioSourceFactory = new AudioSourceFactory(),
    config?: StreamResolutionConfig,
  ) {
    if (config) {
      this.configure(config);
    }
  }

  configure(config: StreamResolutionConfig): void {
    if (config.candidateTimeoutMs !== undefined) {
      this.candidateTimeoutMs = config.candidateTimeoutMs;
    }
    if (config.globalTimeoutMs !== undefined) {
      this.globalTimeoutMs = config.globalTimeoutMs;
    }
  }

  resetConfig(): void {
    this.candidateTimeoutMs = CANDIDATE_TIMEOUT_MS;
    this.globalTimeoutMs = GLOBAL_TIMEOUT_MS;
  }

  async resolve(item: QueueItem, options: ResolveOptions): Promise<void> {
    const signal = this.supersedeActiveResolution(item.id);
    this.startGlobalTimeout(item.id);
    const { updateItemState } = useQueueStore.getState();

    if (options.autoPlay) {
      const isPlaying = useSoundStore.getState().status === 'playing';
      if (isPlaying) {
        useSoundStore.getState().setSrc(null);
      } else {
        useSoundStore.getState().stop();
        useSoundStore.getState().setSrc(null);
      }
    }
    updateItemState(item.id, { status: 'loading', error: undefined });

    const isDirectYoutube =
      item.track.source?.provider === 'youtube' &&
      Boolean(item.track.source.id);
    if (!hasActiveStreamingProvider() && !isDirectYoutube) {
      this.failItem(item.id, 'streaming:errors.noProviderAvailable');
      return;
    }

    let candidates: StreamCandidate[] | undefined;
    try {
      candidates = await candidatesForTrack(item.track, { signal });
    } catch {
      if (signal.aborted) {
        return;
      }
      this.failItem(item.id, 'streaming:errors.noCandidatesFound');
      return;
    }

    if (signal.aborted) {
      return;
    }
    if (!candidates || candidates.length === 0) {
      this.failItem(item.id, 'streaming:errors.noCandidatesFound');
      return;
    }

    updateItemState(item.id, {
      track: { ...item.track, streamCandidates: candidates },
    });
    await this.tryCandidatesInOrder(item, candidates, signal, options);
  }

  async resolveWithFreshStreams(
    item: QueueItem,
    options: ResolveOptions,
  ): Promise<void> {
    const track = stripResolutionState(item.track);
    useQueueStore.getState().updateItemState(item.id, {
      status: 'idle',
      error: undefined,
      track,
    });
    return this.resolve(
      { ...item, track, status: 'idle', error: undefined },
      options,
    );
  }

  async failCurrentCandidateAndTryNext(
    itemId: string,
    candidateId?: string,
  ): Promise<void> {
    const currentQueueItem = useQueueStore.getState().getItemById(itemId);
    if (!currentQueueItem) {
      return;
    }

    const candidates = currentQueueItem.track.streamCandidates ?? [];
    if (candidates.length === 0) {
      this.failItem(itemId, 'streaming:errors.allCandidatesFailed');
      return;
    }

    const targetCandidate = candidateId
      ? candidates.find((candidate) => candidate.id === candidateId)
      : (candidates.find((candidate) => !candidate.failed) ?? candidates[0]);

    if (!targetCandidate) {
      this.failItem(itemId, 'streaming:errors.allCandidatesFailed');
      return;
    }

    useQueueStore.getState().updateCandidate(itemId, {
      ...targetCandidate,
      failed: true,
    });

    const refreshedItem = useQueueStore.getState().getItemById(itemId);
    const remaining = (refreshedItem?.track.streamCandidates ?? []).filter(
      (candidate) => !candidate.failed && candidate.id !== targetCandidate.id,
    );

    if (remaining.length === 0) {
      this.failItem(itemId, 'streaming:errors.allCandidatesFailed');
      return;
    }

    useSoundStore.getState().setSrc(null);
    const signal = this.supersedeActiveResolution(itemId);
    this.startGlobalTimeout(itemId);
    await this.tryCandidatesInOrder(
      refreshedItem ?? currentQueueItem,
      remaining,
      signal,
      { autoPlay: true },
    );
  }

  private startGlobalTimeout(itemId: string): void {
    this.clearGlobalTimeout();
    this.globalTimeoutId = setTimeout(() => {
      if (
        this.activeItemId === itemId &&
        this.activeController &&
        !this.activeController.signal.aborted
      ) {
        this.failItem(itemId, 'streaming:errors.allCandidatesFailed');
      }
    }, this.globalTimeoutMs);
  }

  private clearGlobalTimeout(): void {
    if (this.globalTimeoutId !== null) {
      clearTimeout(this.globalTimeoutId);
      this.globalTimeoutId = null;
    }
  }

  private async tryCandidatesInOrder(
    item: QueueItem,
    candidates: StreamCandidate[],
    signal: AbortSignal,
    options: ResolveOptions,
  ): Promise<void> {
    if (signal.aborted) {
      return;
    }

    const candidate = candidates.find((current) => !current.failed);
    if (!candidate) {
      this.failItem(item.id, 'streaming:errors.allCandidatesFailed');
      return;
    }

    if (signal.aborted) {
      return;
    }

    let resolved: StreamCandidate | undefined;
    try {
      resolved = await this.resolveCandidateWithTimeout(candidate, signal);
    } catch {
      if (signal.aborted) {
        return;
      }
      this.handleCandidateFailure(item, candidate, candidates, signal, options);
      return;
    }

    if (signal.aborted) {
      return;
    }

    if (!resolved || resolved.failed || !resolved.stream) {
      this.handleCandidateFailure(item, candidate, candidates, signal, options);
      return;
    }

    useQueueStore.getState().updateCandidate(item.id, resolved);
    await this.startPlayback(item, resolved, signal, options);
  }

  private handleCandidateFailure(
    item: QueueItem,
    candidate: StreamCandidate,
    candidates: StreamCandidate[],
    signal: AbortSignal,
    options: ResolveOptions,
  ): void {
    useQueueStore.getState().removeCandidate(item.id, candidate.id);
    const remaining = candidates.filter(
      (current) => current.id !== candidate.id,
    );
    void this.tryCandidatesInOrder(item, remaining, signal, options);
  }

  private async resolveCandidateWithTimeout(
    candidate: StreamCandidate,
    signal: AbortSignal,
  ): Promise<StreamCandidate | undefined> {
    const candidateController = new AbortController();
    const timer = setTimeout(() => {
      candidateController.abort(
        new DOMException('Candidate resolution timeout', 'TimeoutError'),
      );
    }, this.candidateTimeoutMs);

    const onParentAbort = () => {
      candidateController.abort(signal.reason);
    };

    if (signal.aborted) {
      clearTimeout(timer);
      throw signal.reason ?? new Error('Aborted');
    }

    signal.addEventListener('abort', onParentAbort, { once: true });

    try {
      const abortPromise = new Promise<never>((_, reject) => {
        candidateController.signal.addEventListener(
          'abort',
          () => reject(candidateController.signal.reason),
          { once: true },
        );
      });

      return await Promise.race([
        streamingHost.resolveStreamForCandidate(candidate),
        abortPromise,
      ]);
    } finally {
      clearTimeout(timer);
      signal.removeEventListener('abort', onParentAbort);
    }
  }

  private async startPlayback(
    item: QueueItem,
    candidate: StreamCandidate,
    signal: AbortSignal,
    options: ResolveOptions,
  ): Promise<void> {
    try {
      const audioSource =
        await this.audioSourceFactory.fromCandidate(candidate);
      if (signal.aborted) {
        return;
      }

      if (options.startPositionSeconds !== undefined) {
        audioSource.startPositionSeconds = options.startPositionSeconds;
      }

      this.clearGlobalTimeout();
      useQueueStore.getState().updateItemState(item.id, { status: 'success' });
      this.activeItemId = null;
      playbackManager.startTrack(item, audioSource, {
        autoPlay: options.autoPlay,
      });
    } catch {
      if (signal.aborted) {
        return;
      }
      this.failItem(item.id, 'streaming:errors.allCandidatesFailed');
    }
  }

  private failItem(itemId: string, errorKey: string): void {
    this.clearGlobalTimeout();
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }
    this.lastFailedItemId = itemId;
    this.activeItemId = null;
    useSoundStore.getState().stop();
    useSoundStore.getState().setSrc(null);
    const item = useQueueStore.getState().getItemById(itemId);
    useQueueStore.getState().updateItemState(itemId, {
      status: 'error',
      error: errorKey,
    });
    const message = i18n.t(errorKey);
    toast.error(message, {
      description: item?.track.title,
    });
  }

  private supersedeActiveResolution(itemId: string): AbortSignal {
    if (this.activeController) {
      this.activeController.abort();
      this.activeController = null;
    }
    this.clearGlobalTimeout();
    const previousId =
      this.activeItemId && this.activeItemId !== itemId
        ? this.activeItemId
        : this.lastFailedItemId && this.lastFailedItemId !== itemId
          ? this.lastFailedItemId
          : null;
    if (previousId) {
      const { getItemById, updateItemState } = useQueueStore.getState();
      const previousItem = getItemById(previousId);
      if (previousItem) {
        updateItemState(previousId, {
          status: undefined,
          error: undefined,
          track: stripResolutionState(previousItem.track),
        });
      }
    }
    this.lastFailedItemId = null;
    this.activeController = new AbortController();
    this.activeItemId = itemId;
    return this.activeController.signal;
  }
}

export const streamResolution = new StreamResolution();
