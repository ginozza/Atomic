import { ComponentProps, FC, useEffect, useRef, useState } from 'react';

import { cn } from '../../utils';

type MarqueeTextProps = ComponentProps<'div'> & {
  text: string;
  speed?: number;
  gap?: number;
};

const DEFAULT_SPEED = 28;
const DEFAULT_GAP = 36;
const MIN_DURATION = 6;

export const MarqueeText: FC<MarqueeTextProps> = ({
  text,
  className,
  speed = DEFAULT_SPEED,
  gap = DEFAULT_GAP,
  ...props
}) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [contentWidth, setContentWidth] = useState(0);

  const safeText = text || '';

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    const checkOverflow = () => {
      const containerWidth = container.clientWidth;
      const textElement = textRef.current;
      const textScrollWidth = textElement?.scrollWidth ?? 0;
      const overflows = textScrollWidth > containerWidth + 2;
      setIsOverflowing(overflows);
      setContentWidth(textScrollWidth);
    };

    checkOverflow();

    const resizeObserver = new ResizeObserver(checkOverflow);
    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
    };
  }, [safeText]);

  const animationDuration = Math.max(
    MIN_DURATION,
    (contentWidth + gap) / Math.max(speed, 5),
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative w-full overflow-hidden whitespace-nowrap',
        className,
      )}
      style={
        isOverflowing
          ? {
              maskImage:
                'linear-gradient(to right, transparent 0%, black 8px, black calc(100% - 12px), transparent 100%)',
              WebkitMaskImage:
                'linear-gradient(to right, transparent 0%, black 8px, black calc(100% - 12px), transparent 100%)',
            }
          : undefined
      }
      data-testid="marquee-text-container"
      {...props}
    >
      {!isOverflowing ? (
        <span
          key="static"
          ref={textRef}
          className="inline-block max-w-full truncate align-middle"
          data-testid="marquee-static-text"
        >
          {safeText}
        </span>
      ) : (
        <div
          key="scrolling"
          className="flex w-max"
          style={{
            animation: `marquee-ticker ${animationDuration}s linear infinite`,
          }}
          data-testid="marquee-scrolling-track"
        >
          <span
            ref={textRef}
            className="inline-block align-middle"
            style={{ paddingRight: `${gap}px` }}
          >
            {safeText}
          </span>
          <span
            className="inline-block align-middle"
            style={{ paddingRight: `${gap}px` }}
            aria-hidden="true"
          >
            {safeText}
          </span>
        </div>
      )}
    </div>
  );
};
