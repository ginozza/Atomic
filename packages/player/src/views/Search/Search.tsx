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
      <div className="text-muted-foreground flex flex-col items-center justify-center gap-2 py-12 text-center">
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
        className="mb-4 flex w-full max-w-2xl gap-2"
      >
        <div className="relative flex-1">
          <SearchIcon className="text-muted-foreground absolute top-1/2 left-3.5 h-5 w-5 -translate-y-1/2" />
          <input
            type="search"
            data-testid="search-box"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Search tracks, albums, artists..."
            className="border-border bg-card text-foreground focus:ring-primary w-full rounded-xl border py-3 pr-4 pl-11 text-base font-medium shadow-sm focus:ring-2 focus:outline-none"
            autoFocus={!q}
          />
        </div>
        <Button
          type="submit"
          variant="default"
          className="rounded-xl px-5 py-3 font-bold"
        >
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
                <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wider uppercase">
                  <Clock className="h-3.5 w-3.5" />
                  Recent Searches
                </h3>
                <button
                  type="button"
                  onClick={clearRecentSearches}
                  className="text-muted-foreground hover:text-foreground flex cursor-pointer items-center gap-1 text-xs transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Clear
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <div
                    key={term}
                    className="group bg-card/90 hover:bg-card border-border hover:border-primary/50 inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-medium shadow-xs transition-all active:scale-95"
                    onClick={() => {
                      setInputValue(term);
                      handleSearchSubmit(term);
                    }}
                  >
                    <SearchIcon className="text-muted-foreground group-hover:text-primary h-3.5 w-3.5 transition-colors" />
                    <span className="text-foreground">{term}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeRecentSearch(term);
                      }}
                      className="text-muted-foreground hover:text-foreground ml-0.5 flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:bg-white/10"
                      aria-label={`Remove ${term}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground flex flex-col items-center justify-center gap-3 py-16 text-center">
              <SearchIcon className="h-12 w-12 stroke-[1.5] opacity-40" />
              <p className="text-base font-medium">
                Type a search term above to find music across all sources.
              </p>
            </div>
          )}
        </div>
      )}
    </ViewShell>
  );
};
