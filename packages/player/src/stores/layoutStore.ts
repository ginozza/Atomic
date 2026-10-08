import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type LayoutState = {
  leftSidebar: {
    isCollapsed: boolean;
    width: number;
  };
  rightSidebar: {
    isCollapsed: boolean;
    width: number;
  };
  toggleLeftSidebar: () => void;
  toggleRightSidebar: () => void;
  setLeftSidebarWidth: (width: number) => void;
  setRightSidebarWidth: (width: number) => void;
};

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      leftSidebar: {
        isCollapsed: false,
        width: 200,
      },
      rightSidebar: {
        isCollapsed: false,
        width: 200,
      },
      toggleLeftSidebar: () =>
        set((state) => ({
          leftSidebar: {
            ...state.leftSidebar,
            isCollapsed: !state.leftSidebar.isCollapsed,
          },
        })),
      toggleRightSidebar: () =>
        set((state) => ({
          rightSidebar: {
            ...state.rightSidebar,
            isCollapsed: !state.rightSidebar.isCollapsed,
          },
        })),
      setLeftSidebarWidth: (width: number) =>
        set((state) => ({
          leftSidebar: {
            ...state.leftSidebar,
            width,
          },
        })),
      setRightSidebarWidth: (width: number) =>
        set((state) => ({
          rightSidebar: {
            ...state.rightSidebar,
            width,
          },
        })),
    }),
    {
      name: 'nuclear-layout-store',
      merge: (persistedState, currentState) => {
        const state = { ...currentState, ...(persistedState as Partial<LayoutState>) };
        const isMobile =
          typeof window !== 'undefined' &&
          (/android|iphone|ipad|ipod/i.test(navigator.userAgent) || window.innerWidth < 768);
        if (isMobile) {
          state.rightSidebar = {
            ...state.rightSidebar,
            isCollapsed: true,
          };
        }
        return state;
      },
    },
  ),
);
