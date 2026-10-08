import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import '@nuclearplayer/tailwind-config';

import { PlayerBar } from './PlayerBar';
import { PlayerBarControls } from './PlayerBarControls';
import { PlayerBarNowPlaying } from './PlayerBarNowPlaying';
import { PlayerBarRoot } from './PlayerBarRoot';
import { PlayerBarSeekBar } from './PlayerBarSeekBar';
import { PlayerBarVolume } from './PlayerBarVolume';

const VIEWPORT_WIDTH_320 = 320;
const VIEWPORT_WIDTH_360 = 360;
const VIEWPORT_WIDTH_380 = 380;
const SEEK_CONTAINER_WIDTH = 200;
const SEEK_CONTAINER_HEIGHT = 32;

const defaultLabels = {
  shuffleOn: 'Shuffle on',
  shuffleOff: 'Shuffle off',
  repeatOff: 'Repeat off',
  repeatAll: 'Repeat all',
  repeatOne: 'Repeat one',
  discoveryOn: 'Discovery on',
  discoveryOff: 'Discovery off',
};

const setupPointerCaptureMock = (element: HTMLElement) => {
  element.setPointerCapture = vi.fn();
  element.releasePointerCapture = vi.fn();
  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(
    DOMRect.fromRect({
      x: 0,
      y: 0,
      width: SEEK_CONTAINER_WIDTH,
      height: SEEK_CONTAINER_HEIGHT,
    }),
  );
};

