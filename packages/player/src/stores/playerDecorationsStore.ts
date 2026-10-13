import { create } from 'zustand';

export type DecorationLayer =
  'above-all' | 'behind-text' | 'behind-cover' | 'behind-all';

export type PlayerDecoration = {
  id: string;
  name: string;
  dataUrl: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  opacity: number;
  layer: DecorationLayer;
  enabled: boolean;
};

type PlayerDecorationsStore = {
  decorations: PlayerDecoration[];
  isEditMode: boolean;
  selectedId: string | null;
  setEditMode: (editing: boolean) => void;
  setSelectedId: (id: string | null) => void;
  addDecoration: (
    decoration: Omit<PlayerDecoration, 'id' | 'enabled' | 'layer'> & {
      layer?: DecorationLayer;
    },
  ) => string;
  updateDecoration: (id: string, updates: Partial<PlayerDecoration>) => void;
  removeDecoration: (id: string) => void;
  toggleDecoration: (id: string) => void;
  clearDecorations: () => void;
};

const STORAGE_KEY = 'atomic.player_decorations';

const loadPersistedDecorations = (): PlayerDecoration[] => {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    if (!rawData) {
      return [];
    }
    const parsed = JSON.parse(rawData);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return (parsed as Record<string, unknown>[]).map((item) => ({
      id: String(item.id ?? `${Date.now()}`),
      name: String(item.name ?? 'Decoration'),
      dataUrl: String(item.dataUrl ?? ''),
      x: typeof item.x === 'number' ? item.x : 50,
      y: typeof item.y === 'number' ? item.y : 35,
      scale: typeof item.scale === 'number' ? item.scale : 1,
      rotation: typeof item.rotation === 'number' ? item.rotation : 0,
      opacity: typeof item.opacity === 'number' ? item.opacity : 1,
      layer: (item.layer as DecorationLayer) ?? 'above-all',
      enabled: typeof item.enabled === 'boolean' ? item.enabled : true,
    }));
  } catch {
    return [];
  }
};

const persistDecorations = (decorations: PlayerDecoration[]): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(decorations));
  } catch {
    // ignore persistence error
  }
};

export const usePlayerDecorationsStore = create<PlayerDecorationsStore>(
  (set) => ({
    decorations: loadPersistedDecorations(),
    isEditMode: false,
    selectedId: null,

    setEditMode: (editing) => set({ isEditMode: editing }),
    setSelectedId: (id) => set({ selectedId: id }),

    addDecoration: (decoration) => {
      const newId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      set((state) => {
        const newDecoration: PlayerDecoration = {
          ...decoration,
          id: newId,
          layer: decoration.layer ?? 'above-all',
          enabled: true,
        };
        const nextDecorations = [...state.decorations, newDecoration];
        persistDecorations(nextDecorations);
        return {
          decorations: nextDecorations,
          selectedId: newId,
        };
      });
      return newId;
    },

    updateDecoration: (id, updates) => {
      set((state) => {
        const nextDecorations = state.decorations.map((item) =>
          item.id === id ? { ...item, ...updates } : item,
        );
        persistDecorations(nextDecorations);
        return { decorations: nextDecorations };
      });
    },

    removeDecoration: (id) => {
      set((state) => {
        const nextDecorations = state.decorations.filter(
          (item) => item.id !== id,
        );
        persistDecorations(nextDecorations);
        return {
          decorations: nextDecorations,
          selectedId: state.selectedId === id ? null : state.selectedId,
        };
      });
    },

    toggleDecoration: (id) => {
      set((state) => {
        const nextDecorations = state.decorations.map((item) =>
          item.id === id ? { ...item, ...enabledState(item.enabled) } : item,
        );
        persistDecorations(nextDecorations);
        return { decorations: nextDecorations };
      });
    },

    clearDecorations: () => {
      persistDecorations([]);
      set({ decorations: [], selectedId: null });
    },
  }),
);

const enabledState = (currentEnabled: boolean): { enabled: boolean } => ({
  enabled: !currentEnabled,
});
