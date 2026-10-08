import {
  ChangeEvent,
  FC,
  useRef,
} from 'react';
import {
  Check,
  ImagePlus,
  Maximize2,
  RotateCw,
  Trash2,
} from 'lucide-react';

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

  const activePointersRef = useRef<Map<number, { clientX: number; clientY: number }>>(
    new Map(),
  );

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
                ? 'cursor-grab active:cursor-grabbing p-1 rounded-2xl select-none'
                : 'select-none pointer-events-none'
            } ${
              isSelected
                ? 'ring-2 ring-primary ring-offset-2 ring-offset-black/50 shadow-2xl'
                : ''
            }`}
          >
            <img
              src={item.dataUrl}
              alt={item.name}
              className="max-w-[140px] max-h-[140px] object-contain drop-shadow-2xl select-none pointer-events-none"
              draggable={false}
            />

            {isSelected && isEditMode && (
              <>
                <div className="absolute -top-11 left-1/2 -translate-x-1/2 flex flex-col items-center z-50 pointer-events-auto touch-none select-none">
                  <div
                    onPointerDown={(event) =>
                      handleRotateHandlePointerDown(event, item)
                    }
                    className="p-2 rounded-full bg-primary text-primary-foreground shadow-2xl cursor-grab active:cursor-grabbing active:scale-125 transition-transform"
                    aria-label="Rotar elemento"
                  >
                    <RotateCw className="w-4 h-4" />
                  </div>
                  <div className="w-0.5 h-3 bg-primary" />
                </div>

                <div
                  onPointerDown={(event) =>
                    handleScaleHandlePointerDown(event, item)
                  }
                  className="absolute -bottom-3.5 -right-3.5 z-50 p-2 rounded-full bg-primary text-primary-foreground shadow-2xl cursor-nwse-resize active:scale-125 transition-transform pointer-events-auto touch-none select-none"
                  aria-label="Escalar elemento"
                >
                  <Maximize2 className="w-4 h-4" />
                </div>
              </>
            )}
          </div>
        );
      })}

      {isEditMode && (!targetLayer || targetLayer === 'above-all') && (
        <div className="fixed inset-x-0 bottom-0 z-50 p-4 bg-background/95 backdrop-blur-2xl border-t border-border/40 shadow-2xl flex flex-col gap-3 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs font-bold text-foreground truncate max-w-[140px]">
                {selectedDecoration
                  ? selectedDecoration.name
                  : 'Ninguna seleccionada'}
              </span>
              {selectedDecoration && (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-primary/20 text-primary shrink-0">
                  {LAYER_LABELS[selectedDecoration.layer]}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {selectedDecoration && (
                <button
                  type="button"
                  onClick={() => removeDecoration(selectedDecoration.id)}
                  className="p-2 rounded-xl text-destructive hover:bg-destructive/10 active:scale-95 transition-transform"
                  aria-label="Eliminar elemento"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}

              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1 text-xs py-1.5 px-3 rounded-xl font-semibold"
              >
                <ImagePlus className="w-4 h-4" />
                <span>+ GIF / PNG</span>
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={onExitEditMode}
                className="flex items-center gap-1 text-xs py-1.5 px-3.5 rounded-xl shadow-md font-bold"
              >
                <Check className="w-4 h-4" />
                <span>Listo</span>
              </Button>
            </div>
          </div>

          {selectedDecoration && (
            <div className="grid grid-cols-4 gap-1.5 pt-1 border-t border-border/20">
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
                  className={`py-2 px-1 rounded-xl text-[10px] font-bold text-center border transition-all active:scale-95 ${
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
