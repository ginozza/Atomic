import { FC, ReactNode } from 'react';

import { DialogRoot } from '../Dialog/DialogRoot';
import { SettingsPanelContent } from './SettingsPanelContent';
import { SettingsPanelNavigation } from './SettingsPanelNavigation';

export type SettingsNavigationItem = {
  id: string;
  label: string;
  icon?: ReactNode;
};

export type SettingsNavigationSection = {
  id: string;
  label: string;
  items: SettingsNavigationItem[];
  activeItemId: string | null;
  onSelect: (itemId: string) => void;
};

type SettingsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  sections: SettingsNavigationSection[];
  navigationFooter?: ReactNode;
  children: ReactNode;
};

export const SettingsPanel: FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  sections,
  navigationFooter,
  children,
}) => (
  <DialogRoot
    isOpen={isOpen}
    onClose={onClose}
    className="narrow:inset-0 narrow:rounded-none narrow:border-0 fixed inset-0 md:inset-8 flex flex-col md:flex-row w-auto max-w-none p-0 pt-[max(env(safe-area-inset-top),2.5rem)] md:pt-0 pb-16 md:pb-0"
  >
    <div className="md:hidden flex items-center justify-between px-4 py-2.5 border-b border-border bg-card shrink-0">
      <span className="font-black text-sm uppercase tracking-wider">Settings</span>
      <button
        type="button"
        onClick={onClose}
        className="text-xs font-bold px-3 py-1 rounded-md bg-muted text-foreground border border-border active:scale-95 transition-transform"
      >
        Done
      </button>
    </div>
    <SettingsPanelNavigation sections={sections} footer={navigationFooter} />
    <SettingsPanelContent>{children}</SettingsPanelContent>
  </DialogRoot>
);
