import { FC, ReactNode } from 'react';

import { cn } from '../../utils';
import { Button } from '../Button';
import { SettingsNavigationSection } from './SettingsPanel';

type SettingsPanelNavigationProps = {
  sections: SettingsNavigationSection[];
  footer?: ReactNode;
};

export const SettingsPanelNavigation: FC<SettingsPanelNavigationProps> = ({
  sections,
  footer,
}) => (
  <nav
    aria-label="Settings navigation"
    className="surface-glass-nav flex flex-row overflow-x-auto border-b border-border px-3 py-2.5 gap-2 shrink-0 no-scrollbar"
  >
    {sections.flatMap((section) =>
      section.items.map((item) => {
        const isActive = section.activeItemId === item.id;
        return (
          <Button
            key={`${section.id}-${item.id}`}
            data-testid={`settings-navigation-item-${item.id}`}
            onClick={() => section.onSelect(item.id)}
            variant={isActive ? 'default' : 'secondary'}
            size="sm"
            className={cn(
              'whitespace-nowrap rounded-full text-xs font-bold shrink-0 transition-transform active:scale-95',
              isActive && 'shadow-md',
            )}
          >
            {item.icon && <span className="mr-1">{item.icon}</span>}
            {item.label}
          </Button>
        );
      }),
    )}
    {footer && <div className="ml-auto">{footer}</div>}
  </nav>
);
