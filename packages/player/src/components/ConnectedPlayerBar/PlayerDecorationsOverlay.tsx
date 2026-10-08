import { Check, ImagePlus, Maximize2, RotateCw, Trash2 } from 'lucide-react';
import { ChangeEvent, FC, useRef } from 'react';

import { Button } from '@nuclearplayer/ui';

import {
  DecorationLayer,
  PlayerDecoration,
  usePlayerDecorationsStore,
} from '../../stores/playerDecorationsStore';

type PlayerDecorationsOverlayProps = {
  isEditMode: boolean;
  onExitEditMode: () => void;
  targetLayer?: DecorationLayer;
};

const LAYER_Z_INDEX: Record<DecorationLayer, number> = {
  'behind-all': 2,
  'behind-cover': 8,
  'behind-text': 25,
  'above-all': 45,
};

const LAYER_LABELS: Record<DecorationLayer, string> = {
  'above-all': 'Encima de todo',
  'behind-text': 'Detrás de letras',
  'behind-cover': 'Detrás de portada',
  'behind-all': 'Fondo',
};

export const PlayerDecorationsOverlay: FC<PlayerDecorationsOverlayProps> = ({
  isEditMode,
  onExitEditMode,
  targetLayer,
}) => {
  const {
    decorations,
    selectedId,
    setSelectedId,
    addDecoration,
    updateDecoration,
    removeDecoration,
  } = usePlayerDecorationsStore();

  const fileInputRef = useRef<HTMLInputElement>(null);

  const activePointersRef = useRef<
    Map<number, { clientX: number; clientY: number }>
  >(new Map());

  const gestureStartRef = useRef<{
    type: 'move' | 'pinch';
    id: string;
    startX: number;
    startY: number;
    initX: number;
    initY: number;
    initScale: number;
    initRotation: number;
    initDistance: number;
    initAngle: number;
  } | null>(null);

  const selectedDecoration =
    decorations.find((item) => item.id === selectedId) ??
    decorations[decorations.length - 1] ??
    null;

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
    };
    reader.readAsDataURL(file);
  };

  const handleBodyPointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    item: PlayerDecoration,
  ) => {
    if (!isEditMode) {
      return;
    }
    event.stopPropagation();
    setSelectedId(item.id);

    activePointersRef.current.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });

    if (activePointersRef.current.size === 2) {
      const pointerList = Array.from(activePointersRef.current.values());
      const pointerOne = pointerList[0];
      const pointerTwo = pointerList[1];
      const initialDistance = Math.hypot(
        pointerTwo.clientX - pointerOne.clientX,
        pointerTwo.clientY - pointerOne.clientY,
      );
      const initialAngle =
        Math.atan2(
          pointerTwo.clientY - pointerOne.clientY,
          pointerTwo.clientX - pointerOne.clientX,
        ) *
        (180 / Math.PI);

      gestureStartRef.current = {
        type: 'pinch',
        id: item.id,
        startX: event.clientX,
        startY: event.clientY,
        initX: item.x,
        initY: item.y,
        initScale: item.scale,
        initRotation: item.rotation,
        initDistance: initialDistance || 1,
        initAngle: initialAngle,
      };
    } else {
      gestureStartRef.current = {
        type: 'move',
        id: item.id,
        startX: event.clientX,
        startY: event.clientY,
        initX: item.x,
        initY: item.y,
        initScale: item.scale,
        initRotation: item.rotation,
        initDistance: 1,
        initAngle: 0,
      };
    }

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!gestureStartRef.current) {
        return;
      }
      activePointersRef.current.set(moveEvent.pointerId, {
        clientX: moveEvent.clientX,
        clientY: moveEvent.clientY,
      });

      const viewportWidth = window.innerWidth || 360;
      const viewportHeight = window.innerHeight || 640;

      if (
        gestureStartRef.current.type === 'pinch' &&
        activePointersRef.current.size >= 2
      ) {
        const pointerList = Array.from(activePointersRef.current.values());
        const pointerOne = pointerList[0];
        const pointerTwo = pointerList[1];
        const currentDistance = Math.hypot(
          pointerTwo.clientX - pointerOne.clientX,
          pointerTwo.clientY - pointerOne.clientY,
        );
        const currentAngle =
          Math.atan2(
            pointerTwo.clientY - pointerOne.clientY,
            pointerTwo.clientX - pointerOne.clientX,
          ) *
          (180 / Math.PI);

        const ratio = currentDistance / gestureStartRef.current.initDistance;
        const nextScale = Math.max(
          0.25,
          Math.min(
            3.5,
            Number((gestureStartRef.current.initScale * ratio).toFixed(2)),
          ),
        );

        const deltaAngle = currentAngle - gestureStartRef.current.initAngle;
        let nextRotation = Math.round(
          gestureStartRef.current.initRotation + deltaAngle,
        );
        while (nextRotation > 180) {
          nextRotation -= 360;
        }
        while (nextRotation < -180) {
          nextRotation += 360;
        }

        updateDecoration(gestureStartRef.current.id, {
          scale: nextScale,
          rotation: nextRotation,
        });
        return;
      }

      if (gestureStartRef.current.type === 'move') {
        const deltaX = moveEvent.clientX - gestureStartRef.current.startX;
        const deltaY = moveEvent.clientY - gestureStartRef.current.startY;

        const nextX = Math.round(
          gestureStartRef.current.initX + (deltaX / viewportWidth) * 100,
        );
        const nextY = Math.round(
          gestureStartRef.current.initY + (deltaY / viewportHeight) * 100,
        );

        updateDecoration(gestureStartRef.current.id, {
          x: Math.max(0, Math.min(100, nextX)),
          y: Math.max(0, Math.min(100, nextY)),
        });
      }
    };

    const handlePointerUp = (upEvent: PointerEvent) => {
      activePointersRef.current.delete(upEvent.pointerId);
      if (activePointersRef.current.size === 0) {
        gestureStartRef.current = null;
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerUp);
        window.removeEventListener('pointercancel', handlePointerUp);
      }
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleScaleHandlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    item: PlayerDecoration,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    setSelectedId(item.id);

    const viewportWidth = window.innerWidth || 360;
    const viewportHeight = window.innerHeight || 640;
    const centerX = (item.x / 100) * viewportWidth;
    const centerY = (item.y / 100) * viewportHeight;

    const initialDistance = Math.hypot(
      event.clientX - centerX,
      event.clientY - centerY,
    );
    const initialScale = item.scale;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const currentDistance = Math.hypot(
        moveEvent.clientX - centerX,
        moveEvent.clientY - centerY,
      );
      const factor =
        initialDistance > 10 ? currentDistance / initialDistance : 1;
      const nextScale = Math.max(
        0.25,
        Math.min(3.5, Number((initialScale * factor).toFixed(2))),
      );
      updateDecoration(item.id, { scale: nextScale });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleRotateHandlePointerDown = (
    event: React.PointerEvent<HTMLDivElement>,
    item: PlayerDecoration,
  ) => {
    event.stopPropagation();
    event.preventDefault();
    setSelectedId(item.id);

    const viewportWidth = window.innerWidth || 360;
    const viewportHeight = window.innerHeight || 640;
    const centerX = (item.x / 100) * viewportWidth;
    const centerY = (item.y / 100) * viewportHeight;

    const startAngle =
      Math.atan2(event.clientY - centerY, event.clientX - centerX) *
      (180 / Math.PI);
    const initialRotation = item.rotation;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const currentAngle =
        Math.atan2(moveEvent.clientY - centerY, moveEvent.clientX - centerX) *
        (180 / Math.PI);
      const deltaAngle = currentAngle - startAngle;
      let nextRotation = Math.round(initialRotation + deltaAngle);
      while (nextRotation > 180) {
        nextRotation -= 360;
      }
      while (nextRotation < -180) {
        nextRotation += 360;
      }
      updateDecoration(item.id, { rotation: nextRotation });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const visibleDecorations = targetLayer
    ? decorations.filter((item) => item.enabled && item.layer === targetLayer)
    : decorations.filter((item) => item.enabled);

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/gif,image/webp,image/jpeg"
        onChange={handleFileUpload}
        className="hidden"
      />

      {visibleDecorations.map((item) => {
        const isSelected = isEditMode && selectedDecoration?.id === item.id;
        const baseZIndex = LAYER_Z_INDEX[item.layer] ?? 40;
        const zIndex = isSelected ? baseZIndex + 1 : baseZIndex;

        return (
          <div
            key={item.id}
            onPointerDown={(event) => handleBodyPointerDown(event, item)}
            style={{
              position: 'fixed',
              left: `${item.x}vw`,
              top: `${item.y}vh`,
              transform: `translate3d(-50%, -50%, 0) scale(${item.scale}) rotate(${item.rotation}deg)`,
              opacity: item.opacity,
              zIndex,
              touchAction: isEditMode ? 'none' : 'auto',
              pointerEvents: isEditMode ? 'auto' : 'none',
              willChange: isEditMode ? 'transform' : 'auto',
              backfaceVisibility: 'hidden',
            }}
            className={`transition-shadow ${
              isEditMode
                ? 'cursor-grab rounded-2xl p-1 select-none active:cursor-grabbing'
                : 'pointer-events-none select-none'
            } ${
              isSelected
                ? 'ring-primary shadow-2xl ring-2 ring-offset-2 ring-offset-black/50'
                : ''
            }`}
          >
            <img
              src={item.dataUrl}
              alt={item.name}
              className="pointer-events-none max-h-[140px] max-w-[140px] object-contain drop-shadow-2xl select-none"
              draggable={false}
            />

            {isSelected && isEditMode && (
              <>
                <div className="pointer-events-auto absolute -top-11 left-1/2 z-50 flex -translate-x-1/2 touch-none flex-col items-center select-none">
                  <div
                    onPointerDown={(event) =>
                      handleRotateHandlePointerDown(event, item)
                    }
                    className="bg-primary text-primary-foreground cursor-grab rounded-full p-2 shadow-2xl transition-transform active:scale-125 active:cursor-grabbing"
                    aria-label="Rotar elemento"
                  >
                    <RotateCw className="h-4 w-4" />
                  </div>
                  <div className="bg-primary h-3 w-0.5" />
                </div>

                <div
                  onPointerDown={(event) =>
                    handleScaleHandlePointerDown(event, item)
                  }
                  className="bg-primary text-primary-foreground pointer-events-auto absolute -right-3.5 -bottom-3.5 z-50 cursor-nwse-resize touch-none rounded-full p-2 shadow-2xl transition-transform select-none active:scale-125"
                  aria-label="Escalar elemento"
                >
                  <Maximize2 className="h-4 w-4" />
                </div>
              </>
            )}
          </div>
        );
      })}

      {isEditMode && (!targetLayer || targetLayer === 'above-all') && (
        <div className="bg-background/95 border-border/40 animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 flex flex-col gap-3 border-t p-4 shadow-2xl backdrop-blur-2xl duration-200">
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <span className="text-foreground max-w-[140px] truncate text-xs font-bold">
                {selectedDecoration
                  ? selectedDecoration.name
                  : 'Ninguna seleccionada'}
              </span>
              {selectedDecoration && (
                <span className="bg-primary/20 text-primary shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase">
                  {LAYER_LABELS[selectedDecoration.layer]}
                </span>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1.5">
              {selectedDecoration && (
                <button
                  type="button"
                  onClick={() => removeDecoration(selectedDecoration.id)}
                  className="text-destructive hover:bg-destructive/10 rounded-xl p-2 transition-transform active:scale-95"
                  aria-label="Eliminar elemento"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold"
              >
                <ImagePlus className="h-4 w-4" />
                <span>+ GIF / PNG</span>
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={onExitEditMode}
                className="flex items-center gap-1 rounded-xl px-3.5 py-1.5 text-xs font-bold shadow-md"
              >
                <Check className="h-4 w-4" />
                <span>Listo</span>
              </Button>
            </div>
          </div>

          {selectedDecoration && (
            <div className="border-border/20 grid grid-cols-4 gap-1.5 border-t pt-1">
              {(
                [
                  'above-all',
                  'behind-text',
                  'behind-cover',
                  'behind-all',
                ] as DecorationLayer[]
              ).map((layerKey) => (
                <button
                  key={layerKey}
                  type="button"
                  onClick={() =>
                    updateDecoration(selectedDecoration.id, {
                      layer: layerKey,
                    })
                  }
                  className={`rounded-xl border px-1 py-2 text-center text-[10px] font-bold transition-all active:scale-95 ${
                    selectedDecoration.layer === layerKey
                      ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                      : 'bg-card/60 text-muted-foreground border-border/30 hover:bg-card'
                  }`}
                >
                  {LAYER_LABELS[layerKey]}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
};
