import { Fragment } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import { ScrollableArea, ViewShell } from '@nuclearplayer/ui';

import { useSettingsModalStore } from '../../stores/settingsModalStore';
import { SettingsSection } from './SettingsSection';
import { useSettingsGroups } from './useSettingsGroups';
import { useSettingsScrollSpy } from './useSettingsScrollSpy';

export const Settings = () => {
  const { t } = useTranslation('preferences');
  const groups = useSettingsGroups();
  const activeItemId = useSettingsModalStore((state) => state.activeItemId);
  const { viewportRef, registerSection } = useSettingsScrollSpy();

  const activeGroup = groups.find((group) => group.name === activeItemId);
  const displayedGroups = activeGroup ? [activeGroup] : groups;
  const currentTitle = activeGroup
    ? t(`${activeGroup.name}.title`, activeGroup.name)
    : t('general.title');

  return (
    <ViewShell title={currentTitle}>
      <div className="flex w-full flex-col items-center justify-center overflow-hidden">
        <ScrollableArea
          className="max-w-[696px] min-w-[300px] flex-1 overflow-hidden"
          viewportRef={viewportRef}
        >
          <div className="px-2 pb-36">
            {displayedGroups.map((group, index) => (
              <Fragment key={group.name}>
                {index > 0 && <hr className="border-foreground/10 my-10" />}
                <div
                  ref={registerSection(group.name)}
                  data-testid={`settings-section-${group.name}`}
                >
                  <SettingsSection
                    title={t(`${group.name}.title`, group.name)}
                    settings={group.settings}
                  />
                </div>
              </Fragment>
            ))}
          </div>
        </ScrollableArea>
      </div>
    </ViewShell>
  );
};
