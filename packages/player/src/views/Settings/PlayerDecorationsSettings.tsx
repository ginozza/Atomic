import { ChangeEvent, FC, useRef } from 'react';
import {
  Eye,
  EyeOff,
  ImagePlus,
  Maximize2,
  Sparkles,
  Trash2,
} from 'lucide-react';

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
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-black text-xl text-foreground">
            Player Decorations
          </h2>
        </div>
        <p className="text-xs text-muted-foreground">
          Personaliza la vista del reproductor con stickers, fotos y GIFs animados. Puedes moverlos, rotarlos y escalarlos con tus dedos en tiempo real.
        </p>
      </header>

      {/* Action buttons */}
      <div className="space-y-3">
        <Button
          variant="default"
          onClick={handleOpenFullscreenEditor}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl shadow-lg font-bold text-sm"
        >
          <Maximize2 className="w-5 h-5" />
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
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-semibold text-xs"
        >
          <ImagePlus className="w-4 h-4" />
          <span>Cargar Nuevo GIF o Imagen</span>
        </Button>
      </div>

      {/* List of Loaded Decorations */}
      {decorations.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-semibold text-muted-foreground">
            Elementos Guardados ({decorations.length})
          </label>
          <div className="space-y-2">
            {decorations.map((item) => (
              <div
                key={item.id}
                onClick={handleOpenFullscreenEditor}
                className="flex items-center justify-between p-3.5 rounded-2xl border border-border/30 bg-card/40 hover:bg-card/70 transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-xl overflow-hidden bg-muted/50 border border-border/20 flex items-center justify-center shrink-0">
                    <img
                      src={item.dataUrl}
                      alt={item.name}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-bold text-xs text-foreground truncate">
                      {item.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Pos: {item.x}%, {item.y}% • Escala: {Math.round(item.scale * 100)}%
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
                    className="p-2 rounded-xl text-muted-foreground hover:text-foreground active:scale-95"
                    aria-label="Alternar visibilidad"
                  >
                    {item.enabled ? (
                      <Eye className="w-4 h-4 text-primary" />
                    ) : (
                      <EyeOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      removeDecoration(item.id);
                    }}
                    className="p-2 rounded-xl text-destructive hover:bg-destructive/10 active:scale-95"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="w-4 h-4" />
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
