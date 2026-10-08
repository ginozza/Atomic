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
    className="narrow:inset-0 narrow:rounded-none narrow:border-0 fixed inset-0 flex w-auto max-w-none flex-col p-0 pt-[max(env(safe-area-inset-top),2.5rem)] pb-16 md:inset-8 md:flex-row md:pt-0 md:pb-0"
  >
    <div className="border-border bg-card flex shrink-0 items-center justify-between border-b px-4 py-2.5 md:hidden">
      <span className="text-sm font-black tracking-wider uppercase">
        Settings
      </span>
      <button
        type="button"
        onClick={onClose}
        className="bg-muted text-foreground border-border rounded-md border px-3 py-1 text-xs font-bold transition-transform active:scale-95"
      >
        Done
      </button>
    </div>
    <SettingsPanelNavigation sections={sections} footer={navigationFooter} />
    <SettingsPanelContent>{children}</SettingsPanelContent>
  </DialogRoot>
);
