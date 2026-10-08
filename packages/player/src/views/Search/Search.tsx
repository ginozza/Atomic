import { useQuery } from '@tanstack/react-query';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { Clock, SearchIcon, Trash2, X } from 'lucide-react';
import { FC, useEffect, useState } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { pickArtwork } from '@nuclearplayer/model';
import type {
  MetadataProvider,
  SearchResults,
} from '@nuclearplayer/plugin-sdk';
import {
  Button,
  Card,
  CardGrid,
  Tabs,
  TabsItem,
  ViewShell,
} from '@nuclearplayer/ui';

import { ConnectedTrackTable } from '../../components/ConnectedTrackTable';
import { useRecentSearches } from '../../components/SearchBox/useRecentSearches';
import { useActiveProvider } from '../../hooks/useActiveProvider';
import { metadataHost } from '../../services/metadataHost';
import { SearchEmptyState } from './SearchEmptyState';

const SearchContent: FC<{
  provider: MetadataProvider | undefined;
  isLoading: boolean;
  isError: boolean;
  results: SearchResults | undefined;
  refetch: () => void;
}> = ({ provider, isLoading, isError, results, refetch }) => {
  const { t } = useTranslation(['search', 'common']);
  const navigate = useNavigate();

  if (!provider) {
    return <SearchEmptyState />;
  }

  if (isLoading) {
    return <CardGrid.Skeleton data-testid="search-skeleton" />;
  }

  if (isError) {
    return (
      <div className="space-y-3">
        <div className="text-accent-red">{t('search:failedToLoad')}</div>
        <Button
          onClick={() => {
            void refetch();
          }}
        >
          {t('common:actions.retry')}
        </Button>
      </div>
    );
  }

  const tabsItems = [
    results?.tracks && {
      id: 'tracks',
      label: t('search:results.tracks'),
      content: (
        <div className="flex flex-col">
          <ConnectedTrackTable
            features={{ playAll: true, addAllToQueue: true }}
            tracks={results.tracks}
          />
        </div>
      ),
    },
    results?.albums && {
      id: 'albums',
      label: t('search:results.albums'),
      content: (
        <CardGrid>
          {results.albums.map((item) => (
            <Card
              key={item.source.id}
              title={item.title}
              src={pickArtwork(item.artwork, 'cover', 300)?.url}
              onClick={() =>
                navigate({ to: `/album/${provider.id}/${item.source.id}` })
              }
            />
          ))}
        </CardGrid>
      ),
    },
    results?.artists && {
      id: 'artists',
      label: t('search:results.artists'),
      content: (
        <CardGrid>
          {results.artists.map((item) => (
            <Card
              key={item.source.id}
              title={item.name}
              src={pickArtwork(item.artwork, 'cover', 300)?.url}
              onClick={() =>
                navigate({ to: `/artist/${provider.id}/${item.source.id}` })
              }
            />
          ))}
        </CardGrid>
      ),
    },
  ].filter(Boolean);

  if (tabsItems.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground gap-2">
        <p className="text-base font-semibold">No results found</p>
        <p className="text-sm">Try searching with different keywords</p>
      </div>
    );
  }

  return <Tabs items={tabsItems as TabsItem[]} className="flex-1" />;
};

export const Search: FC = () => {
  const { t } = useTranslation(['search', 'common']);
  const { q } = useSearch({ from: '/search' });
  const navigate = useNavigate();
  const [inputValue, setInputValue] = useState(q || '');

  const {
    recentSearches,
    addRecentSearch,
    removeRecentSearch,
    clearRecentSearches,
  } = useRecentSearches();

  useEffect(() => {
    if (q && q.trim()) {
      addRecentSearch(q.trim());
    }
  }, [q, addRecentSearch]);

  const provider = useActiveProvider('metadata') as
    MetadataProvider | undefined;

  const {
    data: results,
    isLoading,
    isError,
    refetch,
  } = useQuery<SearchResults>({
    queryKey: ['metadata-search', provider?.id, q],
    queryFn: () =>
      metadataHost.search(
        {
          query: q,
        },
        provider?.id,
      ),
    enabled: Boolean(provider && q && q.trim().length > 0),
  });

  const handleSearchSubmit = (term: string) => {
    const trimmed = term.trim();
    if (trimmed) {
      addRecentSearch(trimmed);
      navigate({ to: '/search', search: { q: trimmed } });
    }
  };

  return (
    <ViewShell
      data-testid="search-view"
      title={t('search:title')}
      subtitle={q ? `${t('search:query')}: "${q}"` : undefined}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSearchSubmit(inputValue);
        }}
        className="mb-4 flex gap-2 w-full max-w-2xl"
      >
        <div className="relative flex-1">
          <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <input
            type="search"
            data-testid="search-box"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search tracks, albums, artists..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-border bg-card text-foreground font-medium text-base shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            autoFocus={!q}
          />
        </div>
        <Button type="submit" variant="default" className="px-5 py-3 rounded-xl font-bold">
          {t('common:actions.search') || 'Search'}
        </Button>
      </form>

      {q && q.trim().length > 0 ? (
        <SearchContent
          provider={provider}
          isLoading={isLoading}
          isError={isError}
          results={results}
          refetch={refetch}
        />
      ) : (
        <div className="w-full max-w-2xl">
          {recentSearches.length > 0 ? (
            <div className="mt-2 space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  Recent Searches
                </h3>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    className="group inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-card/90 hover:bg-card border border-border hover:border-primary/50 text-sm font-medium transition-all cursor-pointer shadow-xs active:scale-95"
                    onClick={() => {
                      setInputValue(term);
                      handleSearchSubmit(term);
                    }}
                  >
                    <SearchIcon className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-foreground">{term}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(term);
                      }}
                      className="w-4 h-4 rounded-full hover:bg-white/10 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors ml-0.5"
                      aria-label={`Remove ${term}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-3">
              <SearchIcon className="w-12 h-12 stroke-[1.5] opacity-40" />
              <p className="text-base font-medium">Type a search term above to find music across all sources.</p>
            </div>
          )}
        </div>
      )}
    </ViewShell>
  );
};
