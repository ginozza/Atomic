import { SaveIcon } from 'lucide-react';
import type { FC } from 'react';

import { useTranslation } from '@nuclearplayer/i18n';
import type { Track } from '@nuclearplayer/model';
import { Button } from '@nuclearplayer/ui';

import { PlaylistActions } from '../Playlists/components/PlaylistActions';

type PlaylistImportActionsProps = {
  tracks: Track[];
  onSaveLocally: () => void;
};

export const PlaylistImportActions: FC<PlaylistImportActionsProps> = ({
  tracks,
  onSaveLocally,
}) => {
  const { t } = useTranslation('playlists');

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="default"
        onClick={onSaveLocally}
        data-testid="save-locally-action"
      >
        <SaveIcon size={16} />
        {t('saveLocally')}
      </Button>
      <PlaylistActions tracks={tracks} />
    </div>
  );
};
