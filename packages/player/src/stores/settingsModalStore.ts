import { create } from 'zustand';

type SettingsModalState = {
  isOpen: boolean;
  activeItemId: string | null;
  open: (itemId?: string | null) => void;
  close: () => void;
  selectItem: (itemId: string | null) => void;
};

export const useSettingsModalStore = create<SettingsModalState>((set) => ({
  isOpen: false,
  activeItemId: null,
  open: (itemId) =>
    set({
      isOpen: true,
      activeItemId: itemId ?? null,
    }),
  close: () => set({ isOpen: false, activeItemId: null }),
  selectItem: (itemId) => set({ activeItemId: itemId }),
}));
