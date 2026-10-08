import {
  FC,
  MutableRefObject,
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

import { cn } from '../../utils';

export type ScrollableAreaProps = {
  children: ReactNode;
  className?: string;
  viewportClassName?: string;
  fadeScrollbars?: boolean;
  autoHideDelay?: number; // ms, default 1000
  viewportRef?: MutableRefObject<HTMLDivElement | null>;
  testViewportHeight?: number;
  'data-testid'?: string;
};

type ScrollMetrics = {
  scrollTop: number;
  scrollLeft: number;
  scrollHeight: number;
  scrollWidth: number;
  clientHeight: number;
  clientWidth: number;
};

const initialMetrics: ScrollMetrics = {
  scrollTop: 0,
  scrollLeft: 0,
  scrollHeight: 0,
  scrollWidth: 0,
  clientHeight: 0,
  clientWidth: 0,
};

function useScrollMetrics(fadeScrollbars: boolean, autoHideDelay: number) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [metrics, setMetrics] = useState<ScrollMetrics>(initialMetrics);
  const [isScrolling, setIsScrolling] = useState(false);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const rafRef = useRef<number>();

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    setMetrics({
      scrollTop: el.scrollTop,
      scrollLeft: el.scrollLeft,
      scrollHeight: el.scrollHeight,
      scrollWidth: el.scrollWidth,
      clientHeight: el.clientHeight,
      clientWidth: el.clientWidth,
    });
  }, []);

  const handleScroll = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }
    rafRef.current = requestAnimationFrame(() => {
      update();
      if (fadeScrollbars) {
        setIsScrolling(true);
        if (hideTimeoutRef.current) {
          clearTimeout(hideTimeoutRef.current);
        }
        hideTimeoutRef.current = setTimeout(
          () => setIsScrolling(false),
          autoHideDelay,
        );
      }
    });
  }, [fadeScrollbars, autoHideDelay, update]);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    // initial
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, [update]);

  return { ref, metrics, isScrolling, handleScroll };
}

// Scrollbar (track + thumb)
interface BarProps {
  orientation: 'vertical' | 'horizontal';
  metrics: ScrollMetrics;
  containerRef: React.RefObject<HTMLDivElement>;
  fadeScrollbars: boolean;
  isScrolling: boolean;
}

const Scrollbar: FC<BarProps> = () => null;

export const ScrollableArea: FC<ScrollableAreaProps> = ({
  children,
  className,
  viewportClassName,
  fadeScrollbars = true,
  autoHideDelay = 1000,
  viewportRef,
  testViewportHeight,
  'data-testid': testId,
}) => {
  const { ref, metrics, isScrolling, handleScroll } = useScrollMetrics(
    fadeScrollbars,
    autoHideDelay,
  );

  const setViewportNode = useCallback(
    (node: HTMLDivElement | null) => {
      ref.current = node;
      if (viewportRef) {
        viewportRef.current = node;
      }
    },
    [ref, viewportRef],
  );

  const needsVertical = metrics.scrollHeight > metrics.clientHeight;
  const needsHorizontal = metrics.scrollWidth > metrics.clientWidth;
  const needsCorner = needsVertical && needsHorizontal;

  return (
    <div
      className={cn('relative h-full w-full', className)}
      data-testid={testId}
    >
      <div
        ref={setViewportNode}
        className={cn(
          'scrollbar-hide flex h-full w-full flex-col overflow-auto',
          viewportClassName,
        )}
        onScroll={handleScroll}
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        data-test-resize-observer-block-size={
          testViewportHeight != null ? String(testViewportHeight) : undefined
        }
      >
        {children}
      </div>

      <Scrollbar
        orientation="vertical"
        metrics={metrics}
        containerRef={ref}
        fadeScrollbars={fadeScrollbars}
        isScrolling={isScrolling}
      />
      <Scrollbar
        orientation="horizontal"
        metrics={metrics}
        containerRef={ref}
        fadeScrollbars={fadeScrollbars}
        isScrolling={isScrolling}
      />
      {needsCorner && (
        <div className="absolute right-0 bottom-0 h-3 w-3 bg-transparent" />
      )}
    </div>
  );
};
