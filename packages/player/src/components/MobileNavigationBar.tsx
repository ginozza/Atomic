import { useNavigate, useRouterState } from '@tanstack/react-router';
import {
  GaugeIcon,
  HeartIcon,
  ListMusicIcon,
  ListOrderedIcon,
  SearchIcon,
} from 'lucide-react';
import { FC } from 'react';

import { useQueueStore } from '../stores/queueStore';

export const MobileNavigationBar: FC = () => {
  const navigate = useNavigate();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  const queueLength = useQueueStore((state) => state.items.length);

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
            <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-primary ring-2 ring-background" />
          )}
        </div>
      ),
      isActive: currentPath.startsWith('/queue'),
      onClick: () => navigate({ to: '/queue' }),
    },
  ];

  return (
    <nav
      data-testid="mobile-navigation-bar"
      className="fixed bottom-[max(env(safe-area-inset-bottom),0.75rem)] left-3 right-3 z-40 flex items-center justify-between gap-2.5 max-w-md mx-auto pointer-events-auto md:hidden select-none"
    >
      {/* Liquid Glass Main Pill */}
      <div className="flex-1 surface-liquid-pill rounded-full h-14 px-1.5 flex items-center justify-around shadow-2xl">
        {navItems.map((item) => {
          return (
            <button
              key={item.id}
              type="button"
              onClick={item.onClick}
              className={`flex flex-col items-center justify-center py-1 transition-all duration-200 rounded-full focus:outline-none ${
                item.isActive
                  ? 'surface-liquid-active text-primary px-3.5 font-bold shadow-sm'
                  : 'text-muted-foreground hover:text-foreground px-2.5 font-medium active:scale-95'
              }`}
            >
              {item.icon}
              <span className="text-[10px] tracking-tight mt-0.5 leading-none">
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
        className={`w-14 h-14 surface-liquid-pill rounded-full flex items-center justify-center shrink-0 shadow-2xl active:scale-90 transition-all duration-200 focus:outline-none ${
          isSearchActive
            ? 'surface-liquid-active text-primary ring-2 ring-primary/40'
            : 'text-foreground hover:text-primary active:bg-white/10'
        }`}
        aria-label="Search"
      >
        <SearchIcon className="h-5 w-5 stroke-[2.2]" />
      </button>
    </nav>
  );
};
