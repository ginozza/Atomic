import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX_RECENT_SEARCHES = 10;

type RecentSearchesState = {
  recentSearches: string[];
  addRecentSearch: (query: string) => void;
  removeRecentSearch: (query: string) => void;
  clearRecentSearches: () => void;
};

export const useRecentSearches = create<RecentSearchesState>()(
  persist(
    (set) => ({
      recentSearches: [],
      addRecentSearch: (query) => {
        const trimmed = query.trim();
        if (!trimmed) {
          return;
        }
        set((state) => ({
          recentSearches: [
            trimmed,
            ...state.recentSearches.filter((item) => item !== trimmed),
          ].slice(0, MAX_RECENT_SEARCHES),
        }));
      },
      removeRecentSearch: (query) =>
        set((state) => ({
          recentSearches: state.recentSearches.filter((item) => item !== query),
        })),
      clearRecentSearches: () => set({ recentSearches: [] }),
    }),
    {
      name: 'nuclear_recent_searches',
    },
  ),
);
