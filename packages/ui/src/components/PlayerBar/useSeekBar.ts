import { MouseEvent, PointerEvent, useCallback, useMemo, useRef } from 'react';

const MIN_PERCENT = 0;
const MAX_PERCENT = 100;

type UseSeekBarParams = {
  progress: number;
  isLoading?: boolean;
  onSeek?: (percent: number) => void;
};

export const useSeekBar = ({
  progress,
  isLoading = false,
  onSeek,
}: UseSeekBarParams) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingRef = useRef<boolean>(false);
  const hasMovedRef = useRef<boolean>(false);
  const handledByPointerRef = useRef<boolean>(false);
  const isInteractive = Boolean(onSeek) && !isLoading;

  const clamped = useMemo(
    () => Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, progress)),
    [progress],
  );

  const calculatePercent = useCallback((clientX: number) => {
    const target = containerRef.current;
    if (!target) {
      return MIN_PERCENT;
    }
    const rect = target.getBoundingClientRect();
    const width = rect.width ?? 0;
    if (width === 0) {
      return MIN_PERCENT;
    }
    const left = rect.left ?? (rect as { x?: number }).x ?? 0;
    const relativeX = clientX - left;
    const rawPercent = (relativeX / width) * MAX_PERCENT;
    return Math.max(MIN_PERCENT, Math.min(MAX_PERCENT, rawPercent));
  }, []);

  const handlePointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isInteractive) {
        return;
      }
      isDraggingRef.current = true;
      hasMovedRef.current = false;
      handledByPointerRef.current = true;
      if (typeof event.currentTarget.setPointerCapture === 'function') {
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      const percent = calculatePercent(event.clientX);
      onSeek?.(percent);
    },
    [calculatePercent, isInteractive, onSeek],
  );

  const handlePointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isInteractive || !isDraggingRef.current) {
        return;
      }
      hasMovedRef.current = true;
      const percent = calculatePercent(event.clientX);
      onSeek?.(percent);
    },
    [calculatePercent, isInteractive, onSeek],
  );

  const handlePointerUp = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isInteractive || !isDraggingRef.current) {
        return;
      }
      isDraggingRef.current = false;
      if (typeof event.currentTarget.releasePointerCapture === 'function') {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      if (hasMovedRef.current) {
        const percent = calculatePercent(event.clientX);
        onSeek?.(percent);
      }
    },
    [calculatePercent, isInteractive, onSeek],
  );

  const handlePointerCancel = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (!isInteractive || !isDraggingRef.current) {
        return;
      }
      isDraggingRef.current = false;
      if (typeof event.currentTarget.releasePointerCapture === 'function') {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    },
    [isInteractive],
  );

  const handleClick = useCallback(
    (event: MouseEvent<HTMLDivElement>) => {
      if (!isInteractive) {
        return;
      }
      if (handledByPointerRef.current) {
        handledByPointerRef.current = false;
        return;
      }
      const percent = calculatePercent(event.clientX);
      onSeek?.(percent);
    },
    [calculatePercent, isInteractive, onSeek],
  );

  return {
    clamped,
    containerRef,
    handleClick,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    isInteractive,
  } as const;
};

export type UseSeekBarReturn = ReturnType<typeof useSeekBar>;
