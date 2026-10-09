import {
  Eye,
  EyeOff,
  ImagePlus,
  Maximize2,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { ChangeEvent, FC, useRef } from 'react';

import { Button } from '@nuclearplayer/ui';

import { useNowPlayingModalStore } from '../../stores/nowPlayingModalStore';
import { usePlayerDecorationsStore } from '../../stores/playerDecorationsStore';
import { useSettingsModalStore } from '../../stores/settingsModalStore';

export const PlayerDecorationsSettings: FC = () => {
  const {
    decorations,
    addDecoration,
    removeDecoration,
    toggleDecoration,
    setEditMode,
  } = usePlayerDecorationsStore();

  const { open: openNowPlaying } = useNowPlayingModalStore();
  const { close: closeSettings } = useSettingsModalStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleOpenFullscreenEditor = () => {
    closeSettings();
    openNowPlaying();
    setEditMode(true);
  };

  const handleFileUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (loadEvent) => {
      const dataUrl = loadEvent.target?.result as string | undefined;
      if (!dataUrl) {
        return;
      }

      addDecoration({
        name: file.name.replace(/\.[^/.]+$/, ''),
        dataUrl,
        x: 50,
        y: 40,
        scale: 1,
        rotation: 0,
        opacity: 1,
        layer: 'above-all',
      });

      if (event.target) {
        event.target.value = '';
      }

      handleOpenFullscreenEditor();
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-6 pb-20">
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary h-5 w-5" />
          <h2 className="font-heading text-foreground text-xl font-black">
            Player Decorations
          </h2>
        </div>
        <p className="text-muted-foreground text-xs">
          Personaliza la vista del reproductor con stickers, fotos y GIFs
          animados. Puedes moverlos, rotarlos y escalarlos con tus dedos en
          tiempo real.
        </p>
      </header>

      {/* Action buttons */}
      <div className="space-y-3">
        <Button
          variant="default"
          onClick={handleOpenFullscreenEditor}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-4 text-sm font-bold shadow-lg"
        >
          <Maximize2 className="h-5 w-5" />
          <span>Abrir Editor en el Reproductor</span>
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/gif,image/webp,image/jpeg"
          onChange={handleFileUpload}
          className="hidden"
        />
        <Button
          variant="secondary"
          onClick={() => fileInputRef.current?.click()}
          className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-xs font-semibold"
        >
          <ImagePlus className="h-4 w-4" />
          <span>Cargar Nuevo GIF o Imagen</span>
        </Button>
      </div>

      {/* List of Loaded Decorations */}
      {decorations.length > 0 && (
        <div className="space-y-2">
          <label className="text-muted-foreground text-xs font-semibold">
            Elementos Guardados ({decorations.length})
          </label>
          <div className="space-y-2">
            {decorations.map((item) => (
              <div
                key={item.id}
                onClick={handleOpenFullscreenEditor}
                className="border-border/30 bg-card/40 hover:bg-card/70 flex cursor-pointer items-center justify-between rounded-2xl border p-3.5 transition-all"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <div className="bg-muted/50 border-border/20 flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
                    <img
                      src={item.dataUrl}
                      alt={item.name}
                      className="h-full w-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-foreground truncate text-xs font-bold">
                      {item.name}
                    </p>
                    <p className="text-muted-foreground text-[10px]">
                      Pos: {item.x}%, {item.y}% • Escala:{' '}
                      {Math.round(item.scale * 100)}%
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleDecoration(item.id);
                    }}
                    className="text-muted-foreground hover:text-foreground rounded-xl p-2 active:scale-95"
                    aria-label="Alternar visibilidad"
                  >
                    {item.enabled ? (
                      <Eye className="text-primary h-4 w-4" />
                    ) : (
                      <EyeOff className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeDecoration(item.id);
                    }}
                    className="text-destructive hover:bg-destructive/10 rounded-xl p-2 active:scale-95"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