const triggerPointer = (
  element: HTMLElement,
  eventType: 'pointerdown' | 'pointermove' | 'pointerup' | 'pointercancel',
  options: { clientX: number; pointerId?: number },
) => {
  const event = new Event(eventType, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clientX', { value: options.clientX });
  Object.defineProperty(event, 'pointerId', { value: options.pointerId ?? 1 });
  act(() => {
    element.dispatchEvent(event);
  });
};

describe('PlayerBarMobile', () => {
  describe('Tier 1: Feature Coverage', () => {
    it('renders responsive mobile multi-row layout without horizontal control collision', () => {
      render(
        <div style={{ width: VIEWPORT_WIDTH_360 }}>
          <PlayerBarRoot
            left={
              <PlayerBarNowPlaying
                title="Atomic Pulse"
                artist="Nuclear Energy"
                coverUrl="https://example.com/cover.png"
              />
            }
            center={
              <PlayerBarControls
                isPlaying
                labels={defaultLabels}
                onPlayPause={vi.fn()}
                onNext={vi.fn()}
                onPrevious={vi.fn()}
                onShuffleToggle={vi.fn()}
                onRepeatToggle={vi.fn()}
                showDiscovery={false}
              />
            }
            right={
              <PlayerBarVolume
                value={80}
                onValueChange={vi.fn()}
                isMuted={false}
                onMuteToggle={vi.fn()}
              />
            }
          />
        </div>,
      );

      const playPauseButton = screen.getByTestId('player-pause-button');
      const nextButton = screen.getByTestId('player-next-button');
      const repeatButton = screen.getByTestId('player-repeat-button');
      const shuffleButton = screen.getByTestId('player-shuffle-button');
      const muteButton = screen.getByTestId('player-mute-button');
      const volumeSlider = screen.getByTestId('player-volume-slider');

      expect(playPauseButton).toBeVisible();
      expect(nextButton).toBeVisible();
      expect(repeatButton).toBeVisible();
      expect(shuffleButton).toBeVisible();
      expect(muteButton).toBeVisible();
      expect(volumeSlider).toBeVisible();

      expect(muteButton).toHaveAttribute('aria-label', 'Mute');
    });

    it('ensures all playback controls have touch targets with minimum 40px dimensions', () => {
      render(
        <PlayerBarControls
          isPlaying={false}
          labels={defaultLabels}
          onPlayPause={vi.fn()}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onShuffleToggle={vi.fn()}
          onRepeatToggle={vi.fn()}
          showDiscovery
          onDiscoveryToggle={vi.fn()}
        />,
      );

      const buttons = [
        screen.getByTestId('player-play-button'),
        screen.getByTestId('player-next-button'),
        screen.getByTestId('player-repeat-button'),
        screen.getByTestId('player-shuffle-button'),
        screen.getByTestId('player-discovery-button'),
      ];

      for (const button of buttons) {
        expect(button.className).toContain('size-10');
      }
    });

    it('renders seek bar with extended touch target height and dedicated time indicators row', () => {
      render(
        <PlayerBarSeekBar
          progress={45}
          elapsedSeconds={90}
          remainingSeconds={110}
          onSeek={vi.fn()}
        />,
      );

      const seekBar = screen.getByTestId('player-seek-bar');
      expect(seekBar.className).toContain('h-8');
      expect(seekBar.className).toContain('py-2');
      expect(seekBar.className).toContain('touch-none');

      expect(screen.getByText(/1:30/)).toBeVisible();
      expect(screen.getByText(/-1:50/)).toBeVisible();
    });

    it('handles seek bar tap to jump to position', async () => {
      const handleSeek = vi.fn();
      render(
        <PlayerBarSeekBar
          progress={10}
          elapsedSeconds={20}
          remainingSeconds={180}
          onSeek={handleSeek}
        />,
      );

      const seekBar = screen.getByTestId('player-seek-bar');
      setupPointerCaptureMock(seekBar);

      fireEvent.click(seekBar, { clientX: 100 });
      expect(handleSeek).toHaveBeenCalledWith(50);
    });

    it('handles mute button toggling and updates icon and label', async () => {
      const user = userEvent.setup();
      const handleMuteToggle = vi.fn();

      const { rerender } = render(
        <PlayerBarVolume
          value={70}
          isMuted={false}
          onMuteToggle={handleMuteToggle}
        />,
      );

      const unmutedButton = screen.getByTestId('player-mute-button');
      expect(unmutedButton).toHaveAttribute('aria-label', 'Mute');

      await user.click(unmutedButton);
      expect(handleMuteToggle).toHaveBeenCalledTimes(1);

      rerender(
        <PlayerBarVolume
          value={70}
          isMuted={true}
          onMuteToggle={handleMuteToggle}
        />,
      );

      const mutedButton = screen.getByTestId('player-mute-button');
      expect(mutedButton).toHaveAttribute('aria-label', 'Unmute');
    });

    it('disables seek bar interactions while loading', () => {
      const handleSeek = vi.fn();
      render(
        <PlayerBarSeekBar
          progress={0}
          elapsedSeconds={0}
          remainingSeconds={0}
          isLoading={true}
          onSeek={handleSeek}
        />,
      );

      const seekBar = screen.getByTestId('player-seek-bar');
      expect(seekBar).toHaveAttribute('aria-disabled', 'true');
      expect(seekBar.className).toContain('pointer-events-none');

      fireEvent.click(seekBar, { clientX: 100 });
      expect(handleSeek).not.toHaveBeenCalled();
    });
  });

  describe('Tier 2: Boundary & Corner Cases', () => {
    it('maintains non-overlapping layout under extreme mobile viewport of 320px', () => {
      render(
        <div style={{ width: VIEWPORT_WIDTH_320 }}>
          <PlayerBarRoot
            left={
              <PlayerBarNowPlaying
                title="Super Compact Track"
                artist="Minimal Width Band"
              />
            }
            center={
              <PlayerBarControls
                isPlaying={false}
                labels={defaultLabels}
                onPlayPause={vi.fn()}
                onNext={vi.fn()}
                onPrevious={vi.fn()}
                onShuffleToggle={vi.fn()}
                onRepeatToggle={vi.fn()}
                showDiscovery={false}
              />
            }
            right={
              <PlayerBarVolume
                value={50}
                isMuted={false}
                onMuteToggle={vi.fn()}
              />
            }
          />
        </div>,
      );

      expect(screen.getByTestId('player-play-button')).toBeVisible();
      expect(screen.getByTestId('player-mute-button')).toBeVisible();
      expect(screen.getByTestId('player-volume-slider')).toBeVisible();
    });

    it('maintains non-overlapping layout under 380px mobile viewport', () => {
      render(
        <div style={{ width: VIEWPORT_WIDTH_380 }}>
          <PlayerBarRoot
            left={
              <PlayerBarNowPlaying
                title="Android HyperOS Track"
                artist="Atomic Audio"
              />
            }
            center={
              <PlayerBarControls
                isPlaying={true}
                labels={defaultLabels}
                onPlayPause={vi.fn()}
                onNext={vi.fn()}
                onPrevious={vi.fn()}
                onShuffleToggle={vi.fn()}
                onRepeatToggle={vi.fn()}
                showDiscovery={false}
              />
            }
            right={
              <PlayerBarVolume
                value={100}
                isMuted={false}
                onMuteToggle={vi.fn()}
              />
            }
          />
        </div>,
      );

      expect(screen.getByTestId('player-pause-button')).toBeVisible();
      expect(screen.getByTestId('player-repeat-button')).toBeVisible();
      expect(screen.getByTestId('player-mute-button')).toBeVisible();
    });

    it('clamps seek percent precisely at start boundary (0:00) when clicked at or before start', () => {
      const handleSeek = vi.fn();
      render(
        <PlayerBarSeekBar
          progress={50}
          elapsedSeconds={120}
          remainingSeconds={120}
          onSeek={handleSeek}
        />,
      );

      const seekBar = screen.getByTestId('player-seek-bar');
      setupPointerCaptureMock(seekBar);

      fireEvent.click(seekBar, { clientX: 0 });
      expect(handleSeek).toHaveBeenCalledWith(0);

      fireEvent.click(seekBar, { clientX: -50 });
      expect(handleSeek).toHaveBeenCalledWith(0);
    });

    it('clamps seek percent precisely at end boundary (track end) when clicked at or beyond width', () => {
      const handleSeek = vi.fn();
      render(
        <PlayerBarSeekBar
          progress={50}
          elapsedSeconds={120}
          remainingSeconds={120}
          onSeek={handleSeek}
        />,
      );

      const seekBar = screen.getByTestId('player-seek-bar');
      setupPointerCaptureMock(seekBar);

      fireEvent.click(seekBar, { clientX: 200 });
      expect(handleSeek).toHaveBeenCalledWith(100);

      fireEvent.click(seekBar, { clientX: 250 });
      expect(handleSeek).toHaveBeenCalledWith(100);
    });

    it('handles continuous pointer scrubbing drag from 0% to 100% with pointer capture', () => {
      const handleSeek = vi.fn();
      render(
        <PlayerBarSeekBar
          progress={0}
          elapsedSeconds={0}
          remainingSeconds={300}
          onSeek={handleSeek}
        />,
      );

      const seekBar = screen.getByTestId('player-seek-bar');
      setupPointerCaptureMock(seekBar);

      triggerPointer(seekBar, 'pointerdown', { pointerId: 1, clientX: 20 });
      expect(handleSeek).toHaveBeenCalledWith(10);
      expect(seekBar.setPointerCapture).toHaveBeenCalledWith(1);

      triggerPointer(seekBar, 'pointermove', { pointerId: 1, clientX: 100 });
      expect(handleSeek).toHaveBeenCalledWith(50);

      triggerPointer(seekBar, 'pointermove', { pointerId: 1, clientX: 180 });
      expect(handleSeek).toHaveBeenCalledWith(90);

      triggerPointer(seekBar, 'pointerup', { pointerId: 1, clientX: 200 });
      expect(handleSeek).toHaveBeenCalledWith(100);
      expect(seekBar.releasePointerCapture).toHaveBeenCalledWith(1);
    });

    it('handles rapid mute toggling in quick succession without state corruption', async () => {
      const user = userEvent.setup();
      const handleMuteToggle = vi.fn();

      render(
        <PlayerBarVolume
          value={80}
          isMuted={false}
          onMuteToggle={handleMuteToggle}
        />,
      );

      const muteButton = screen.getByTestId('player-mute-button');
      for (let count = 0; count < 5; count += 1) {
        await user.click(muteButton);
      }

      expect(handleMuteToggle).toHaveBeenCalledTimes(5);
    });
  });

  describe('Tier 3: Cross-Feature Combinations', () => {
    it('supports seeking while actively playing combined with volume muting and track skipping', async () => {
      const user = userEvent.setup();
      const handlePlayPause = vi.fn();
      const handleNext = vi.fn();
      const handleMuteToggle = vi.fn();
      const handleSeek = vi.fn();

      render(
        <div style={{ width: VIEWPORT_WIDTH_360 }}>
          <PlayerBar.SeekBar
            progress={25}
            elapsedSeconds={45}
            remainingSeconds={135}
            onSeek={handleSeek}
          />
          <PlayerBar
            left={
              <PlayerBar.NowPlaying
                title="Active Playback Track"
                artist="Concurrent Artists"
              />
            }
            center={
              <PlayerBar.Controls
                isPlaying={true}
                labels={defaultLabels}
                onPlayPause={handlePlayPause}
                onNext={handleNext}
                onPrevious={vi.fn()}
                onShuffleToggle={vi.fn()}
                onRepeatToggle={vi.fn()}
                showDiscovery={false}
              />
            }
            right={
              <PlayerBar.Volume
                value={65}
                isMuted={false}
                onMuteToggle={handleMuteToggle}
              />
            }
          />
        </div>,
      );

      const seekBar = screen.getByTestId('player-seek-bar');
      setupPointerCaptureMock(seekBar);
      fireEvent.click(seekBar, { clientX: 150 });
      expect(handleSeek).toHaveBeenCalledWith(75);

      const muteButton = screen.getByTestId('player-mute-button');
      await user.click(muteButton);
      expect(handleMuteToggle).toHaveBeenCalledTimes(1);

      const nextButton = screen.getByTestId('player-next-button');
      await user.click(nextButton);
      expect(handleNext).toHaveBeenCalledTimes(1);
    });

    it('cycles repeat mode states while shuffle is toggled on mobile layout', async () => {
      const user = userEvent.setup();
      const handleRepeatToggle = vi.fn();
      const handleShuffleToggle = vi.fn();

      const { rerender } = render(
        <PlayerBarControls
          isPlaying={true}
          isShuffleActive={false}
          repeatMode="off"
          labels={defaultLabels}
          onPlayPause={vi.fn()}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onShuffleToggle={handleShuffleToggle}
          onRepeatToggle={handleRepeatToggle}
          showDiscovery={false}
        />,
      );

      const shuffleButton = screen.getByTestId('player-shuffle-button');
      await user.click(shuffleButton);
      expect(handleShuffleToggle).toHaveBeenCalledTimes(1);

      const repeatButton = screen.getByTestId('player-repeat-button');
      await user.click(repeatButton);
      expect(handleRepeatToggle).toHaveBeenCalledTimes(1);

      rerender(
        <PlayerBarControls
          isPlaying={true}
          isShuffleActive={true}
          repeatMode="all"
          labels={defaultLabels}
          onPlayPause={vi.fn()}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onShuffleToggle={handleShuffleToggle}
          onRepeatToggle={handleRepeatToggle}
          showDiscovery={false}
        />,
      );

      await user.click(repeatButton);
      expect(handleRepeatToggle).toHaveBeenCalledTimes(2);

      rerender(
        <PlayerBarControls
          isPlaying={true}
          isShuffleActive={true}
          repeatMode="one"
          labels={defaultLabels}
          onPlayPause={vi.fn()}
          onNext={vi.fn()}
          onPrevious={vi.fn()}
          onShuffleToggle={handleShuffleToggle}
          onRepeatToggle={handleRepeatToggle}
          showDiscovery={false}
        />,
      );

      await user.click(repeatButton);
      expect(handleRepeatToggle).toHaveBeenCalledTimes(3);
    });
  });

  describe('Tier 4: Real-World Scenarios', () => {
    it('executes full mobile playback workflow: play, scrub, mute, and skip', async () => {
      const user = userEvent.setup();
      const handlePlayPause = vi.fn();
      const handleNext = vi.fn();
      const handleMuteToggle = vi.fn();
      const handleSeek = vi.fn();
      const handleVolumeChange = vi.fn();

      render(
        <div style={{ width: VIEWPORT_WIDTH_360 }}>
          <PlayerBar.SeekBar
            progress={15}
            elapsedSeconds={30}
            remainingSeconds={170}
            onSeek={handleSeek}
          />
          <PlayerBar
            left={
              <PlayerBar.NowPlaying
                title="Atomic Real World Track"
                artist="Atomic Symphony"
                coverUrl="https://example.com/cover.jpg"
              />
            }
            center={
              <PlayerBar.Controls
                isPlaying={false}
                labels={defaultLabels}
                onPlayPause={handlePlayPause}
                onNext={handleNext}
                onPrevious={vi.fn()}
                onShuffleToggle={vi.fn()}
                onRepeatToggle={vi.fn()}
                showDiscovery={false}
              />
            }
            right={
              <PlayerBar.Volume
                value={50}
                onValueChange={handleVolumeChange}
                isMuted={false}
                onMuteToggle={handleMuteToggle}
              />
            }
          />
        </div>,
      );

      const playButton = screen.getByTestId('player-play-button');
      await user.click(playButton);
      expect(handlePlayPause).toHaveBeenCalledTimes(1);

      const seekBar = screen.getByTestId('player-seek-bar');
      setupPointerCaptureMock(seekBar);

      triggerPointer(seekBar, 'pointerdown', { pointerId: 2, clientX: 30 });
      triggerPointer(seekBar, 'pointermove', { pointerId: 2, clientX: 120 });
      triggerPointer(seekBar, 'pointerup', { pointerId: 2, clientX: 120 });
      expect(handleSeek).toHaveBeenCalledWith(60);

      const muteButton = screen.getByTestId('player-mute-button');
      await user.click(muteButton);
      expect(handleMuteToggle).toHaveBeenCalledTimes(1);

      const nextButton = screen.getByTestId('player-next-button');
      await user.click(nextButton);
      expect(handleNext).toHaveBeenCalledTimes(1);
    });
  });
});
