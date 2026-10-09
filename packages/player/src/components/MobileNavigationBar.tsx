import { useNavigate, useRouterState } from '@tanstack/react-router';
import {
  GaugeIcon,
  HeartIcon,
  ListMusicIcon,
  ListOrderedIcon,
  SearchIcon,
  SettingsIcon,
} from 'lucide-react';
import { FC } from 'react';

import { useLayoutStore } from '../stores/layoutStore';
import { useQueueStore } from '../stores/queueStore';
import { useSettingsModalStore } from '../stores/settingsModalStore';

export const MobileNavigationBar: FC = () => {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const queueLength = useQueueStore((state) => state.items.length);
  const toggleRightSidebar = useLayoutStore(
    (state) => state.toggleRightSidebar,
  );
  const openSettings = useSettingsModalStore((state) => state.open);

  const isSearchActive = currentPath.startsWith('/search');

  const navItems = [
    {
      id: 'dashboard',
      label: 'Home',
      icon: <GaugeIcon className="h-5 w-5" />,
      isActive: currentPath === '/' || currentPath === '/dashboard',
      onClick: () => navigate({ to: '/dashboard' }),
    },
    {
      id: 'playlists',
      label: 'Playlists',
      icon: <ListMusicIcon className="h-5 w-5" />,
      isActive: currentPath.startsWith('/playlists'),
      onClick: () => navigate({ to: '/playlists' }),
    },
    {
      id: 'favorites',
      label: 'Favorites',
      icon: <HeartIcon className="h-5 w-5" />,
      isActive: currentPath.startsWith('/favorites'),
      onClick: () => navigate({ to: '/favorites/tracks' }),
    },
    {
      id: 'queue',
      label: 'Queue',
      icon: (
        <div className="relative flex items-center justify-center">
          <ListOrderedIcon className="h-5 w-5" />
          {queueLength > 0 && (
            <span className="bg-primary ring-background absolute -top-1 -right-1.5 h-2 w-2 rounded-full ring-2" />
          )}
        </div>
      ),
      isActive: currentPath.startsWith('/queue'),
      onClick: () => {
        toggleRightSidebar();
        navigate({ to: '/queue' });
      },
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon className="h-5 w-5" />,
      isActive: false,
      onClick: () => openSettings(),
    },
  ];

  return (
    <nav
      data-testid="mobile-navigation-bar"
      className="pointer-events-auto fixed right-3 bottom-[max(env(safe-area-inset-bottom),0.75rem)] left-3 z-40 mx-auto flex max-w-md items-center justify-between gap-2.5 select-none md:hidden"
    >
      {/* Liquid Glass Main Pill */}
      <div className="surface-liquid-pill flex h-14 flex-1 items-center justify-around rounded-full px-1.5 shadow-2xl">
        {navItems.map((item) => {
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center rounded-full py-1 transition-all duration-200 focus:outline-none ${
                item.isActive
                  ? 'surface-liquid-active text-primary px-3.5 font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground px-2.5 font-medium active:scale-95'
              }`}
            >
              {item.icon}
              <span className="mt-0.5 text-[10px] leading-none tracking-tight">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>

      {/* Liquid Glass Circular Search Button (Apple Music style) */}
      <button
        type="button"
        data-testid="mobile-search-button"
        onClick={() => navigate({ to: '/search', search: { q: '' } })}
        className={`surface-liquid-pill flex h-14 w-14 shrink-0 items-center justify-center rounded-full shadow-2xl transition-all duration-200 focus:outline-none active:scale-90 ${
          isSearchActive
            ? 'surface-liquid-active text-primary ring-primary/40 ring-2'
            : 'text-foreground hover:text-primary active:bg-white/10'
        }`}
        aria-label="Search"
      >
        <SearchIcon className="h-5 w-5 stroke-[2.2]" />
      </button>
    </nav>
  );
};
