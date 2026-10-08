import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useLayoutStore } from '../stores/layoutStore';
import { useQueueStore } from '../stores/queueStore';
import { MobileNavigationBar } from './MobileNavigationBar';

const mockNavigate = vi.fn();
let mockPathname = '/dashboard';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
  useRouterState: () => ({
    location: {
      pathname: mockPathname,
    },
  }),
}));

describe('MobileNavigationBar (Apple Music Style)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPathname = '/dashboard';
    useQueueStore.setState({
      items: [],
      currentIndex: 0,
    });
    useLayoutStore.setState({
      rightSidebar: {
        isCollapsed: true,
        width: 200,
      },
    });
  });

  it('renders liquid-glass navigation bar with 4 pill items and circular search button', () => {
    render(<MobileNavigationBar />);

    expect(screen.getByTestId('mobile-navigation-bar')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /home/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /playlists/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /favorites/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /queue/i })).toBeInTheDocument();
    expect(screen.getByTestId('mobile-search-button')).toBeInTheDocument();
  });

  it('highlights Home as active when on /dashboard', () => {
    mockPathname = '/dashboard';
    render(<MobileNavigationBar />);

    const homeButton = screen.getByRole('button', { name: /home/i });
    expect(homeButton.className).toContain('surface-liquid-active');
  });

  it('highlights Playlists when navigating to /playlists', async () => {
    const user = userEvent.setup();
    render(<MobileNavigationBar />);

    const playlistsButton = screen.getByRole('button', { name: /playlists/i });
    await user.click(playlistsButton);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/playlists' });
  });

  it('toggles Queue sidebar when clicking Queue button', async () => {
    const user = userEvent.setup();
    render(<MobileNavigationBar />);

    const queueButton = screen.getByRole('button', { name: /queue/i });
    await user.click(queueButton);

    expect(useLayoutStore.getState().rightSidebar.isCollapsed).toBe(false);
  });

  it('navigates to /search when clicking the circular search button', async () => {
    const user = userEvent.setup();
    render(<MobileNavigationBar />);

    const searchButton = screen.getByTestId('mobile-search-button');
    await user.click(searchButton);

    expect(mockNavigate).toHaveBeenCalledWith({
      to: '/search',
      search: { q: '' },
    });
  });
});
